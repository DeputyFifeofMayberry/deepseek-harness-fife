/**
 * Route- and hour-bucketed provider usage for cost-aware clients.
 *
 * @module @deepseek-ai/dsh-token-meter/usage-by-route
 */

import { z } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type {
  TokenUsageProjection,
  UsageByRouteBucket,
  UsageByRouteEntry,
  UsageByRouteProjection,
} from './projection.ts'
import {
  addUsageBuckets,
  eventUsage,
  sameUsageBuckets,
  subtractUsageBuckets,
  usageBucketsOf,
  usageBucketsSchema,
  zeroUsageBuckets,
} from './usage-fold.ts'

const HOUR_MS = 3_600_000
const EMPTY_USAGE = zeroUsageBuckets()

const identitySchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string(),
}).strict()

const bucketSchema: z.ZodType<UsageByRouteBucket> = z.object({
  hourOfWeek: z.number().int().min(0).max(167),
  usage: usageBucketsSchema,
}).strict()

const routeSchema: z.ZodType<UsageByRouteEntry> = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string(),
  buckets: z.array(bucketSchema),
}).strict()

const usageByRouteStateSchema = z.object({
  route: identitySchema.nullable(),
  routes: z.array(routeSchema),
  last: z.object({
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
    route: identitySchema,
    hourOfWeek: z.number().int().min(0).max(167),
    usage: usageBucketsSchema,
  }).strict().nullable(),
}).strict()

type RouteIdentity = z.infer<typeof identitySchema>
type UsageByRouteState = z.infer<typeof usageByRouteStateSchema>

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    usageByRoute: UsageByRouteState
  }
}

/** Monday-relative slot for one instant, in UTC hours. */
function hourOfWeekOf(time: number): number {
  const hour = Math.floor(time / HOUR_MS)
  // 1970-01-01 was a Thursday, three days after the Monday that starts slot 0.
  const weekday = ((Math.floor(hour / 24) + 3) % 7 + 7) % 7
  return weekday * 24 + ((hour % 24) + 24) % 24
}

/** Whether two route identities name the same provider/model/effort. */
function sameIdentity(left: RouteIdentity, right: RouteIdentity): boolean {
  return left.provider === right.provider
    && left.model === right.model
    && left.reasoningEffort === right.reasoningEffort
}

/** Compare strings by code unit so client-visible order stays deterministic. */
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Add one counted sample to its route and hour slot. */
function addSample(
  routes: readonly UsageByRouteEntry[],
  identity: RouteIdentity,
  hourOfWeek: number,
  usage: TokenUsageProjection,
): UsageByRouteEntry[] {
  const routeIndex = routes.findIndex(route => sameIdentity(route, identity))
  if (routeIndex === -1) {
    return [...routes, { ...identity, buckets: [{ hourOfWeek, usage }] }]
  }
  const route = routes[routeIndex]
  /* v8 ignore next -- findIndex located the entry. */
  if (route === undefined) return [...routes]
  const bucketIndex = route.buckets.findIndex(bucket => bucket.hourOfWeek === hourOfWeek)
  const buckets = bucketIndex === -1
    ? [...route.buckets, { hourOfWeek, usage }]
    : route.buckets.map((bucket, index) => index === bucketIndex
      ? { ...bucket, usage: addUsageBuckets(bucket.usage, usage) }
      : bucket)
  return routes.map((entry, index) => index === routeIndex ? { ...entry, buckets } : entry)
}

/** Subtract a previously counted sample from its route and hour slot. */
function subtractSample(
  routes: readonly UsageByRouteEntry[],
  identity: RouteIdentity,
  hourOfWeek: number,
  usage: TokenUsageProjection,
): UsageByRouteEntry[] {
  const routeIndex = routes.findIndex(route => sameIdentity(route, identity))
  /* v8 ignore next -- the replacement sample always names a stored route. */
  if (routeIndex === -1) return [...routes]
  const route = routes[routeIndex]
  /* v8 ignore next -- findIndex located the entry. */
  if (route === undefined) return [...routes]
  const buckets = route.buckets.map(bucket => bucket.hourOfWeek === hourOfWeek
    ? { ...bucket, usage: subtractUsageBuckets(bucket.usage, usage) }
    : bucket)
  return routes.map((entry, index) => index === routeIndex ? { ...entry, buckets } : entry)
}

