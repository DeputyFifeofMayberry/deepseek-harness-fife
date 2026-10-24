/**
 * The delegation fields this policy reads from an Agent's creation options.
 * They live here because the policy owns the operation vocabulary; a host that
 * composes this policy gets the fields, and one that does not is unaffected.
 * @module @deepseek-ai/dsh-effort-policy/agent-options
 */

import type { DelegationOperation } from '@mayberry/effort-policy-core'

declare module '@deepseek-ai/dsh-agent' {
  interface AgentOptions {
    /**
     * What a delegated child is being asked to do. It fixes the child's starting
     * level when the child declares no effort of its own: `plan`/`review` start
     * `deep`, `mechanical` starts `low`, and everything else starts `standard`.
     */
    effortOperation?: DelegationOperation
    /**
     * Whether the child inherits the parent's reasoning effort. `false` means
     * the child starts from its operation instead; the delegating manager
     * removes the inherited effort before creation.
     */
    effortInherited?: boolean
  }
}

export {}
