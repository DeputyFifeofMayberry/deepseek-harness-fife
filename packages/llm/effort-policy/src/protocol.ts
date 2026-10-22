/**
 * The core protocol this adapter implements. The decision vocabulary lives in
 * `@mayberry/effort-policy-core`, so a core that changed a level rule, an
 * operation minimum, or a decision field writes records this adapter would
 * misread; the mismatch is refused while the package loads, not at the first
 * request.
 * @module @deepseek-ai/dsh-effort-policy/protocol
 */

import { EFFORT_POLICY_PROTOCOL_VERSION } from '@mayberry/effort-policy-core'

/** Protocol version this adapter writes into `effort/decision` records. */
export const SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION = 1

/**
 * Refuse a core whose protocol this adapter does not implement.
 * @param version - `EFFORT_POLICY_PROTOCOL_VERSION` exported by the installed core.
 * @throws when the version differs from the one this adapter writes.
 */
export function assertCoreProtocol(version: number): void {
  if (version === SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION) return
  throw new Error(
    `effort-policy: the installed @mayberry/effort-policy-core implements protocol ${version}, `
    + `but this adapter writes protocol ${SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION}; `
    + 'install the core version this adapter was built against',
  )
}

assertCoreProtocol(EFFORT_POLICY_PROTOCOL_VERSION)
