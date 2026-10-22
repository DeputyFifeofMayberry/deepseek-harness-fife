import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, {
  createUserMessage,
  ReasoningEffortId,
  type LlmModelReasoningInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import EffortPolicy from '../src/index.ts'
import type { Config } from '../src/config.ts'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const REASONING: LlmModelReasoningInfo = {
  efforts: [
    { id: ReasoningEffortId('off'), name: 'Off' },
    { id: ReasoningEffortId('low'), name: 'Low' },
    { id: ReasoningEffortId('high'), name: 'High' },
    { id: ReasoningEffortId('max'), name: 'Max' },
  ],
  defaultEffort: ReasoningEffortId('high'),
}

function config(baseLevel: Config['baseLevel']): Config {
  return {
    enabled: true,
    baseLevel,
    verifiers: [],
    mutators: [],
    readOnlyCommands: [],
    infrastructureFailureCodes: [],
    shellTools: [],
    ignoredArgumentKeys: ['description'],
  }
}

interface Harness {
  readonly ctx: Context
  readonly adapter: MockAdapter
  readonly agent: Agent
  /** The owning handle: its disposer is the capability that tears the Agent down. */
  readonly handle: { dispose(): Promise<void> }
  /** The `llm` provider fiber, so a test can withdraw and replace the dependency. */
  llm: { dispose(): Promise<void> }
}

async function harness(script: StreamChunk[][]): Promise<Harness> {
  const ctx = new Context()
  const llm = await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  const adapter = new MockAdapter(script, REASONING)
  ctx.llm.registerAdapter(['mock'], adapter)
  const handle = await ctx.agents.create({
    sessionId: SessionId('lifecycle'),
    agentOptions: { provider: 'mock', model: 'mock' },
  })
  return { ctx, adapter, agent: handle.agent, handle, llm }
}

function send(agent: Agent, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
}

/**
 * Withdraw the `llm` service, wait until the injection generation that depends
 * on it has actually unloaded, then provide a replacement.
 */
async function replaceLlm(instance: Harness): Promise<void> {
  await instance.llm.dispose()
  for (let attempt = 0; attempt < 100 && instance.ctx.root.get('llm') !== undefined; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  expect(instance.ctx.root.get('llm') === undefined).toBe(true)
  instance.llm = await instance.ctx.plugin(LlmRuntime)
  instance.ctx.llm.registerAdapter(['mock'], instance.adapter)
}

describe('effort policy listener ownership', () => {
  it('applies while mounted, stops after disposal, and returns on remount', async () => {
    const { ctx, adapter, agent } = await harness([
      textResponse('one'),
      textResponse('two'),
      textResponse('three'),
    ])

    const first = await ctx.plugin(EffortPolicy, config('low'))
    const firstSpy = vi.spyOn(ctx.effortPolicy, 'applyTo')
    send(agent, 'first')
    await agent.whenIdle()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
    expect(firstSpy).toHaveBeenCalledTimes(1)

    await first.dispose()
    send(agent, 'second')
    await agent.whenIdle()
    // Disposal leaves the last logged header untouched, so the seeded effort
    // survives; the spies below are the discriminator for who owns the listener.
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
    expect(firstSpy).toHaveBeenCalledTimes(1)

    await ctx.plugin(EffortPolicy, config('deep'))
    const secondSpy = vi.spyOn(ctx.effortPolicy, 'applyTo')
    send(agent, 'third')
    await agent.whenIdle()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('max')
    // Exactly one application by the new policy, none by the disposed one: a
    // surviving stale listener would have incremented the first spy again.
    expect(secondSpy).toHaveBeenCalledTimes(1)
    expect(firstSpy).toHaveBeenCalledTimes(1)
  })

  it('serves Agents created after its provider was replaced, and none of the drained ones', async () => {
    const instance = await harness([
      textResponse('before'),
      textResponse('after'),
      textResponse('third'),
    ])
    const { ctx, adapter, agent } = instance
    await ctx.plugin(EffortPolicy, config('low'))
    const spy = vi.spyOn(ctx.effortPolicy, 'applyTo')

    send(agent, 'before replacement')
    await agent.whenIdle()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
    expect(spy).toHaveBeenCalledTimes(1)
    const requestsBefore = adapter.requests.length

    await replaceLlm(instance)
    // The loop owns the Agents it created, so withdrawing a service it injects
    // drains them: nothing is left for a stale listener to serve.
    expect(ctx.agents.list()).toEqual([])
    send(agent, 'drained agent')
    await agent.whenIdle()
    expect(adapter.requests.length).toBe(requestsBefore)
    expect(spy).toHaveBeenCalledTimes(1)

    const created = await ctx.agents.create({
      sessionId: SessionId('lifecycle-replacement'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    send(created.agent, 'after replacement')
    await created.agent.whenIdle()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('keeps one application per request across repeated replacement', async () => {
    const instance = await harness([
      textResponse('one'),
      textResponse('two'),
      textResponse('three'),
    ])
    const { ctx, adapter, agent } = instance
    await ctx.plugin(EffortPolicy, config('low'))
    const spy = vi.spyOn(ctx.effortPolicy, 'applyTo')

    send(agent, 'first')
    await agent.whenIdle()
    for (const [index, text] of ['second', 'third'].entries()) {
      await replaceLlm(instance)
      const created = await ctx.agents.create({
        sessionId: SessionId(`lifecycle-round-${index}`),
        agentOptions: { provider: 'mock', model: 'mock' },
      })
      send(created.agent, text)
      await created.agent.whenIdle()
    }
    expect(adapter.requests.every(request => request.reasoningEffort === 'low')).toBe(true)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('releases a disposed Agent and serves a replacement Agent', async () => {
    const instance = await harness([textResponse('before'), textResponse('after')])
    const { ctx, adapter, agent } = instance
    await ctx.plugin(EffortPolicy, config('low'))
    const spy = vi.spyOn(ctx.effortPolicy, 'applyTo')

    send(agent, 'before disposal')
    await agent.whenIdle()
    expect(spy).toHaveBeenCalledTimes(1)

    await instance.handle.dispose()
    const replacement = await ctx.agents.create({
      sessionId: SessionId('lifecycle-replacement'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    send(replacement.agent, 'after disposal')
    await replacement.agent.whenIdle()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('settles an in-flight application instead of leaving it dangling on disposal', async () => {
    let release = (): void => {}
    const paused = new Promise<void>((resolve) => { release = resolve })
    let entered = (): void => {}
    const started = new Promise<void>((resolve) => { entered = resolve })
    class PausingAdapter extends MockAdapter {
      override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
        entered()
        await paused
        return super.resolveModel(provider, model)
      }
    }
    const ctx = new Context()
    const llm = await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    const adapter = new PausingAdapter([textResponse('settled'), textResponse('after')], REASONING)
    ctx.llm.registerAdapter(['mock'], adapter)
    const handle = await ctx.agents.create({
      sessionId: SessionId('lifecycle-pending'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    const policy = await ctx.plugin(EffortPolicy, config('low'))
    const spy = vi.spyOn(ctx.effortPolicy, 'applyTo')

    send(handle.agent, 'wait for capability')
    await started
    const dispose = policy.dispose()
    release()
    await dispose
    await handle.agent.whenIdle()
    // The paused lookup belonged to the generation that was withdrawn: it settles
    // without rejecting, and it must not keep a listener on the surviving Agent.
    expect(spy).toHaveBeenCalledTimes(1)
    send(handle.agent, 'after teardown')
    await handle.agent.whenIdle()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(llm).toBeDefined()
  })
})
