import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { describe, expect, it } from 'vitest'
import EffortPolicy from '../src/index.ts'
import type { Config } from '../src/config.ts'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { TOOL_ABORTED } from '@deepseek-ai/dsh-tools'

const CAPABILITY = { efforts: ['off', 'low', 'high', 'max'], defaultEffort: 'high' }

const VERIFIERS: Config['verifiers'] = [
  { tool: 'pwsh', commandPattern: 'npm test', passPattern: 'passed', failPattern: 'failed', outcome: 'text' },
  { tool: 'pwsh', commandPattern: 'npm run lint', passPattern: 'clean', failPattern: 'problems', outcome: 'text' },
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

async function harness(overrides: Partial<Config> = {}): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(EffortPolicy, config(overrides))
  return { ctx, session: ctx.sessions.create() }
}

function result(text: string, isError = false, code?: string): ToolExecutionResult {
  if (!isError) return { isError: false, value: null, content: [{ type: 'text', text }] }
  return {
    isError: true,
    content: [{ type: 'text', text }],
    error: { message: text, ...code === undefined ? {} : { info: { name: 'HarnessError', code } } },
  }
}

function verify(ctx: Context, session: Session, command: string, output: string): void {
  ctx.effortPolicy.observe(session, 'pwsh', { command }, result(output))
}

describe('M3 integration: configured verifier escalation', () => {
  it('raises effort after a configured verifier fails', async () => {
    const { ctx, session } = await harness()
    verify(ctx, session, 'npm test', '1 failed')
    expect(ctx.effortPolicy.stateOf(session).openFailure?.verifier).toContain('npm test')
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session))
      .toEqual({ rule: 'escalated', level: 'deep', effort: 'max' })
  })

  it('clears the escalation when the same verifier passes later', async () => {
    const { ctx, session } = await harness()
    verify(ctx, session, 'npm test', '1 failed')
    verify(ctx, session, 'npm test', 'all passed')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session))
      .toEqual({ rule: 'base', level: 'standard' })
  })

  it('does not clear an escalation with an unrelated verifier pass', async () => {
    const { ctx, session } = await harness()
    verify(ctx, session, 'npm test', '1 failed')
    verify(ctx, session, 'npm run lint', 'clean')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
  })

  it('does not clear an escalation with a different command on the same tool', async () => {
    const { ctx, session } = await harness()
    verify(ctx, session, 'npm test --filter a', '1 failed')
    verify(ctx, session, 'npm test --filter b', 'all passed')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
  })

  it('does not escalate on infrastructure results or read-only commands', async () => {
    const { ctx, session } = await harness()
    ctx.effortPolicy.observe(session, 'pwsh', { command: 'npm test' }, result('spawn failed', true))
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
    verify(ctx, session, 'git status', 'clean tree')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
  })

  it('keeps an escalation through a cancelled verification of the same command', async () => {
    const { ctx, session } = await harness()
    verify(ctx, session, 'npm test', '1 failed')
    ctx.effortPolicy.observe(session, 'pwsh', { command: 'npm test' }, result('aborted', true, TOOL_ABORTED))
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeDefined()
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session).rule).toBe('escalated')
  })

  it('records no decision while the policy is disabled', async () => {
    const { ctx, session } = await harness({ enabled: false })
    verify(ctx, session, 'npm test', '1 failed')
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
  })

  it('keeps one check when the caller retitles it', async () => {
    const { ctx, session } = await harness()
    ctx.effortPolicy.observe(
      session, 'pwsh', { command: 'npm test', description: 'Run the suite' }, result('1 failed'),
    )
    ctx.effortPolicy.observe(
      session, 'pwsh', { command: 'npm test', description: 'Re-run the suite' }, result('all passed'),
    )
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
  })

  it('does not read a title as the command', async () => {
    const { ctx, session } = await harness()
    ctx.effortPolicy.observe(
      session, 'pwsh', { command: 'echo hi', description: 'npm test' }, result('1 failed'),
    )
    expect(ctx.effortPolicy.stateOf(session).openFailure).toBeUndefined()
  })
})

describe('M3 integration: durable restoration', () => {
  it('reconstructs an open escalation in a fresh context from the Session log', async () => {
    const first = await harness()
    verify(first.ctx, first.session, 'npm test', '1 failed')

    const second = new Context()
    await second.plugin(SessionStore)
    await second.plugin(SessionProjectionRegistry)
    await second.plugin(EffortPolicy, config())
    expect(second.effortPolicy.stateOf(first.session).openFailure?.verifier).toContain('npm test')
  })

  it('clears a persisted escalation after a restart', async () => {
    const first = await harness()
    verify(first.ctx, first.session, 'npm test', '1 failed')
    expect(first.ctx.effortPolicy.stateOf(first.session).openFailure).toBeDefined()

    const second = new Context()
    await second.plugin(SessionStore)
    await second.plugin(SessionProjectionRegistry)
    await second.plugin(EffortPolicy, config())
    expect(second.effortPolicy.stateOf(first.session).openFailure).toBeDefined()

    second.effortPolicy.observe(
      first.session,
      'pwsh',
      { command: 'npm test' },
      result('all passed'),
    )
    expect(second.effortPolicy.stateOf(first.session).openFailure).toBeUndefined()
  })

  it('keeps child Sessions isolated', async () => {
    const { ctx, session } = await harness()
    const child = ctx.sessions.create()
    verify(ctx, session, 'npm test', '1 failed')
    expect(ctx.effortPolicy.stateOf(child).openFailure).toBeUndefined()
  })
})
