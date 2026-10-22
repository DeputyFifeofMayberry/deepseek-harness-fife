import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, {
  createUserMessage,
  ReasoningEffortId,
  type LlmModelReasoningInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import EffortPolicy from '../src/index.ts'
import type { Config } from '../src/config.ts'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const REASONING: LlmModelReasoningInfo = {
  efforts: [
    { id: ReasoningEffortId('off'), name: 'Off' },
    { id: ReasoningEffortId('low'), name: 'Low' },
    { id: ReasoningEffortId('high'), name: 'High' },
    { id: ReasoningEffortId('max'), name: 'Max' },
  ],
  defaultEffort: ReasoningEffortId('high'),
}

function config(overrides: Partial<Config> = {}): Config {
  return {
    enabled: true,
    baseLevel: 'standard',
    verifiers: [{
      tool: 'verify',
      commandPattern: '',
      passPattern: 'all good',
      failPattern: 'broken',
      outcome: 'text',
    }, {
      tool: 'other',
      commandPattern: '',
      passPattern: 'all good',
      failPattern: 'broken',
      outcome: 'text',
    }],
    mutators: ['write', 'edit'],
    readOnlyCommands: [],
    infrastructureFailureCodes: [],
    shellTools: ['bash', 'pwsh'],
    ignoredArgumentKeys: ['description'],
    ...overrides,
  }
}

interface Harness {
  readonly ctx: Context
  readonly adapter: MockAdapter
  readonly agent: Agent
  readonly outputs: string[]
}

async function harness(
  script: StreamChunk[][],
  overrides: Partial<Config> = {},
  outputs: string[] = ['broken'],
  makeAdapter: (script: StreamChunk[][]) => MockAdapter = subject => new MockAdapter(subject, REASONING),
): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  const adapter = makeAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  await ctx.plugin(EffortPolicy, config(overrides))
  let call = 0
  ctx.tools.register(defineContentToolFixture({
    name: 'verify',
    description: 'run the configured check',
    parameters: {},
    execute: async () => {
      const text = outputs[Math.min(call, outputs.length - 1)] ?? 'broken'
      call += 1
      return [{ type: 'text', text }]
    },
  }))
  const handle = await ctx.agents.create({
    sessionId: SessionId(`effort-${String(Math.random()).slice(2, 8)}`),
    agentOptions: { provider: 'mock', model: 'mock' },
  })
  return { ctx, adapter, agent: handle.agent, outputs }
}

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}

function send(agent: Agent, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
}

