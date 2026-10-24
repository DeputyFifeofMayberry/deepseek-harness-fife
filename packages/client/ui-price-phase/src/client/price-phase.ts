/**
 * DeepSeek API peak-phase computation, shared by every surface that states the
 * current billing phase. Pure UTC arithmetic off the published schedule, so a
 * chip, a hover, and a test reading the same instant agree without a Host call.
 *
 * Published source (DeepSeek API pricing): peak hours are 01:00–04:00 and
 * 06:00–10:00 UTC, Monday through Friday; every other hour is off-peak,
 * including weekends and Chinese public holidays in full. Chinese public
 * holidays are deliberately not tracked here — they are announced per year and
 * a stale table would lie on the expensive side — so weekday peak windows may
 * read "peak" on those few holidays while billing is actually off-peak.
 *
 * @module @deepseek-ai/dsh-client-ui-price-phase/price-phase
 */

/** Billing phase of one instant. */
export type PricePhase = 'peak' | 'off-peak'

/** One reading: the phase now, and the instant the phase flips. */
export interface PricePhaseReading {
  /** Billing phase in effect at the read instant. */
  readonly phase: PricePhase
  /** Epoch ms of the next peak↔off-peak boundary (strictly after the read). */
  readonly nextBoundary: number
}

/** Peak windows of one weekday in minutes of the UTC day; ends are exclusive. */
const PEAK_WINDOWS: readonly { readonly startMinute: number; readonly endMinute: number }[] = [
  { startMinute: 60, endMinute: 240 }, // 01:00–04:00 UTC
  { startMinute: 360, endMinute: 600 }, // 06:00–10:00 UTC
]

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

/** Whether one UTC weekday (0 Sunday … 6 Saturday) carries peak windows. */
function isPeakWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5
}

/**
 * Compute the billing phase at one instant and when it next flips.
 * @param at - epoch ms of the instant to read.
 * @returns the phase at `at`, and the next boundary instant after it.
 */
export function pricePhase(at: number): PricePhaseReading {
  const read = new Date(at)
  const dayUtc = Date.UTC(read.getUTCFullYear(), read.getUTCMonth(), read.getUTCDate())
  const minuteOfDay = read.getUTCHours() * 60 + read.getUTCMinutes()
  if (isPeakWeekday(read.getUTCDay())) {
    for (const window of PEAK_WINDOWS) {
      if (minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute) {
        return { phase: 'peak', nextBoundary: dayUtc + window.endMinute * MINUTE_MS }
      }
    }
  }
  // Off-peak: the next boundary is the first peak-window start after `at`, walking
  // forward day by day; weekends carry no windows, so the walk spans at most one
  // weekend plus one day before it must find a weekday.
  for (let offset = 0; offset < 8; offset += 1) {
    const morning = dayUtc + offset * DAY_MS
    if (!isPeakWeekday(new Date(morning).getUTCDay())) continue
    for (const window of PEAK_WINDOWS) {
      const start = morning + window.startMinute * MINUTE_MS
      if (start > at) return { phase: 'off-peak', nextBoundary: start }
    }
  }
  /* v8 ignore next -- eight forward days always contain a weekday. */
  throw new Error('price phase walk found no weekday peak window')
}
