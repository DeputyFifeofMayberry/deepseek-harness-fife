import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION,
  assertCoreProtocol,
} from '../src/protocol.ts'

describe('core protocol refusal', () => {
  it('accepts the protocol this adapter writes', () => {
    expect(() => { assertCoreProtocol(SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION) }).not.toThrow()
  })

  it('refuses a core whose protocol differs, naming both versions', () => {
    const other = SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION + 1
    expect(() => { assertCoreProtocol(other) }).toThrow(
      new RegExp(`core implements protocol ${String(other)}, but this adapter writes protocol ${String(SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION)}`),
    )
  })
})
