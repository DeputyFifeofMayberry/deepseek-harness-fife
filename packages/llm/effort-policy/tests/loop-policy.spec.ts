import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { TOOL_ABORTED } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import EffortPolicy from '../src/index.ts'
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
    readOnlyCommands: ['git status'],
    infrastructureFailureCodes: [],
    shellTools: ['bash', 'pwsh'],
    ignoredArgumentKeys: ['description'],
    ...overrides,
  }
}

function result(text: string, isError = false): ToolExecutionResult {
  if (!isError) return { isError: false, value: null, content: [{ type: 'text', text }] }
  return { isError: true, content: [{ type: 'text', text }], error: { message: text } }
}

interface Harness {
  readonly ctx: Context
  readonly session: Session
  readonly check: (output: string, workdir: string, session?: Session) => void
  readonly mutate: (session?: Session) => void
}

async function harness(overrides: Partial<Config> = {}): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(EffortPolicy, config(overrides))
  const session = ctx.sessions.create()
  return {
    ctx,
    session,
    check: (output, workdir, subject = session) => {
      ctx.effortPolicy.observe(subject, 'pwsh', { command: 'npm test', workdir }, result(output))
    },
    mutate: (subject = session) => {
      ctx.effortPolicy.observe(subject, 'write', { file_path: 'a.ts' }, result('ok'))
    },
  }
}

describe('M3 evidence: what clears an escalation', () => {
  it('clears only when the same check passes in the same directory', async () => {
    const { ctx, session, check } = await harness()
    check('1 failed', '/work/a')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
    check('all passed', '/work/b')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
    check('all passed', '/work/a')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
  })

  it('does not treat a pass observed before the failure as recovery', async () => {
    const { ctx, session, check } = await harness()
    check('all passed', '/work/a')
    check('1 failed', '/work/a')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session))
      .toEqual({ rule: 'escalated', level: 'deep', effort: 'max' })
  })

  it('counts workspace mutations across Sessions, so a child edit advances the parent counter', async () => {
    const { ctx, session, mutate } = await harness()
    const child = ctx.sessions.create()
    mutate(child)
    mutate(child)
    ctx.effortPolicy.observe(session, 'pwsh', { command: 'npm test', workdir: '/work/a' }, result('1 failed'))
    expect(ctx.effortPolicy.stateOf(session).openFailure?.revision).toBe(2)
  })

  it('keeps the escalation when the provider reports a cancellation', async () => {
    const { ctx, session, check } = await harness()
    check('1 failed', '/work/a')
    ctx.effortPolicy.observe(session, 'pwsh', { command: 'npm test', workdir: '/work/a' }, {
      isError: true,
      content: [{ type: 'text', text: 'aborted' }],
      error: { message: 'aborted', info: { name: 'HarnessError', code: TOOL_ABORTED } },
    })
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
  })

  it('leaves the level alone for a read-only command', async () => {
    const { ctx, session, check } = await harness()
    check('1 failed', '/work/a')
    ctx.effortPolicy.observe(session, 'pwsh', { command: 'git status', workdir: '/work/a' }, result('clean'))
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
    check('all passed', '/work/a')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
  })
})

/** A route whose vocabulary the test chooses, and which never dispatches. */
class VocabularyAdapter extends LlmAdapter {
  constructor(private readonly efforts: readonly string[], private readonly defaultEffort?: string) {
    super()
  }

  override async resolveModel(provider: string, model: string) {
    return {
      provider,
      id: model,
      name: model,
      ...this.efforts.length === 0 ? {} : {
        reasoning: {
          efforts: this.efforts.map(effort => ({ id: ReasoningEffortId(effort), name: effort })),
          ...this.defaultEffort === undefined ? {} : { defaultEffort: ReasoningEffortId(this.defaultEffort) },
        },
      },
    }
  }

  override async *stream(): AsyncIterable<never> {
    // No dispatch in these tests.
  }
}

async function routeHarness(
  efforts: readonly string[],
  defaultEffort: string | undefined,
  overrides: Partial<Config> = {},
): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['p'], new VocabularyAdapter(efforts, defaultEffort))
  await ctx.plugin(EffortPolicy, config({ baseLevel: 'deep', ...overrides }))
  return { ctx, session: ctx.sessions.create() }
}

describe('M3 evidence: a route that cannot take the decided level', () => {
  it('leaves a route without reasoning untouched', async () => {
    const { ctx, session } = await routeHarness([], undefined)
    const applied = await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' })
    expect(applied).toEqual({ provider: 'p', model: 'm' })
  })

  it('falls back to the adapter default when the level has no distinct effort', async () => {
    const { ctx, session } = await routeHarness(['off', 'low'], 'low')
    const applied = await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' })
    expect(applied.reasoningEffort).toBeUndefined()
  })

  it('drops an effort inherited from the logged header when nothing is decided', async () => {
    const { ctx, session } = await routeHarness(['off', 'low', 'high'], 'high', { baseLevel: 'standard' })
    const applied = await ctx.effortPolicy.applyTo(session, {
      provider: 'p',
      model: 'm',
      reasoningEffort: ReasoningEffortId('low'),
    })
    expect(applied.reasoningEffort).toBeUndefined()
  })
})
