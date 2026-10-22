/**
 * Shared live reading of the DeepSeek API billing phase.
 *
 * One source per application: every consumer of the published schedule reads
 * the same snapshot, and the source arms a single boundary timeout instead of
 * letting each surface keep its own timer.
 *
 * @module @deepseek-ai/dsh-client-ui-price-phase/phase-source
 */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { pricePhase } from './price-phase.ts'
import type { PricePhaseReading } from './price-phase.ts'

/** Live phase reading with explicit teardown. */
export interface PricePhaseSource extends HostObservable<PricePhaseReading> {
  /** Clear the boundary timeout and the visibility listener. */
  dispose(): void
}

/**
 * Create the shared phase reading.
 *
 * The schedule is piecewise constant, so one timeout at the next boundary is
 * enough; a visibility change re-arms the reading, letting a suspended tab
 * catch up on return.
 * @returns the observable reading and its teardown.
 */
export function createPricePhaseSource(): PricePhaseSource {
  let reading = pricePhase(Date.now())
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of [...listeners]) listener() }
  const arm = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    const at = Date.now()
    const next = pricePhase(at)
    if (next.phase !== reading.phase || next.nextBoundary !== reading.nextBoundary) {
      reading = next
      notify()
    }
    timer = setTimeout(arm, Math.max(next.nextBoundary - at, 0) + 1)
  }
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') arm()
  }
  arm()
  document.addEventListener('visibilitychange', onVisibility)
  return {
    getSnapshot: () => reading,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispose: () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      document.removeEventListener('visibilitychange', onVisibility)
      listeners.clear()
    },
  }
}
