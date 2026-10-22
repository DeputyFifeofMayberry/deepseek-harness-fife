import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import SessionStore, { Session, SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import type { SessionProjectionStateMap } from '@deepseek-ai/dsh-session-projection/types'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import EffortPolicy, { EffortPolicyUnavailableError } from '../src/index.ts'
import type { Config } from '../src/config.ts'

const CAPABILITY = { efforts: ['off', 'low', 'high', 'max'], defaultEffort: 'high' }

const VERIFIERS: Config['verifiers'] = [
  { tool: 'pwsh', commandPattern: 'npm test', passPattern: 'passed', failPattern: 'failed', outcome: 'text' },
]

function config(overrides: Partial<Config> = {}): Config {
  return {
    enabled: true,
    baseLevel: 'standard',
    verifiers: VERIFIERS,
    mutators: ['write', 'edit'],
    readOnlyCommands: [],
    infrastructureFailureCodes: [],
    shellTools: ['bash', 'pwsh'],
    ignoredArgumentKeys: ['description'],
    ...overrides,
  }
}

function result(text: string): ToolExecutionResult {
  return { isError: false, value: null, content: [{ type: 'text', text }] }
}

function fail(ctx: Context, session: Session): void {
  ctx.effortPolicy.observe(session, 'pwsh', { command: 'npm test', workdir: '/work' }, result('1 failed'))
}

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function mountedContext(overrides: Partial<Config> = {}, existingRoot?: string): Promise<{ ctx: Context; root: string }> {
  const root = existingRoot ?? await mkdtemp(join(tmpdir(), 'dsh-effort-resume-'))
  if (existingRoot === undefined) dirs.push(root)
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(JsonlSessionPersistence, { root })
  await ctx.plugin(EffortPolicy, config(overrides))
  return { ctx, root }
}

describe('M3 durability: a stored escalation survives a process boundary', () => {
  it('restores the open failure from the JSONL log in a fresh context', async () => {
    const first = await mountedContext()
    const session = first.ctx.sessions.create(SessionId('effort-durable'))
    const handle = await first.ctx.sessionPersistence.create(session.header)
    fail(first.ctx, session)
    await first.ctx.sessions.flush(session)
    await handle.close()
    await first.ctx.fiber.dispose()

    const second = await mountedContext({}, first.root)
    try {
      const reader = await second.ctx.sessionPersistence.open(SessionId('effort-durable'), 'read')
      const loaded = await reader.read()
      await reader.close()
      const restored = Session.create(reader.header.id, loaded.events, reader.header, reader.inheritedEventCount)
      expect(second.ctx.effortPolicy.stateOf(restored).openFailure?.verifier).toContain('npm test')
      expect(second.ctx.effortPolicy.decideFor(CAPABILITY, restored))
        .toEqual({ rule: 'escalated', level: 'deep', effort: 'max' })
    } finally {
      await second.ctx.fiber.dispose()
    }
  })

  it('keeps the escalation across a surface replacement such as compaction', async () => {
    const { ctx } = await mountedContext()
    try {
      const session = ctx.sessions.create(SessionId('effort-compacted'))
      session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'first prompt' }],
        source: { kind: 'user' },
      }), { surfaceOp: 'append' })
      fail(ctx, session)
      expect(session.surface.nodes).toEqual([SessionSeq(0)])
      // A compaction replaces the shadowed surface nodes with one checkpoint
      // message; the effort record is log-only and must survive the replacement.
      session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'summary of earlier work' }],
        source: { kind: 'user' },
      }), {
        surfaceOp: { op: 'replace', startSeq: SessionSeq(0), endSeq: SessionSeq(0) },
        sourceEventSeqs: [SessionSeq(0)],
      })
      expect(session.surface.nodes).toEqual([SessionSeq(2)])
      expect(ctx.effortPolicy.stateOf(session).openFailure?.verifier).toContain('npm test')
    } finally {
      await ctx.fiber.dispose()
    }
  })
})

/** A projection registry stand-in that returns one chosen stored value. */
class StubProjections extends Service {
  stored: unknown = {}

  constructor(ctx: Context) {
    super(ctx, 'sessionProjections')
  }

  /** Accepts the policy's projection so the service can mount. */
  register(): () => void {
    return () => {}
  }

  /**
   * @returns the stored value, exactly as a fold left it.
   */
  stateOf(): SessionProjectionStateMap['effort'] {
    return this.stored as SessionProjectionStateMap['effort']
  }
}

/** The instance the current test mounted, so a test can change what it returns. */
let stub: StubProjections | undefined

/**
 * The mounted stub, failing loudly when the harness did not mount one.
 * @returns the current stub instance.
 */
function mountedStub(): StubProjections {
  if (stub === undefined) throw new Error('projection-resume: no stub registry was mounted')
  return stub
}

async function stubContext(stored: unknown): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin((inner: Context) => { stub = new StubProjections(inner) })
  await ctx.plugin(EffortPolicy, config())
  const session = ctx.sessions.create(SessionId(`effort-stub-${String(Math.random()).slice(2, 8)}`))
  mountedStub().stored = stored
  return { ctx, session }
}

describe('M3 durability: an unreadable record fails closed', () => {
  it('refuses a record it cannot decode instead of reading it as base state', async () => {
    const { ctx, session } = await stubContext({ base: 'ultra' })
    try {
      expect(() => ctx.effortPolicy.stateOf(session)).toThrow(EffortPolicyUnavailableError)
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('keeps the last level it read when a later record cannot be decoded', async () => {
    const { ctx, session } = await stubContext({
      base: 'standard',
      openFailure: { verifier: 'pwsh\u0000{"command":"npm test"}\u0000/work', sequence: 1, revision: 0 },
    })
    try {
      expect(ctx.effortPolicy.decideFor(CAPABILITY, session)).toEqual({ rule: 'escalated', level: 'deep', effort: 'max' })
      mountedStub().stored = { base: 'ultra' }
      expect(ctx.effortPolicy.decideFor(CAPABILITY, session)).toEqual({ rule: 'escalated', level: 'deep', effort: 'max' })
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
