/**
 * Validated deployment configuration for the effort policy. Every tunable the
 * plan names is a field here; nothing policy-relevant is a constant.
 * @module @deepseek-ai/dsh-effort-policy/config
 */

import z from '@deepseek-ai/schemastery'
import type { EffortLevel } from '@mayberry/effort-policy-core'

/** How one verifier's result is read: its text, or the tool's error flag. */
export interface VerifierRule {
  /** Tool name that performs the check. */
  tool: string
  /** Regular expression source matched against the normalized arguments; empty matches any. */
  commandPattern: string
  /** Regular expression source whose match means the check passed. */
  passPattern: string
  /** Regular expression source whose match means the check failed; empty means none. */
  failPattern: string
  /** Which part of the settled result the patterns read. */
  outcome: 'text' | 'error'
}

/** Deployment configuration before validation. */
export interface Config {
  /** Whether the policy may write requests at all. */
  enabled: boolean
  /** Level a session runs at when the user selects none. */
  baseLevel: EffortLevel
  /** Checks that may raise or clear an escalation. */
  verifiers: VerifierRule[]
  /** Tools whose result changes the workspace. */
  mutators: string[]
  /** Shell command patterns known to be read-only; anything unmatched counts as a mutation. */
  readOnlyCommands: string[]
  /**
   * Argument keys that label a call without changing what it does. They are
   * removed from the arguments used for pattern matching and for evidence
   * identity, so retitling the same check does not open a second check.
   */
  ignoredArgumentKeys: string[]
  /** Failure categories that are recovery problems, not reasoning problems. */
  infrastructureFailureCodes: string[]
  /** Tools that execute an arbitrary command, whose unrecognized runs count as mutations. */
  shellTools: string[]
}

/** Validated, immutable configuration. */
export interface ResolvedConfig {
  /** Whether the policy may write requests at all. */
  readonly enabled: boolean
  /** Level a session runs at when the user selects none. */
  readonly baseLevel: EffortLevel
  /** Checks that may raise or clear an escalation. */
  readonly verifiers: readonly VerifierRule[]
  /** Tools whose result changes the workspace. */
  readonly mutators: readonly string[]
  /** Shell command patterns known to be read-only. */
  readonly readOnlyCommands: readonly string[]
  /** Argument keys removed before pattern matching and identity. */
  readonly ignoredArgumentKeys: readonly string[]
  /** Failure categories that are recovery problems. */
  readonly infrastructureFailureCodes: readonly string[]
  /** Tools that execute an arbitrary command. */
  readonly shellTools: readonly string[]
}

/** Level values accepted by the schema and by `setBase`. */
const LEVEL = z.union([z.const('low' as const), z.const('standard' as const), z.const('deep' as const)])

/** Loader-validated configuration; every field has a default so a bare row mounts disabled. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(false),
  baseLevel: LEVEL.default('standard'),
  verifiers: z.array(z.object({
    tool: z.string(),
    commandPattern: z.string().default(''),
    passPattern: z.string(),
    failPattern: z.string().default(''),
    outcome: z.union([z.const('text' as const), z.const('error' as const)]).default('text'),
  })).default([]),
  mutators: z.array(z.string()).default(['write', 'edit']),
  readOnlyCommands: z.array(z.string()).default([]),
  ignoredArgumentKeys: z.array(z.string()).default(['description']),
  infrastructureFailureCodes: z.array(z.string()).default([]),
  shellTools: z.array(z.string()).default(['bash', 'pwsh']),
})

/**
 * Reject a configuration the policy cannot honor. Pattern sources are compiled
 * here so a deployment learns about a malformed expression at load rather than
 * at the first verification.
 * @param config - validated configuration from the loader.
 * @returns detached immutable configuration.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  for (const rule of config.verifiers) {
    compile(rule.commandPattern, `verifier "${rule.tool}" commandPattern`)
    compile(rule.passPattern, `verifier "${rule.tool}" passPattern`)
    compile(rule.failPattern, `verifier "${rule.tool}" failPattern`)
    if (rule.tool.length === 0) throw new Error('effort-policy: a verifier needs a tool name')
    if (rule.outcome === 'text' && rule.passPattern.length === 0) {
      throw new Error(`effort-policy: verifier "${rule.tool}" needs a passPattern`)
    }
    if (rule.outcome === 'error' && rule.failPattern.length > 0) {
      throw new Error(`effort-policy: verifier "${rule.tool}" reads the error flag and cannot use failPattern`)
    }
  }
  for (const pattern of config.readOnlyCommands) compile(pattern, 'readOnlyCommands pattern')
  return Object.freeze({
    enabled: config.enabled,
    baseLevel: config.baseLevel,
    verifiers: Object.freeze(config.verifiers.map(rule => Object.freeze({ ...rule }))),
    mutators: Object.freeze([...config.mutators]),
    readOnlyCommands: Object.freeze([...config.readOnlyCommands]),
    ignoredArgumentKeys: Object.freeze([...config.ignoredArgumentKeys]),
    infrastructureFailureCodes: Object.freeze([...config.infrastructureFailureCodes]),
    shellTools: Object.freeze([...config.shellTools]),
  })
}

/**
 * Compile one pattern source, naming it in the failure. An empty source is not a pattern.
 * @param source - regular expression source, when configured.
 * @param name - field name reported on failure.
 * @returns nothing.
 */
function compile(source: string, name: string): void {
  if (source.length === 0) return
  try {
    new RegExp(source)
  } catch (error) {
    throw new Error(`effort-policy: ${name} is not a valid regular expression: ${String(error)}`)
  }
}
