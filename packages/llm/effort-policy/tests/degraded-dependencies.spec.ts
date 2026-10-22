import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import EffortPolicy from '../src/index.ts'
import { EffortPolicyUnavailableError } from '../src/service.ts'
import type { Config } from '../src/config.ts'

const CONFIG: Config = {
  enabled: true,
  baseLevel: 'standard',
  verifiers: [],
  mutators: [],
  readOnlyCommands: [],
  infrastructureFailureCodes: [],
  shellTools: [],
  ignoredArgumentKeys: ['description'],
}

/** A route that advertises reasoning. */
class ReasoningAdapter extends LlmAdapter {
  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('low'), name: 'Low' },
          { id: ReasoningEffortId('high'), name: 'High' },
          { id: ReasoningEffortId('max'), name: 'Max' },
        ],
        defaultEffort: ReasoningEffortId('high'),
      },
    }
  }

  override async *stream(): AsyncIterable<never> {
    // No dispatch in these tests.
  }
}

/** A route whose capability discovery rejects. */
class BrokenAdapter extends LlmAdapter {
  override resolveModel(): Promise<LlmResolvedModelInfo> {
    return Promise.reject(new Error('catalog unavailable'))
  }

  override async *stream(): AsyncIterable<never> {
    // No dispatch in these tests.
  }
}

/** A route that genuinely advertises no reasoning. */
class PlainAdapter extends LlmAdapter {
  override async *stream(): AsyncIterable<never> {
    // No dispatch in these tests.
  }
}

async function base(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  return ctx
}

describe('effort policy dependency failures', () => {
  it('fails loud when the projection registry is unavailable', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(EffortPolicy, CONFIG)
    const session = ctx.sessions.create()
    expect(() => ctx.effortPolicy.stateOf(session)).toThrow(EffortPolicyUnavailableError)
    expect(() => ctx.effortPolicy.stateOf(session)).toThrow(/sessionProjections/)
  })

  it('fails loud when the llm runtime was withdrawn', async () => {
    const ctx = await base()
    const fiber = await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['p'], new ReasoningAdapter())
    await ctx.plugin(EffortPolicy, CONFIG)
    const session = ctx.sessions.create()
    await fiber.dispose()
    await expect(ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm' }))
      .rejects.toThrow(EffortPolicyUnavailableError)
  })

  it('fails loud when capability discovery rejects', async () => {
    const ctx = await base()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['p'], new BrokenAdapter())
    await ctx.plugin(EffortPolicy, CONFIG)
    const session = ctx.sessions.create()
    await expect(ctx.effortPolicy.applyTo(session, { provider: 'p', model: 'm', reasoningEffort: ReasoningEffortId('max') }))
      .rejects.toThrow(/catalog unavailable/)
  })

  it('leaves a route without reasoning exactly as proposed', async () => {
    const ctx = await base()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['p'], new PlainAdapter())
    await ctx.plugin(EffortPolicy, CONFIG)
    const session = ctx.sessions.create()
    const proposed = { provider: 'p', model: 'm', reasoningEffort: ReasoningEffortId('max') }
    await expect(ctx.effortPolicy.applyTo(session, proposed)).resolves.toEqual(proposed)
  })
})
