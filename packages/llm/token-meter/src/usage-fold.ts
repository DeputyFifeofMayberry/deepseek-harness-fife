/**
 * Shared provider-usage bucket folds for token-meter projections.
 *
 * @module @deepseek-ai/dsh-token-meter/usage-fold
 */

import { z } from 'zod'
import { lastAssistantStreamChunk } from '@deepseek-ai/dsh-llm'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { TokenUsageProjection } from './projection.ts'

/** Persisted and wire schema for one four-bucket usage set. */
export const usageBucketsSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
}).strict()

/** Zero usage in the four disjoint provider buckets. */
export function zeroUsageBuckets(): TokenUsageProjection {
  return {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

/** Detach one provider report into the projection's disjoint buckets. */
export function usageBucketsOf(usage: TokenUsage): TokenUsageProjection {
  return {
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  }
}

/** Add one bucket set to another, one field at a time. */
export function addUsageBuckets(
  totals: TokenUsageProjection,
  next: TokenUsageProjection,
): TokenUsageProjection {
  return {
    uncachedInputTokens: totals.uncachedInputTokens + next.uncachedInputTokens,
    outputTokens: totals.outputTokens + next.outputTokens,
    cacheReadTokens: totals.cacheReadTokens + next.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens + next.cacheWriteTokens,
  }
}

/** Subtract a previously counted sample from a bucket set. */
export function subtractUsageBuckets(
  totals: TokenUsageProjection,
  previous: TokenUsageProjection,
): TokenUsageProjection {
  return {
    uncachedInputTokens: totals.uncachedInputTokens - previous.uncachedInputTokens,
    outputTokens: totals.outputTokens - previous.outputTokens,
    cacheReadTokens: totals.cacheReadTokens - previous.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens - previous.cacheWriteTokens,
  }
}

/** Whether two bucket sets hold identical counters. */
export function sameUsageBuckets(
  left: TokenUsageProjection,
  right: TokenUsageProjection,
): boolean {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

/** The usage one durable Assistant settlement reports for its attempt, if any. */
export function eventUsage(event: SessionEvent): TokenUsage | undefined {
  if (event.type === 'assistant/message' && event.data.usage !== undefined) return event.data.usage
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined
  return lastAssistantStreamChunk(event.data.stream, 'usage')?.usage
}
