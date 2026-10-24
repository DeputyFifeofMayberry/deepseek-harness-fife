// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPricePhaseSource } from '../src/client/phase-source.ts'

/** Wednesday 2026-10-21 05:00 UTC, inside the midday off-peak stretch. */
const OFF_PEAK = Date.UTC(2026, 9, 21, 5, 0, 0)
/** 06:00 UTC opens the second peak window. */
const PEAK = Date.UTC(2026, 9, 21, 6, 0, 0)

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  vi.useRealTimers()
})

describe('createPricePhaseSource', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('publishes the first flip once and stays quiet on a visible re-arm', () => {
    vi.setSystemTime(OFF_PEAK)
    const source = createPricePhaseSource()
    const seen: string[] = []
    const unsubscribe = source.subscribe(() => { seen.push(source.getSnapshot().phase) })
    expect(source.getSnapshot().phase).toBe('off-peak')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(seen).toEqual([])
    vi.advanceTimersByTime(PEAK - OFF_PEAK + 1)
    expect(seen).toEqual(['peak'])
    expect(source.getSnapshot()).toEqual({ phase: 'peak', nextBoundary: Date.UTC(2026, 9, 21, 10, 0, 0) })
    unsubscribe()
    source.dispose()
  })

  it('ignores a visibility change while hidden', () => {
    vi.setSystemTime(OFF_PEAK)
    const source = createPricePhaseSource()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(source.getSnapshot().phase).toBe('off-peak')
    source.dispose()
    source.dispose()
  })

  it('stops publishing after disposal', () => {
    vi.setSystemTime(OFF_PEAK)
    const source = createPricePhaseSource()
    const listener = vi.fn()
    source.subscribe(listener)
    source.dispose()
    vi.advanceTimersByTime(PEAK - OFF_PEAK + 1)
    expect(listener).not.toHaveBeenCalled()
  })
})
