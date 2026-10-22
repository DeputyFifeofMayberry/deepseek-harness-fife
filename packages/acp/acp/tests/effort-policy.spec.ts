import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import { SessionId } from '@deepseek-ai/dsh-session'
import EffortPolicy from '@deepseek-ai/dsh-effort-policy'
import type { Config } from '@deepseek-ai/dsh-effort-policy'
import { makeBridgeHarness, textResponse } from './harness.ts'

/** An enabled policy row, as a deployment that routes effort composes it. */
const POLICY: Config = {
  enabled: true,
  baseLevel: 'standard',
  verifiers: [],
  mutators: [],
  readOnlyCommands: [],
  infrastructureFailureCodes: [],
  shellTools: [],
  ignoredArgumentKeys: ['description'],
}

describe('ACP model configuration and the effort policy', () => {
  it('records a picked effort as the policy base and keeps it across resume', async () => {
    const harness = await makeBridgeHarness({ script: [textResponse('first answer')] })
    try {
      await harness.ctx.plugin(EffortPolicy, POLICY)
      await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
      const created = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })

      await harness.client.setSessionConfigOption({
        sessionId: created.sessionId,
        configId: 'reasoning_effort',
        value: 'low',
      })
      const agent = harness.ctx.agents.get(SessionId(created.sessionId))
      if (agent === undefined) throw new Error('expected the ACP session to own an Agent')
      // A level name sets the policy's base, which is what keeps the policy from
      // overwriting the pick on the next request.
      expect(harness.ctx.sessionProjections.stateOf(agent.session, 'effort')).toEqual({ base: 'low' })

      // An advertised effort outside the three levels is an exact base.
      await harness.client.setSessionConfigOption({
        sessionId: created.sessionId,
        configId: 'reasoning_effort',
        value: 'high',
      })
      expect(harness.ctx.sessionProjections.stateOf(agent.session, 'effort')).toMatchObject({ exact: 'high' })

      await harness.client.prompt({
        sessionId: created.sessionId,
        prompt: [{ type: 'text', text: 'first prompt' }],
      })
      expect(harness.adapter.requests.at(-1)?.reasoningEffort).toBe('high')

      await harness.client.closeSession({ sessionId: created.sessionId })
      const resumed = await harness.client.resumeSession({
        sessionId: created.sessionId,
        cwd: process.cwd(),
        mcpServers: [],
      })
      const resumedAgent = harness.ctx.agents.get(SessionId(created.sessionId))
      if (resumedAgent === undefined) throw new Error('expected the resumed session to own an Agent')
      expect(harness.ctx.sessionProjections.stateOf(resumedAgent.session, 'effort')).toMatchObject({ exact: 'high' })
      expect(resumed.configOptions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'reasoning_effort', currentValue: 'high' }),
      ]))
    } finally {
      await harness.dispose()
    }
  })
})
