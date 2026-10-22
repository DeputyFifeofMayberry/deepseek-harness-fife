import { describe, expect, it } from 'vitest'
import { clock12Hour, clock12Parts } from '@deepseek-ai/dsh-client-ui-primitives'

/** A local instant from clock fields, so the expectations read in local time too. */
function at(y: number, mo: number, d: number, h: number, mi = 0, s = 0, ms = 0): number {
  return new Date(y, mo - 1, d, h, mi, s, ms).getTime()
}

describe('clock12Parts', () => {
  it('decomposes a morning instant with seconds and milliseconds', () => {
    const parts = clock12Parts(at(2026, 10, 21, 9, 38, 26, 123))
    expect(parts).toEqual({ h: 9, mm: '38', ss: '26', mmm: '123', ampm: 'am' })
  })

  it('decomposes an afternoon instant with a pm meridiem', () => {
    const parts = clock12Parts(at(2026, 10, 21, 15, 5, 1, 4))
    expect(parts).toEqual({ h: 3, mm: '05', ss: '01', mmm: '004', ampm: 'pm' })
  })

  it('reads midnight and noon as hour 12 with their own meridiems', () => {
    expect(clock12Parts(at(2026, 1, 1, 0, 0, 0, 0))).toMatchObject({ h: 12, ampm: 'am' })
    expect(clock12Parts(at(2026, 1, 1, 12, 0, 0, 0))).toMatchObject({ h: 12, ampm: 'pm' })
  })

  it('reads the last minute of the morning and the first of the evening', () => {
    expect(clock12Parts(at(2026, 1, 1, 11, 59, 59, 999))).toMatchObject({ h: 11, mm: '59', ampm: 'am' })
    expect(clock12Parts(at(2026, 1, 1, 12, 0, 0, 1))).toMatchObject({ h: 12, mm: '00', ampm: 'pm' })
  })

  it('pads single-digit minutes, seconds, and milliseconds', () => {
    const parts = clock12Parts(at(2026, 1, 1, 13, 5, 9, 42))
    expect(parts).toEqual({ h: 1, mm: '05', ss: '09', mmm: '042', ampm: 'pm' })
  })
})

describe('clock12Hour', () => {
  it('maps every 24-scale hour onto the 12-scale', () => {
    expect(clock12Hour(0)).toBe(12)
    expect(clock12Hour(1)).toBe(1)
    expect(clock12Hour(11)).toBe(11)
    expect(clock12Hour(12)).toBe(12)
    expect(clock12Hour(13)).toBe(1)
    expect(clock12Hour(23)).toBe(11)
  })
})