describe('M3 runtime: production tool dispatch drives the policy', () => {
  it('escalates after a real failing verifier and clears after a passing one', async () => {
    const script = [
      toolCallResponse('call-1', 'verify', {}),
      textResponse('first turn done'),
      textResponse('second turn done'),
      toolCallResponse('call-2', 'verify', {}),
      textResponse('third turn done'),
      textResponse('fourth turn done'),
    ]
    const { ctx, adapter, agent } = await harness(script, {}, ['broken', 'all good'])

    send(agent, 'run the check')
    await waitForIdle(ctx, agent)
    expect(ctx.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeDefined()

    send(agent, 'next turn')
    await waitForIdle(ctx, agent)
    const elevated = adapter.requests.at(-1)
    expect(elevated?.provider).toBe('mock')
    expect(elevated?.model).toBe('mock')
    expect(elevated?.reasoningEffort).toBe('max')

    send(agent, 'run the check again')
    await waitForIdle(ctx, agent)
    expect(ctx.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeUndefined()
    // The continuation request of the recovering turn is the first request that
    // must be back at the adapter default.
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('high')

    send(agent, 'after recovery')
    await waitForIdle(ctx, agent)
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('high')
  })

  it('keeps an escalation when an unrelated verifier passes afterwards', async () => {
    const script = [
      toolCallResponse('call-1', 'verify', {}),
      textResponse('done'),
      toolCallResponse('call-2', 'other', {}),
      textResponse('other done'),
      textResponse('next'),
    ]
    const { ctx, adapter, agent } = await harness(script)
    ctx.tools.register(defineContentToolFixture({
      name: 'other',
      description: 'unrelated check',
      parameters: {},
      execute: async () => [{ type: 'text', text: 'all good' }],
    }))
    send(agent, 'run the check that fails')
    await waitForIdle(ctx, agent)
    expect(ctx.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeDefined()
    // The continuation request of the failing turn is the first request that
    // must already carry the escalated effort.
    expect(adapter.requests.map(request => request.reasoningEffort)).toEqual(['high', 'max'])
    send(agent, 'run the unrelated check')
    await waitForIdle(ctx, agent)
    expect(ctx.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeDefined()
    expect(adapter.requests.map(request => request.reasoningEffort)).toEqual(['high', 'max', 'max', 'max'])
    send(agent, 'next')
    await waitForIdle(ctx, agent)
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('max')
  })

  it('does nothing while the policy is disabled', async () => {
    const script = [
      toolCallResponse('call-1', 'verify', {}),
      textResponse('done'),
      textResponse('next'),
    ]
    const { ctx, adapter, agent } = await harness(script, { enabled: false })
    send(agent, 'run the check')
    await waitForIdle(ctx, agent)
    expect(ctx.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeUndefined()
    send(agent, 'next')
    await waitForIdle(ctx, agent)
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('high')
  })

  it('keeps escalation per Session', async () => {
    const script = [
      toolCallResponse('call-1', 'verify', {}),
      textResponse('done'),
      textResponse('other session'),
    ]
    const { ctx, adapter, agent } = await harness(script)
    send(agent, 'run the check')
    await waitForIdle(ctx, agent)
    const sibling = await ctx.agents.create({
      sessionId: SessionId('effort-sibling'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    send(sibling.agent, 'unrelated work')
    await waitForIdle(ctx, sibling.agent)
    expect(ctx.sessionProjections.stateOf(sibling.agent.session, 'effort')?.openFailure).toBeUndefined()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('high')
  })

  it('starts a delegated child at its operation level', async () => {
    const script = [textResponse('plan'), textResponse('mechanical')]
    const { ctx, adapter } = await harness(script, { verifiers: [] })
    const planned = await ctx.agents.create({
      sessionId: SessionId('effort-child-plan'),
      agentOptions: { provider: 'mock', model: 'mock', effortOperation: 'plan' },
    })
    send(planned.agent, 'plan the work')
    await waitForIdle(ctx, planned.agent)
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('max')

    const mechanical = await ctx.agents.create({
      sessionId: SessionId('effort-child-mechanical'),
      agentOptions: { provider: 'mock', model: 'mock', effortOperation: 'mechanical' },
    })
    send(mechanical.agent, 'run the script')
    await waitForIdle(ctx, mechanical.agent)
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
  })

  it('lets a child effort the delegating tool named win over its operation', async () => {
    const script = [textResponse('child')]
    const { ctx, adapter } = await harness(script, { verifiers: [] })
    const child = await ctx.agents.create({
      sessionId: SessionId('effort-child-explicit'),
      agentOptions: {
        provider: 'mock',
        model: 'mock',
        effortOperation: 'plan',
        reasoningEffort: ReasoningEffortId('low'),
      },
    })
    send(child.agent, 'review it cheaply')
    await waitForIdle(ctx, child.agent)
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('low')
  })

  it('does not carry a parent escalation into a delegated child', async () => {
    const script = [
      toolCallResponse('call-1', 'verify', {}),
      textResponse('parent done'),
      textResponse('child done'),
    ]
    const { ctx, adapter, agent: parent } = await harness(script)
    send(parent, 'run the check that fails')
    await waitForIdle(ctx, parent)
    expect(ctx.sessionProjections.stateOf(parent.session, 'effort')?.openFailure).toBeDefined()

    const child = await ctx.agents.create({
      sessionId: SessionId('effort-child-of-escalated'),
      agentOptions: { provider: 'mock', model: 'mock', effortOperation: 'general' },
    })
    send(child.agent, 'independent work')
    await waitForIdle(ctx, child.agent)
    // The child starts at its own operation, not at the parent's raised level.
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('high')
    expect(ctx.sessionProjections.stateOf(child.agent.session, 'effort')?.openFailure).toBeUndefined()
    // The parent is still raised: a child's outcome does not clear it either.
    expect(adapter.requests.at(-2)?.reasoningEffort).toBe('max')
  })

  it('adds exactly one capability lookup per request', async () => {
    const script = [textResponse('one'), textResponse('two')]
    const { ctx, adapter, agent } = await harness(script, { verifiers: [] })
    const lookups = vi.spyOn(adapter, 'resolveModel')
    send(agent, 'first')
    await waitForIdle(ctx, agent)
    // One for the policy's decision and one for the loop's own request
    // preparation: the policy adds a lookup, it does not replace or repeat it.
    expect(lookups).toHaveBeenCalledTimes(2)
    lookups.mockClear()
    send(agent, 'second')
    await waitForIdle(ctx, agent)
    expect(lookups).toHaveBeenCalledTimes(2)
  })

  it('adds no capability lookup while disabled', async () => {
    const script = [textResponse('one')]
    const { ctx, adapter, agent } = await harness(script, { enabled: false, verifiers: [] })
    const lookups = vi.spyOn(adapter, 'resolveModel')
    send(agent, 'first')
    await waitForIdle(ctx, agent)
    expect(lookups).toHaveBeenCalledTimes(1)
  })

  it('falls back to the route default when the route shrinks between its lookup and dispatch', async () => {
    // The first lookup (the policy's) advertises `max`; every later lookup (the
    // loop's own bind) drops it, exactly as an adapter registration swap would.
    class ShrinkingAdapter extends MockAdapter {
      lookups = 0

      override async resolveModel(provider: string, model: string) {
        this.lookups += 1
        return {
          provider,
          id: model,
          name: model,
          reasoning: this.lookups === 1
            ? REASONING
            : {
              efforts: [
                { id: ReasoningEffortId('low'), name: 'Low' },
                { id: ReasoningEffortId('high'), name: 'High' },
              ],
              defaultEffort: ReasoningEffortId('high'),
            },
        }
      }
    }
    const { ctx, adapter, agent } = await harness(
      [textResponse('done')],
      { baseLevel: 'deep', verifiers: [] },
      ['broken'],
      script => new ShrinkingAdapter(script),
    )
    send(agent, 'go')
    await waitForIdle(ctx, agent)
    expect(adapter.requests).toHaveLength(1)
    // `max` was dropped rather than failing the turn, and the header records
    // what was actually dispatched.
    expect(adapter.requests[0]?.reasoningEffort).toBe('high')
    expect(agent.session.requestHeader()?.config.reasoningEffort).toBe('high')
  })
})
