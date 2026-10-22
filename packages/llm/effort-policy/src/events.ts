/**
 * The one durable record this policy writes, and the projection that folds it
 * into per-Session state. The record carries the complete next state so replay
 * is a replacement rather than a second implementation of the rules.
 * @module @deepseek-ai/dsh-effort-policy/events
 */

import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { EFFORT_POLICY_PROTOCOL_VERSION } from '@mayberry/effort-policy-core'
import type { DecisionRule, EffortLevel } from '@mayberry/effort-policy-core'
import { z as zod } from 'zod'

/** Durable policy state for one Session: the last base choice and the open failure. */
export interface EffortStateRecord {
  /** User-selected or configured base level, when one was recorded. */
  base?: EffortLevel | undefined
  /** User-selected exact effort, written verbatim and never escalated. */
  exact?: string | undefined
  /** Monotonic observation order at the last transition; survives resume. */
  sequence?: number | undefined
  /** Workspace mutation counter at the last transition; survives resume. */
  revision?: number | undefined
  /** The verification failure that keeps the level raised. */
  openFailure?: {
    /** Verifier identity that failed. */
    verifier: string
    /** Observation order of the failure. */
    sequence: number
    /** Workspace revision at the failure. */
    revision: number
  } | undefined
}

/** Payload of one `effort/decision` record: why the state changed. */
export interface EffortDecisionRecord extends EffortStateRecord {
  /** Protocol version of the decision data that produced this state. */
  protocolVersion: number
  /** Rule that produced the transition. */
  rule: DecisionRule
  /** Automatic level in effect after the transition, when one applies. */
  level?: EffortLevel
  /** Exact effort in effect after the transition, when one applies. */
  effort?: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Log-only record of a policy transition: a raised or cleared escalation, or
     * a user base change. Purely informational for readers; the effective
     * effort of a request is already carried by `request/header`.
     */
    'effort/decision': EffortDecisionRecord
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Durable effort-policy state for one Session. */
    effort: EffortStateRecord
  }
}

/**
 * Validates persisted projection state before it seeds a fold, and validates a
 * live read before the policy decides from it: an unreadable record must not be
 * mistaken for base state.
 */
export const effortStateSchema = zod.object({
  sequence: zod.number().optional(),
  revision: zod.number().optional(),
  base: zod.union([zod.literal('low'), zod.literal('standard'), zod.literal('deep')]).optional(),
  exact: zod.string().optional(),
  openFailure: zod.object({
    verifier: zod.string(),
    sequence: zod.number(),
    revision: zod.number(),
  }).strict().optional(),
}).strict()

/** Folds `effort/decision` records into the Session's current policy state. */
export const effortProjectionDefinition = {
  key: 'effort',
  stateVersion: 1,
  stateSchema: effortStateSchema,
  init: () => ({}),
  apply: (state, event) => {
    if (event.type !== 'effort/decision') return state
    const { protocolVersion: _version, rule: _rule, level: _level, effort: _effort, ...next } = event.data
    return next
  },
} satisfies ProjectionDefinition<'effort', EffortStateRecord>

/**
 * The state fields of a decision record.
 * @param record - a decision record.
 * @returns its durable state, without the audit fields.
 */
export function stateOfRecord(record: EffortDecisionRecord): EffortStateRecord {
  const { protocolVersion: _protocol, rule: _rule, level: _level, effort: _effort, ...state } = record
  return state
}

/**
 * Build one decision record.
 * @param state - the durable state after the transition.
 * @param rule - the rule that produced it.
 * @param resolved - the resolved effort, when one was written.
 * @returns the record to append.
 */
export function decisionRecord(
  state: EffortStateRecord,
  rule: DecisionRule,
  resolved?: { readonly level?: EffortLevel; readonly effort?: string },
): EffortDecisionRecord {
  return {
    protocolVersion: EFFORT_POLICY_PROTOCOL_VERSION,
    rule,
    ...resolved?.level === undefined ? {} : { level: resolved.level },
    ...resolved?.effort === undefined ? {} : { effort: resolved.effort },
    ...state,
  }
}
