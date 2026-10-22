import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { SubagentStartRequest } from '@deepseek-ai/dsh-subagent'
import EffortPolicy from '@deepseek-ai/dsh-effort-policy'
import { MockAdapter } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { callSubagent, modelSelectionSetupAgent, setup, text } from './harness.ts'

/** An enabled policy row, as a deployment that routes delegations composes it. */
async function mountPolicy(ctx: Context, enabled = true): Promise<void> {
  await ctx.plugin(EffortPolicy, {
    enabled,
    baseLevel: 'standard',
    verifiers: [],
    mutators: [],
    readOnlyCommands: [],
    infrastructureFailureCodes: [],
    shellTools: [],
    ignoredArgumentKeys: ['description'],
  })
}

/** The parameter names the model can see for the mounted `subagent` tool. */
function parameterNames(ctx: Context): string[] {
  const schema = ctx.tools.schemas().find(entry => entry.name === 'subagent')
  if (schema === undefined) throw new Error('the subagent tool is not registered')
  const parameters = schema.parameters as { readonly properties?: Record<string, unknown> }
  return Object.keys(parameters.properties ?? {})
}

describe('delegation effort policy', () => {
  it('offers the effort fields and stamps the operation on the child', async () => {
    const seen: AgentOptions[] = []
    const ctx = await setup({ provider: 'mock', effortPolicy: true }, {
      onStart: (request: SubagentStartRequest) => {
        if (request.agentOptions !== undefined) seen.push(request.agentOptions)
      },
    })
    await mountPolicy(ctx)

    expect(parameterNames(ctx)).toEqual(expect.arrayContaining(['operation', 'verification', 'inherit_effort']))
    const result = await callSubagent(ctx, { description: 'review the plan', prompt: 'review it', operation: 'plan' })
    expect(result.isError).toBe(false)
    expect(seen[0]).toMatchObject({ effortOperation: 'plan', effortInherited: false })
  })

  it('records inherit_effort on the child', async () => {
    const seen: AgentOptions[] = []
    const ctx = await setup({ provider: 'mock', effortPolicy: true }, {
      onStart: (request: SubagentStartRequest) => {
        if (request.agentOptions !== undefined) seen.push(request.agentOptions)
      },
    })
    await mountPolicy(ctx)

    await callSubagent(ctx, {
      description: 'explore options',
      prompt: 'explore',
      operation: 'explore',
      inherit_effort: true,
    })
    expect(seen[0]).toMatchObject({ effortOperation: 'explore', effortInherited: true })
  })

  it('fails the first delegation when the policy row is absent', async () => {
    const ctx = await setup({ provider: 'mock', effortPolicy: true })
    const result = await callSubagent(ctx, { description: 'd', prompt: 'p', operation: 'general' })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('effortPolicy: true')
    expect(text(result)).toContain('enabled: true')
  })

  it('fails the first delegation when the policy row is disabled', async () => {
    const ctx = await setup({ provider: 'mock', effortPolicy: true })
    await mountPolicy(ctx, false)
    const result = await callSubagent(ctx, { description: 'd', prompt: 'p', operation: 'general' })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('disabled')
  })

  it('leaves the schema and the child untouched when the flag is off', async () => {
    const seen: AgentOptions[] = []
    const ctx = await setup({ provider: 'mock' }, {
      onStart: (request: SubagentStartRequest) => {
        if (request.agentOptions !== undefined) seen.push(request.agentOptions)
      },
    })
    await mountPolicy(ctx)

    const names = parameterNames(ctx)
    expect(names).not.toContain('operation')
    expect(names).not.toContain('inherit_effort')
    const result = await callSubagent(ctx, { description: 'd', prompt: 'p' })
    expect(result.isError).toBe(false)
    expect(seen[0]?.effortOperation).toBeUndefined()
    expect(seen[0]?.effortInherited).toBeUndefined()
  })

  it('leaves everything unchanged when neither the flag nor the policy is present', async () => {
    const seen: AgentOptions[] = []
    const ctx = await setup({ provider: 'mock' }, {
      onStart: (request: SubagentStartRequest) => {
        if (request.agentOptions !== undefined) seen.push(request.agentOptions)
      },
    })
    const result = await callSubagent(ctx, { description: 'd', prompt: 'p' })
    expect(result.isError).toBe(false)
    expect(seen[0]?.effortOperation).toBeUndefined()
    expect(parameterNames(ctx)).not.toContain('operation')
  })

  it('requires verification for mechanical work', async () => {
    const ctx = await setup({ provider: 'mock', effortPolicy: true })
    await mountPolicy(ctx)

    const missing = await callSubagent(ctx, { description: 'd', prompt: 'p', operation: 'mechanical' })
    expect(missing.isError).toBe(true)
    expect(text(missing)).toContain('requires `verification`')

    const blank = await callSubagent(ctx, {
      description: 'd', prompt: 'p', operation: 'mechanical', verification: '   ',
    })
    expect(blank.isError).toBe(true)

    const provided = await callSubagent(ctx, {
      description: 'd', prompt: 'p', operation: 'mechanical', verification: 'npm test',
    })
    expect(provided.isError).toBe(false)
  })

  it('rejects a level pick below the operation minimum', async () => {
    const ctx = await setup({
      provider: 'mock',
      effortPolicy: true,
      withModelSelection: true,
      parentAgentOptions: { provider: 'alpha', model: 'child-model' },
      maxDepth: 'provider-managed',
    })
    await mountPolicy(ctx)
    ctx.llm.registerAdapter(['alpha'], new MockAdapter([], {
      efforts: [
        { id: ReasoningEffortId('low'), name: 'Low' },
        { id: ReasoningEffortId('high'), name: 'High' },
      ],
      defaultEffort: ReasoningEffortId('high'),
    }))
    const parent = modelSelectionSetupAgent(ctx)

    const tooLow = await callSubagent(ctx, {
      description: 'd', prompt: 'p', operation: 'plan', reasoning_effort: 'low',
    }, { agent: parent })
    expect(tooLow.isError).toBe(true)
    expect(text(tooLow)).toContain('operation minimum "deep"')

    const atMinimum = await callSubagent(ctx, {
      description: 'd', prompt: 'p', operation: 'mechanical', reasoning_effort: 'low', verification: 'npm test',
    }, { agent: parent })
    expect(atMinimum.isError).toBe(false)
  })
})
