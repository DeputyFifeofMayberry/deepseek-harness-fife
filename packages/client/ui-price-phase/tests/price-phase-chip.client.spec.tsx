// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPricePhaseSource, type PricePhaseSource } from '../src/client/phase-source.ts'
import { PricePhaseChip } from '../src/client/PricePhaseChip.tsx'
import { pricePhase } from '../src/client/price-phase.ts'
import type { PricePhaseReading } from '../src/client/price-phase.ts'
import { en, zh } from '../src/client/locales.ts'

/** Minimal translate seat over one dictionary. */
function makeTranslate(dictionary: Record<string, string>): (key: keyof typeof en) => string {
  return key => dictionary[key] ?? ''
}

/** The renderer injects the global standard props; direct renders stub them out. */
function chipProps(props: {
  wide: boolean
  t: (key: keyof typeof en) => string
  usePhase: (selector: (reading: PricePhaseReading) => PricePhaseReading) => PricePhaseReading
}): ComponentProps<typeof PricePhaseChip> {
  return props as ComponentProps<typeof PricePhaseChip>
}

const staticHook = (reading: PricePhaseReading) =>
  (selector: (reading: PricePhaseReading) => PricePhaseReading): PricePhaseReading => selector(reading)

/** Wednesday 2026-10-21 02:00 UTC — squarely inside the first peak window. */
const PEAK_INSTANT = Date.UTC(2026, 9, 21, 2, 0, 0)
/** The same Wednesday inside the midday off-peak stretch. */
const OFF_PEAK_INSTANT = Date.UTC(2026, 9, 21, 5, 0, 0)

const sources: PricePhaseSource[] = []
afterEach(() => {
  cleanup()
  for (const source of sources.splice(0)) source.dispose()
  vi.useRealTimers()
})

describe('PricePhaseChip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('shows the phase word and note when the sidebar is wide', () => {
    vi.setSystemTime(PEAK_INSTANT)
    const view = render(<PricePhaseChip {...chipProps({
      wide: true, t: makeTranslate(en), usePhase: staticHook(pricePhase(PEAK_INSTANT)),
    })} />)
    expect(screen.getByText('Peak')).toBeTruthy()
    const chip = view.container.querySelector('[data-price-phase="peak"]')
    expect(chip).toBeTruthy()
    expect(chip?.getAttribute('aria-label')).toBe('DeepSeek peak rates in effect')
  })

  it('collapses to the dot on the rail and keeps its accessible name', () => {
    vi.setSystemTime(PEAK_INSTANT)
    const view = render(<PricePhaseChip {...chipProps({
      wide: false, t: makeTranslate(en), usePhase: staticHook(pricePhase(PEAK_INSTANT)),
    })} />)
    expect(screen.queryByText('Peak')).toBeNull()
    expect(view.container.querySelector('[data-price-phase="peak"]')?.getAttribute('aria-label'))
      .toBe('DeepSeek peak rates in effect')
  })

  it('flips at the next boundary through the shared reading', () => {
    vi.setSystemTime(OFF_PEAK_INSTANT)
    const source = createPricePhaseSource()
    sources.push(source)
    const usePhase = (selector: (reading: PricePhaseReading) => PricePhaseReading): PricePhaseReading =>
      selector(useSyncExternalStore(listener => source.subscribe(listener), () => source.getSnapshot()))
    const view = render(<PricePhaseChip {...chipProps({
      wide: true, t: makeTranslate(en), usePhase,
    })} />)
    expect(view.container.querySelector('[data-price-phase="off-peak"]')).toBeTruthy()
    // The next boundary is 06:00 UTC; one millisecond before it the chip still
    // reads off-peak, and one past it the shared reading has flipped.
    act(() => { vi.advanceTimersByTime(Date.UTC(2026, 9, 21, 6, 0, 0) - OFF_PEAK_INSTANT - 1) })
    expect(view.container.querySelector('[data-price-phase="off-peak"]')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(2) })
    expect(view.container.querySelector('[data-price-phase="peak"]')).toBeTruthy()
  })

  it('states the localized phase in Chinese', () => {
    vi.setSystemTime(PEAK_INSTANT)
    const node: ReactNode = <PricePhaseChip {...chipProps({
      wide: true, t: makeTranslate(zh), usePhase: staticHook(pricePhase(PEAK_INSTANT)),
    })} />
    render(node)
    expect(screen.getByText('高峰')).toBeTruthy()
  })
})
