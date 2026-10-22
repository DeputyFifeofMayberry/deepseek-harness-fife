/** Spend calculation, phase lookup, and display formatting for the usage panel. */
import { Big } from 'big.js'
import { describe, expect, it } from 'vitest'
import type { UsageByRouteEntry } from '@deepseek-ai/dsh-token-meter/client'
import type { RoutePricing } from '../src/client/pricing.ts'
import {
  formatCost, formatWallet, isLowBalance, priceUsage, utcWeekStart,
} from '../src/client/pricing.ts'

const FLASH: RoutePricing = {
  currency: 'USD',
  inputPerMillion: 2,
  outputPerMillion: 4,
  cacheReadPerMillion: 0.5,
  cacheWritePerMillion: 2,
  offPeakMultiplier: 0.5,
}

/** One hour-of-week bucket carrying every token category. */
function route(buckets: readonly { hourOfWeek: number; uncachedInputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }[], provider = 'deepseek', model = 'deepseek-flash', reasoningEffort = ''): UsageByRouteEntry {
  return {
    provider,
    model,
    reasoningEffort,
    buckets: buckets.map(bucket => ({
      hourOfWeek: bucket.hourOfWeek,
      usage: {
        uncachedInputTokens: bucket.uncachedInputTokens ?? 0,
        outputTokens: bucket.outputTokens ?? 0,
        cacheReadTokens: bucket.cacheReadTokens ?? 0,
        cacheWriteTokens: bucket.cacheWriteTokens ?? 0,
      },
    })),
  }
}

const peak = (): 'peak' => 'peak'
const offPeak = (): 'off-peak' => 'off-peak'

describe('utcWeekStart', () => {
  it('returns Monday 00:00 UTC for any instant in the week', () => {
    // Wednesday 2026-10-21; the week starts Monday 2026-10-19.
    expect(utcWeekStart(Date.UTC(2026, 9, 21, 13, 30))).toBe(Date.UTC(2026, 9, 19))
    expect(utcWeekStart(Date.UTC(2026, 9, 19))).toBe(Date.UTC(2026, 9, 19))
    expect(utcWeekStart(Date.UTC(2026, 9, 25, 23, 59))).toBe(Date.UTC(2026, 9, 19))
  })
})

