import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, {
  createUserMessage,
  LlmError,
  ReasoningEffortId,
  type LlmModelReasoningInfo,
} from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { MockAdapter, textResponse } from './mock-adapter.ts'

/** A route whose vocabulary has no `max`. */
const LIMITED: LlmModelReasoningInfo = {
  efforts: [
    { id: ReasoningEffortId('off'), name: 'Off' },
    { id: ReasoningEffortId('low'), name: 'Low' },
  ],
  defaultEffort: ReasoningEffortId('low'),
}

/** A route with no reasoning at all. */
const NO_REASONING: LlmModelReasoningInfo | undefined = undefined

async function harness(adapter: MockAdapter): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter(['mock'], adapter)
  return ctx
}

/** Choose one effort for every request, as middleware or a policy adapter would. */
function forceEffort(ctx: Context, effort: string): void {
  ctx.on('agent/request', async (_payload, next) => ({
    ...await next(),
    reasoningEffort: ReasoningEffortId(effort),
  }))
}

describe('reasoning-effort fallback', () => {
  it('drops an effort the bound route does not advertise instead of failing the turn', async () => {
    const adapter = new MockAdapter([textResponse('done')], LIMITED)
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('effort-fallback'), { provider: 'mock', model: 'mock' })
    forceEffort(ctx, 'max')

    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(1)
    expect(adapter.requests[0]?.reasoningEffort).toBe('low')
    expect(agent.session.requestHeader()?.config.reasoningEffort).toBe('low')
    expect(agent.session.deriveMessages().at(-1)).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: 'done' }],
    })
  })

  it('leaves a supported effort untouched', async () => {
    const adapter = new MockAdapter([textResponse('done')], LIMITED)
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('effort-supported'), { provider: 'mock', model: 'mock' })
    forceEffort(ctx, 'off')

    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
    await agent.whenIdle()

    expect(adapter.requests[0]?.reasoningEffort).toBe('off')
    expect(agent.session.requestHeader()?.config.reasoningEffort).toBe('off')
  })

  it('drops the effort on a route without reasoning metadata', async () => {
    const adapter = new MockAdapter([textResponse('done')], NO_REASONING)
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('effort-no-reasoning'), { provider: 'mock', model: 'mock' })
    forceEffort(ctx, 'low')

    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(1)
    expect(adapter.requests[0]?.reasoningEffort).toBeUndefined()
    expect(agent.session.deriveMessages().at(-1)).toMatchObject({ role: 'assistant' })
  })

  it('still fails the turn for a route the fallback cannot repair', async () => {
    const adapter = new MockAdapter([textResponse('unused')], LIMITED)
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('effort-other-error'), { provider: 'mock', model: 'mock' })
    ctx.on('agent/request', () => {
      throw new LlmError('bad metadata', 'INVALID_MODEL_INFO')
    })

    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
    await agent.whenIdle()

    expect(adapter.requests).toHaveLength(0)
    const last = agent.session.deriveMessages().at(-1)
    expect(last?.role === 'assistant' ? last.content : undefined).toBeUndefined()
  })
})
