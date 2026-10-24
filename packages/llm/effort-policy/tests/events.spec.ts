import { describe, expect, it } from 'vitest'
import { decisionRecord, stateOfRecord } from '../src/events.ts'
import { EFFORT_POLICY_PROTOCOL_VERSION } from '@mayberry/effort-policy-core'

describe('decisionRecord', () => {
  it('carries the protocol version and the rule that produced the state', () => {
    const record = decisionRecord({ base: 'low' }, 'base')
    expect(record).toEqual({ protocolVersion: EFFORT_POLICY_PROTOCOL_VERSION, rule: 'base', base: 'low' })
  })

  it('records an open failure and the resolved effort when one was written', () => {
    const record = decisionRecord(
      { base: 'low', openFailure: { verifier: 'pwsh\0npm test', sequence: 2, revision: 5 } },
      'escalated',
      { level: 'standard', effort: 'high' },
    )
    expect(record.rule).toBe('escalated')
    expect(record.level).toBe('standard')
    expect(record.effort).toBe('high')
    expect(record.openFailure?.revision).toBe(5)
  })
})

describe('stateOfRecord', () => {
  it('drops the audit fields and keeps only durable state', () => {
    const record = decisionRecord({ base: 'deep', exact: 'max' }, 'exact-base', { effort: 'max' })
    expect(stateOfRecord(record)).toEqual({ base: 'deep', exact: 'max' })
  })
})
