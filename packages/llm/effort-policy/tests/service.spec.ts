import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
import EffortPolicy, { isEffortLevel } from '../src/index.ts'
import type { Config } from '../src/config.ts'

const CAPABILITY = { efforts: ['off', 'low', 'high', 'max'], defaultEffort: 'high' }

function config(overrides: Partial<Config> = {}): Config {
  return {
    enabled: true,
    baseLevel: 'standard',
    verifiers: [],
    mutators: ['write', 'edit'],
    readOnlyCommands: [],
    infrastructureFailureCodes: [],
    shellTools: ['bash', 'pwsh'],
    ignoredArgumentKeys: ['description'],
    ...overrides,
  }
}

/** A route that advertises a reasoning vocabulary and never dispatches. */
class ReasoningAdapter extends LlmAdapter {
  override async resolveModel(provider: string, model: string) {
    return {
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('off'), name: 'Off' },
          { id: ReasoningEffortId('low'), name: 'Low' },
          { id: ReasoningEffortId('high'), name: 'High' },
        ],
        defaultEffort: ReasoningEffortId('high'),
      },
    }
  }

  override async *stream(): AsyncIterable<never> {
    // No dispatch in these tests.
  }
}

async function harness(overrides: Partial<Config> = {}): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(EffortPolicy, config(overrides))
  return { ctx, session: ctx.sessions.create() }
}

describe('effort policy service', () => {
  it('mounts disabled and decides at the configured base', async () => {
    const { ctx, session } = await harness({ enabled: false })
    expect(ctx.effortPolicy.enabled).toBe(false)
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session)).toEqual({ rule: 'base', level: 'standard' })
  })

  it('decides at the configured base when no pick exists', async () => {
    const { ctx, session } = await harness({ baseLevel: 'low' })
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session)).toEqual({ rule: 'base', level: 'low', effort: 'low' })
  })

  it('records a level pick as the base', async () => {
    const { ctx, session } = await harness({ baseLevel: 'standard' })
    ctx.effortPolicy.setBase(session, 'deep')
    expect(ctx.effortPolicy.stateOf(session)).toMatchObject({ base: 'deep' })
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session)).toEqual({ rule: 'base', level: 'deep', effort: 'max' })
  })

  it('records an exact pick verbatim and never escalates it', async () => {
    const { ctx, session } = await harness({ baseLevel: 'deep' })
    ctx.effortPolicy.setBase(session, 'off')
    expect(ctx.effortPolicy.decideFor(CAPABILITY, session)).toEqual({ rule: 'exact-base', effort: 'off' })
  })

  it('replaces an exact pick with a later level pick', async () => {
    const { ctx, session } = await harness()
    ctx.effortPolicy.setBase(session, 'off')
    ctx.effortPolicy.setBase(session, 'low')
    expect(ctx.effortPolicy.stateOf(session)).toEqual({ base: 'low' })
  })

  it('rejects an empty pick', async () => {
    const { ctx, session } = await harness()
    expect(() => { ctx.effortPolicy.setBase(session, '') }).toThrow(/non-empty/)
  })

  it('exposes operation start levels', async () => {
    const { ctx } = await harness()
    expect(ctx.effortPolicy.levelFor('review')).toBe('deep')
    expect(ctx.effortPolicy.levelFor('mechanical')).toBe('low')
  })

  it('rejects a malformed verifier pattern at load', async () => {
    await expect(harness({
      verifiers: [{ tool: 'pwsh', commandPattern: '[', passPattern: 'ok', failPattern: '', outcome: 'text' }],
    })).rejects.toThrow(/commandPattern/)
  })

  it('keeps provider and model while applying the effort', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['p'], new ReasoningAdapter())
    await ctx.plugin(EffortPolicy, config({ baseLevel: 'low' }))
    const session = ctx.sessions.create()
    const applied = await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' })
    expect(applied.provider).toBe('p')
    expect(applied.model).toBe('m')
    expect(applied.reasoningEffort).toBe('low')
  })

  it('does not apply an effort when disabled', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['p'], new ReasoningAdapter())
    await ctx.plugin(EffortPolicy, config({ enabled: false, baseLevel: 'low' }))
    const session = ctx.sessions.create()
    const applied = await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' })
    expect(applied.reasoningEffort).toBeUndefined()
  })

  it('starts at a declared choice until the Session records its own', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['p'], new ReasoningAdapter())
    await ctx.plugin(EffortPolicy, config({ baseLevel: 'deep' }))
    const session = ctx.sessions.create()

    // The declared start outranks the configured base for an untouched Session.
    expect((await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' }, { level: 'low' })).reasoningEffort)
      .toBe('low')
    // An exact declaration is written verbatim and never resolved to a level.
    expect((await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' }, { exact: 'off' })).reasoningEffort)
      .toBe('off')

    // Once the Session records a base, that record decides.
    ctx.effortPolicy.setBase(session, 'deep')
    expect((await ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' }, { level: 'low' })).reasoningEffort)
      .toBeUndefined()
  })
})

describe('isEffortLevel', () => {
  it('accepts the three automatic levels only', () => {
    expect(isEffortLevel('low')).toBe(true)
    expect(isEffortLevel('standard')).toBe(true)
    expect(isEffortLevel('deep')).toBe(true)
    expect(isEffortLevel('off')).toBe(false)
  })
})
