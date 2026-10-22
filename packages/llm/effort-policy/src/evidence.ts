/**
 * Evidence classification: turn one settled tool result into a verification
 * outcome or a workspace mutation. Pure functions over plain data.
 * @module @deepseek-ai/dsh-effort-policy/evidence
 */

import { TOOL_ABORTED, TOOL_ABORTED_BEFORE_DISPATCH } from '@deepseek-ai/dsh-tools'
import type { ResolvedConfig, VerifierRule } from './config.ts'

/**
 * Failure codes that always mean the check did not run, whatever the deployment
 * configures: a cancelled execution proves nothing about the workspace, so it
 * must never raise effort.
 */
const CANCELLATION_CODES: ReadonlySet<string> = new Set([TOOL_ABORTED, TOOL_ABORTED_BEFORE_DISPATCH])

/** One settled tool result, reduced to what classification needs. */
export interface ToolOutcome {
  /** Registered tool name. */
  readonly tool: string
  /**
   * Serialized arguments used for pattern matching and identity, with the
   * deployment's presentation-only keys already removed.
   */
  readonly argumentsText: string
  /**
   * Directory the call ran in. Two runs of the same command in different
   * directories are different checks: one may pass while the other fails.
   */
  readonly workingDirectory: string
  /** Model-facing text of the settled result. */
  readonly text: string
  /** Whether the tool reported an error. */
  readonly isError: boolean
  /** Structured failure code, when the tool reported one. */
  readonly failureCode?: string
}

/** What one result means for the policy's revision or its open escalation. */
export type OutcomeClass =
  | 'verification-failure'
  | 'verification-pass'
  | 'infrastructure'
  | 'mutation'
  | 'ignored'

/**
 * The identity of one verifier run: the tool, its exact arguments, and the
 * directory it ran in. An escalation is a claim about that exact check in that
 * exact place, so a pass can only be evidence about the same triple.
 * @param outcome - the settled result.
 * @returns a stable verifier identity.
 */
export function verifierIdentity(outcome: ToolOutcome): string {
  return `${outcome.tool}\u0000${outcome.argumentsText}\u0000${outcome.workingDirectory}`
}

/**
 * Classify one settled tool result.
 *
 * A configured verifier decides pass or failure; an error from a text verifier
 * is infrastructure, because the check did not run. An error-signalled verifier
 * reads the error flag instead, except for a failure code the deployment
 * configured as an infrastructure category or the fixed cancellation codes.
 * A configured mutator and an unrecognized shell command change the workspace;
 * a shell command matching a read-only pattern does not. Anything else is
 * ignored.
 *
 * @param config - validated policy configuration.
 * @param outcome - the settled result.
 * @returns its class.
 */
export function classifyOutcome(config: ResolvedConfig, outcome: ToolOutcome): OutcomeClass {
  const verifier = config.verifiers.find(rule => matchesVerifier(rule, outcome.argumentsText)
    && rule.tool === outcome.tool)
  if (verifier !== undefined) return classifyVerifier(config, verifier, outcome)
  if (config.mutators.includes(outcome.tool)) return 'mutation'
  if (config.shellTools.includes(outcome.tool)) {
    const readOnly = config.readOnlyCommands.some(pattern => new RegExp(pattern).test(outcome.argumentsText))
    return readOnly ? 'ignored' : 'mutation'
  }
  return 'ignored'
}

/**
 * Whether a verifier rule applies to one invocation.
 * @param rule - configured verifier.
 * @param argumentsText - serialized tool arguments.
 * @returns whether the rule's command pattern matches (an empty pattern matches any).
 */
function matchesVerifier(rule: VerifierRule, argumentsText: string): boolean {
  return rule.commandPattern.length === 0 || new RegExp(rule.commandPattern).test(argumentsText)
}

/**
 * Whether a reported failure code is an infrastructure category.
 * @param config - validated policy configuration.
 * @param code - structured failure code, when the tool reported one.
 * @returns whether the code means a recovery problem rather than a failed check.
 */
function isInfrastructureCode(config: ResolvedConfig, code: string | undefined): boolean {
  if (code === undefined) return false
  return CANCELLATION_CODES.has(code) || config.infrastructureFailureCodes.includes(code)
}

/**
 * Decide one verifier's outcome.
 * @param config - validated policy configuration.
 * @param rule - the matching verifier.
 * @param outcome - the settled result.
 * @returns pass, failure, or infrastructure.
 */
function classifyVerifier(config: ResolvedConfig, rule: VerifierRule, outcome: ToolOutcome): OutcomeClass {
  if (isInfrastructureCode(config, outcome.failureCode)) return 'infrastructure'
  if (rule.outcome === 'error') return outcome.isError ? 'verification-failure' : 'verification-pass'
  if (outcome.isError) return 'infrastructure'
  if (rule.failPattern.length > 0 && new RegExp(rule.failPattern).test(outcome.text)) return 'verification-failure'
  return new RegExp(rule.passPattern).test(outcome.text) ? 'verification-pass' : 'infrastructure'
}
