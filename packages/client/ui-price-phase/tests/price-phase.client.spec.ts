import { describe, expect, it } from 'vitest'
import { pricePhase } from '@deepseek-ai/dsh-client-ui-price-phase/client'

/** A UTC instant from explicit UTC fields, so the cases read in schedule time. */
function utc(iso: string): number {
  return Date.parse(`${iso}Z`)
}

describe('pricePhase', () => {
  it('reads the published UTC windows on a weekday', () => {
    // Wednesday 2026-10-21.
    expect(pricePhase(utc('2026-10-21T00:59:00.000'))).toEqual({ phase: 'off-peak', nextBoundary: utc('2026-10-21T01:00:00.000') })
    expect(pricePhase(utc('2026-10-21T01:00:00.000'))).toEqual({ phase: 'peak', nextBoundary: utc('2026-10-21T04:00:00.000') })
    expect(pricePhase(utc('2026-10-21T03:59:59.999'))).toEqual({ phase: 'peak', nextBoundary: utc('2026-10-21T04:00:00.000') })
    expect(pricePhase(utc('2026-10-21T04:00:00.000'))).toEqual({ phase: 'off-peak', nextBoundary: utc('2026-10-21T06:00:00.000') })
    expect(pricePhase(utc('2026-10-21T05:59:00.000'))).toEqual({ phase: 'off-peak', nextBoundary: utc('2026-10-21T06:00:00.000') })
    expect(pricePhase(utc('2026-10-21T06:00:00.000'))).toEqual({ phase: 'peak', nextBoundary: utc('2026-10-21T10:00:00.000') })
    expect(pricePhase(utc('2026-10-21T09:59:59.999'))).toEqual({ phase: 'peak', nextBoundary: utc('2026-10-21T10:00:00.000') })
    expect(pricePhase(utc('2026-10-21T10:00:00.000'))).toEqual({ phase: 'off-peak', nextBoundary: utc('2026-10-22T01:00:00.000') })
  })

  it('spans the weekend as one off-peak stretch', () => {
    // Friday after the second window through Sunday.
    expect(pricePhase(utc('2026-10-23T10:00:00.000'))).toEqual({ phase: 'off-peak', nextBoundary: utc('2026-10-26T01:00:00.000') })
    expect(pricePhase(utc('2026-10-24T02:00:00.000')).phase).toBe('off-peak')
    expect(pricePhase(utc('2026-10-25T08:00:00.000')).nextBoundary).toBe(utc('2026-10-26T01:00:00.000'))
    expect(pricePhase(utc('2026-10-23T23:30:00.000')).nextBoundary).toBe(utc('2026-10-26T01:00:00.000'))
    // Monday opens the next peak window.
    expect(pricePhase(utc('2026-10-26T01:00:00.000')).phase).toBe('peak')
  })

  it('flips exactly at each reported boundary', () => {
    const instants = [
      utc('2026-10-21T00:59:00.000'),
      utc('2026-10-21T01:00:00.000'),
      utc('2026-10-21T03:30:00.000'),
      utc('2026-10-21T04:00:00.000'),
      utc('2026-10-21T09:00:00.000'),
      utc('2026-10-21T10:00:00.000'),
      utc('2026-10-24T12:00:00.000'),
    ]
    for (const at of instants) {
      const reading = pricePhase(at)
      // The reported boundary ends the current phase: one millisecond before it
      // the phase still reads as reported, at it the phase has flipped.
      expect(pricePhase(reading.nextBoundary - 1).phase).toBe(reading.phase)
      expect(pricePhase(reading.nextBoundary).phase).not.toBe(reading.phase)
      expect(reading.nextBoundary).toBeGreaterThan(at)
    }
  })
})
