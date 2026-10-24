/**
 * Package entry: the portable core, the validated configuration, and the
 * default-exported Cordis service the Loader composes.
 * @module @deepseek-ai/dsh-effort-policy
 */

export * from './core.ts'
export * from './config.ts'
export * from './agent-options.ts'
export {
  EffortPolicy,
  EffortPolicyUnavailableError,
  isEffortLevel,
  type StartChoice,
  EffortPolicy as default,
} from './service.ts'