/** Detached client view: nonzero buckets only, in deterministic order. */
function project(state: UsageByRouteState): UsageByRouteProjection {
  const routes = state.routes
    .map(route => ({
      ...route,
      buckets: route.buckets
        .filter(bucket => !sameUsageBuckets(bucket.usage, EMPTY_USAGE))
        .toSorted((left, right) => left.hourOfWeek - right.hourOfWeek),
    }))
    .filter(route => route.buckets.length > 0)
    .toSorted((left, right) => compareText(left.provider, right.provider)
      || compareText(left.model, right.model)
      || compareText(left.reasoningEffort, right.reasoningEffort))
  return { routes }
}

/**
 * Route and UTC-hour buckets for provider usage.
 *
 * The latest `request/header` supplies the route; each settlement's usage is
 * counted in the hour of its event time. A later sample for the same
 * `(turn, step)` replaces the earlier one, and `llm/retry-started` closes that
 * replacement scope exactly as the aggregate `tokenUsage` unit does. The wire
 * view is sparse and sorted, so consumers can map each slot to the provider's
 * peak/off-peak rate without storing a second phase projection.
 */
export const usageByRouteProjectionDefinition = {
  key: 'usageByRoute',
  stateVersion: 2,
  stateSchema: usageByRouteStateSchema,
  init: () => ({ route: null, routes: [], last: null }),
  apply: (state, event: SessionEvent) => {
    if (event.type === 'request/header') {
      const config = event.data.header.config
      const identity: RouteIdentity = {
        provider: config.provider,
        model: config.model,
        reasoningEffort: config.reasoningEffort ?? '',
      }
      if (state.route !== null && sameIdentity(state.route, identity)) return state
      return { ...state, route: identity }
    }
    if (event.type === 'subagent/usage') {
      // Delegated spend names its own routes: the child may have run on another
      // model than the parent's current header, so each sample keeps its identity.
      let routes = state.routes
      const hourOfWeek = hourOfWeekOf(event.time)
      for (const route of event.data.routes) {
        routes = addSample(routes, {
          provider: route.provider,
          model: route.model,
          reasoningEffort: route.reasoningEffort,
        }, hourOfWeek, {
          uncachedInputTokens: route.uncachedInputTokens,
          outputTokens: route.outputTokens,
          cacheReadTokens: route.cacheReadTokens,
          cacheWriteTokens: route.cacheWriteTokens,
        })
      }
      return routes === state.routes ? state : { ...state, routes }
    }
    if (event.type === 'llm/retry-started') {
      return state.last?.turn === event.data.turn && state.last.step === event.data.step
        ? { ...state, last: null }
        : state
    }
    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state
    if (state.route === null) return state
    const sample = eventUsage(event)
    if (sample === undefined) return state

    const usage = usageBucketsOf(sample)
    const hourOfWeek = hourOfWeekOf(event.time)
    const { turn, step } = event.data
    const previous = state.last !== null && state.last.turn === turn && state.last.step === step
      ? state.last
      : null
    if (previous !== null
      && previous.hourOfWeek === hourOfWeek
      && sameIdentity(previous.route, state.route)
      && sameUsageBuckets(previous.usage, usage)) return state

    const withoutPrevious = previous === null
      ? state.routes
      : subtractSample(state.routes, previous.route, previous.hourOfWeek, previous.usage)
    return {
      route: state.route,
      routes: addSample(withoutPrevious, state.route, hourOfWeek, usage),
      last: { turn, step, route: state.route, hourOfWeek, usage },
    }
  },
  wire: {
    viewSchema: z.object({ routes: z.array(routeSchema) }).strict(),
    view: project,
  },
} satisfies ProjectionDefinition<'usageByRoute', UsageByRouteState>