describe('priceUsage', () => {
  it('prices every token category at peak rates', () => {
    const priced = priceUsage([route([
      { hourOfWeek: 2, uncachedInputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 2_000_000, cacheWriteTokens: 1_000_000 },
    ])], () => FLASH, peak)
    // 1M × 2 + 0.5M × 4 + 2M × 0.5 + 1M × 2 = 7 USD.
    expect(priced.routes[0]?.amount.toString()).toBe('7')
    expect(priced.routes[0]?.currency).toBe('USD')
    expect(priced.routes[0]?.unpricedTokens).toBe(0)
    expect(priced.totals.map(total => [total.currency, total.amount.toString()])).toEqual([['USD', '7']])
    expect(priced.unpricedTokens).toBe(0)
  })

  it('applies the off-peak multiplier per bucket', () => {
    const priced = priceUsage([
      route([
        { hourOfWeek: 2, uncachedInputTokens: 1_000_000 },
        { hourOfWeek: 5, uncachedInputTokens: 1_000_000 },
      ]),
    ], () => FLASH, hour => hour === 5 ? 'off-peak' : 'peak')
    // 1M × 2 at peak + 1M × 2 × 0.5 off-peak = 3 USD.
    expect(priced.routes[0]?.amount.toString()).toBe('3')
    expect(priced.routes[0]?.uncachedInputTokens).toBe(2_000_000)
  })

  it('leaves cache tokens unpriced when the rate card omits their rates', () => {
    const { cacheReadPerMillion: _read, cacheWritePerMillion: _write, ...partiallyPriced } = FLASH
    const priced = priceUsage([route([
      { hourOfWeek: 2, uncachedInputTokens: 1_000_000, cacheReadTokens: 3_000_000, cacheWriteTokens: 4_000_000 },
    ])], () => partiallyPriced, peak)
    expect(priced.routes[0]?.amount.toString()).toBe('2')
    expect(priced.routes[0]?.unpricedTokens).toBe(7_000_000)
    expect(priced.unpricedTokens).toBe(7_000_000)
  })

  it('treats a rate card without an off-peak multiplier as flat', () => {
    const { offPeakMultiplier: _multiplier, ...flat } = FLASH
    const priced = priceUsage([route([{ hourOfWeek: 2, uncachedInputTokens: 1_000_000 }])], () => flat, offPeak)
    expect(priced.routes[0]?.amount.toString()).toBe('2')
  })

  it('lists a priced route with no tokens without adding a currency total', () => {
    const priced = priceUsage([route([{ hourOfWeek: 2 }])], () => FLASH, peak)
    expect(priced.routes[0]?.amount.toString()).toBe('0')
    expect(priced.totals).toEqual([])
  })

  it('lists a route without a rate card and counts all of its tokens unpriced', () => {
    const priced = priceUsage([
      route([{ hourOfWeek: 2, uncachedInputTokens: 10, outputTokens: 5 }], 'relay', 'custom'),
    ], () => undefined, peak)
    expect(priced.routes[0]).toMatchObject({ provider: 'relay', model: 'custom', unpricedTokens: 15 })
    expect(priced.routes[0]?.currency).toBeUndefined()
    expect(priced.routes[0]?.amount.toString()).toBe('0')
    expect(priced.totals).toEqual([])
  })

  it('sorts already ascending currency totals without moving them', () => {
    const priced = priceUsage([
      route([{ hourOfWeek: 2, uncachedInputTokens: 1_000_000 }], 'provider-cny', 'model-cny'),
      route([{ hourOfWeek: 2, uncachedInputTokens: 1_000_000 }], 'provider-usd', 'model-usd'),
    ], provider => ({ ...FLASH, currency: provider === 'provider-cny' ? 'CNY' : 'USD' }), peak)
    expect(priced.totals.map(total => total.currency)).toEqual(['CNY', 'USD'])
  })

  it('keeps one total per currency in code-unit order', () => {
    const currencyByProvider = { 'provider-usd': 'USD', 'provider-eur': 'EUR', 'provider-cny': 'CNY' }
    const priced = priceUsage([
      route([{ hourOfWeek: 2, uncachedInputTokens: 1_000_000 }], 'provider-usd', 'model-usd'),
      route([{ hourOfWeek: 2, uncachedInputTokens: 1_000_000 }], 'provider-eur', 'model-eur'),
      route([{ hourOfWeek: 2, uncachedInputTokens: 1_000_000 }], 'provider-cny', 'model-cny'),
    ], provider => ({ ...FLASH, currency: currencyByProvider[provider as keyof typeof currencyByProvider] }), peak)
    expect(priced.totals.map(total => [total.currency, total.amount.toString()]))
      .toEqual([['CNY', '2'], ['EUR', '2'], ['USD', '2']])
    expect(priced.routes.map(route => route.provider)).toEqual(['provider-usd', 'provider-eur', 'provider-cny'])
  })
})

describe('display formatting', () => {
  it('formats large and sub-cent costs', () => {
    expect(formatCost(new Big('1.5'), 'USD', 'en')).toBe('$1.50')
    expect(formatCost(new Big('0.00001'), 'USD', 'en')).toBe('<$0.0001')
    expect(formatCost(new Big('0'), 'USD', 'en')).toBe('$0.00')
  })

  it('formats wallet balances with two decimals and keeps sub-cent amounts visible', () => {
    expect(formatWallet('1234.5', 'USD', 'en')).toBe('$1,234.50')
    expect(formatWallet('0.004', 'CNY', 'en')).toBe('<CN¥0.01')
    expect(formatWallet('0', 'USD', 'en')).toBe('$0.00')
  })

  it('marks only balances at or below a configured threshold', () => {
    expect(isLowBalance('1', 1)).toBe(true)
    expect(isLowBalance('1.01', 1)).toBe(false)
    expect(isLowBalance('0', undefined)).toBe(false)
  })
})
