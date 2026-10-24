/**
 * Durable parent-side attribution of provider usage a child epoch incurred.
 *
 * A subagent's tokens are billed to the account but settle in the child's own
 * Session log, which the parent never folds. Recording the epoch's route-bucketed
 * usage on the parent keeps the delegating conversation's usage and spend reading
 * equal to what the account was charged, without re-reading child logs.
 *
 * @module @deepseek-ai/dsh-subagent/delegated-usage
 */

import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'

/** Payload version emitted for a local child epoch. */
export const SUBAGENT_USAGE_VERSION = 0

/** Provider usage one route accrued inside the reporting epoch. */
export interface DelegatedUsageRoute {
  readonly provider: string
  readonly model: string
  /** Adapter-owned effort id; empty means the provider default. */
  readonly reasoningEffort: string
  readonly uncachedInputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

/**
 * Provider usage a delegating parent is charged for.
 *
 * `routes` holds only nonzero samples. Each epoch reports exactly the suffix it
 * ran, so resuming a continuable child adds its later epochs without
 * double-counting. Entries already attributed by a deeper level are folded into
 * the reporting epoch, so the root parent sees the complete tree.
 */
export interface SubagentUsageEvent {
  readonly version: typeof SUBAGENT_USAGE_VERSION
  readonly childId: SessionId
  readonly routes: readonly DelegatedUsageRoute[]
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Provider usage one delegating parent was charged for on behalf of `childId`.
     * @param data - versioned route-bucketed attribution.
     */
    'subagent/usage': SubagentUsageEvent
  }
}

/** Route a request used, as the child's own `request/header` named it. */
interface RouteIdentity {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort: string
}

/** Provider counters for one settled step. */
interface UsageSample {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

/** One counted step: its route and its latest provider settlement. */
interface CountedStep {
  readonly identity: RouteIdentity
  readonly usage: UsageSample
}

/** Identity key for one route. */
function identityKey(identity: RouteIdentity): string {
  return `${identity.provider}\u0000${identity.model}\u0000${identity.reasoningEffort}`
}

/**
 * Accumulate one epoch's provider usage into route buckets.
 *
 * Steps are keyed by `(turn, step)` and replaced by a later settlement of the same
 * step, matching the projection that counts a retried step once. `request/header`
 * selects the route for later `assistant/message` settlements, and a nested
 * `subagent/usage` record keeps its own routes so a grandchild's spend reaches the
 * root.
 * @param events - one epoch's own event suffix, in log order.
 * @returns nonzero route buckets in first-seen order.
 */
export function delegatedUsageRoutes(events: readonly SessionEvent[]): DelegatedUsageRoute[] {
  const steps = new Map<string, CountedStep>()
  const delegated: DelegatedUsageRoute[] = []
  let current: RouteIdentity | undefined

  const count = (identity: RouteIdentity, key: string, usage: UsageSample): void => {
    steps.delete(key)
    steps.set(key, { identity, usage })
  }

  for (const event of events) {
    switch (event.type) {
      case 'request/header': {
        const config = event.data.header.config
        current = {
          provider: config.provider,
          model: config.model,
          reasoningEffort: config.reasoningEffort ?? '',
        }
        break
      }
      case 'assistant/message': {
        const usage = event.data.usage
        if (current !== undefined && usage !== undefined) {
          count(current, `${event.data.turn}:${event.data.step}`, usage)
        }
        break
      }
      case 'subagent/usage': {
        delegated.push(...event.data.routes)
        break
      }
      default:
        break
    }
  }

  const byRoute = new Map<string, DelegatedUsageRoute>()
  const accumulate = (identity: RouteIdentity, usage: UsageSample): void => {
    const key = identityKey(identity)
    const existing = byRoute.get(key)
    const target = existing ?? { ...identity, uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    byRoute.set(key, {
      ...target,
      uncachedInputTokens: target.uncachedInputTokens + usage.inputTokens,
      outputTokens: target.outputTokens + usage.outputTokens,
      cacheReadTokens: target.cacheReadTokens + (usage.cacheReadTokens ?? 0),
      cacheWriteTokens: target.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
    })
  }

  for (const step of steps.values()) accumulate(step.identity, step.usage)
  for (const route of delegated) {
    accumulate(route, {
      inputTokens: route.uncachedInputTokens,
      outputTokens: route.outputTokens,
      cacheReadTokens: route.cacheReadTokens,
      cacheWriteTokens: route.cacheWriteTokens,
    })
  }

  return [...byRoute.values()].filter(route => route.uncachedInputTokens + route.outputTokens
    + route.cacheReadTokens + route.cacheWriteTokens > 0)
}

/**
 * Append this epoch's provider usage to the delegating parent's log.
 *
 * Appends nothing when the epoch reported no usage, so a child that never called
 * a model leaves no accounting record.
 * @param parent - Session charged for the child's work.
 * @param childId - durable child whose epoch just settled.
 * @param events - the settled epoch's own event suffix.
 * @returns the appended record, or undefined when the epoch reported no usage.
 */
export function appendDelegatedUsage(
  parent: Session,
  childId: SessionId,
  events: readonly SessionEvent[],
): SessionEvent<'subagent/usage'> | undefined {
  const routes = delegatedUsageRoutes(events)
  if (routes.length === 0) return undefined
  return parent.append('subagent/usage', {
    version: SUBAGENT_USAGE_VERSION,
    childId,
    routes,
  })
}
