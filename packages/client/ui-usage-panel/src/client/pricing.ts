/**
 * Spend calculation for the sidebar usage panel: provider-reported usage is
 * priced against the catalog's per-model rate card, with each UTC hour-of-week
 * bucket scaled by the billing phase in force when it settled.
 *
 * @module @deepseek-ai/dsh-client-ui-usage-panel/pricing
 */
import { Big } from 'big.js'
import type { ModelCatalogModel } from '@deepseek-ai/dsh-api-session-controller/types'
import type { PricePhase } from '@deepseek-ai/dsh-client-ui-price-phase/client'
import type { UsageByRouteEntry } from '@deepseek-ai/dsh-token-meter/client'

const DAY_MS = 86_400_000
const PER_MILLION = new Big(1_000_000)

/** Published rate card for one route, as carried by the model catalog. */
export type RoutePricing = NonNullable<ModelCatalogModel['pricing']>

/** Provider token counts, split the same way the usage projection reports them. */
export interface RouteTokens {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** One route's priced spend. */
export interface PricedRoute extends RouteTokens {
  provider: string
  model: string
  /** Adapter-owned effort id; empty means the provider default. */
  reasoningEffort: string
  /** Currency the amount is stated in; absent when no bucket could be priced. */
  currency?: string
  /** Total spend for this route, in {@link currency}. */
  amount: Big
  /** Token count for buckets this rate card leaves unpriced. */
  unpricedTokens: number
}

/** Spend accumulated in one currency across every priced route. */
export interface CurrencyTotal {
  currency: string
  amount: Big
}

/** Complete spend reading for one usage projection. */
export interface UsagePrice {
  /** Priced routes in projection order; routes without a rate card remain listed. */
  routes: PricedRoute[]
  /** Totals ordered by currency code. */
  totals: CurrencyTotal[]
  /** Tokens whose route or bucket has no published rate. */
  unpricedTokens: number
}

/**
 * Start of the UTC week containing an instant, at Monday 00:00.
 * @param instant - epoch ms inside that week.
 * @returns epoch ms of the week's Monday 00:00 UTC.
 */
export function utcWeekStart(instant: number): number {
  const day = Math.floor(instant / DAY_MS) * DAY_MS
  const mondayIndex = ((Math.floor(day / DAY_MS) + 3) % 7 + 7) % 7
  return day - mondayIndex * DAY_MS
}

/**
 * Price every route bucket against its published rate card.
 * @param routes - usage bucketed by route and UTC hour-of-week.
 * @param pricingOf - catalog rate card for a provider/model pair.
 * @param phaseOf - billing phase in force for an hour-of-week slot.
 * @returns per-route spend, currency totals, and the unpriced token count.
 */
export function priceUsage(
  routes: readonly UsageByRouteEntry[],
  pricingOf: (provider: string, model: string) => RoutePricing | undefined,
  phaseOf: (hourOfWeek: number) => PricePhase,
): UsagePrice {
  const totals = new Map<string, Big>()
  let unpricedTokens = 0
  const priced = routes.map((route) => {
    const pricing = pricingOf(route.provider, route.model)
    let amount = new Big(0)
    let unpriced = 0
    const tokens: RouteTokens = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    for (const bucket of route.buckets) {
      const usage = bucket.usage
      tokens.uncachedInputTokens += usage.uncachedInputTokens
      tokens.outputTokens += usage.outputTokens
      tokens.cacheReadTokens += usage.cacheReadTokens
      tokens.cacheWriteTokens += usage.cacheWriteTokens
      if (pricing === undefined) {
        unpriced += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
        continue
      }
      let pricedTokens = usage.uncachedInputTokens * pricing.inputPerMillion
        + usage.outputTokens * pricing.outputPerMillion
      if (usage.cacheReadTokens > 0) {
        if (pricing.cacheReadPerMillion === undefined) unpriced += usage.cacheReadTokens
        else pricedTokens += usage.cacheReadTokens * pricing.cacheReadPerMillion
      }
      if (usage.cacheWriteTokens > 0) {
        if (pricing.cacheWritePerMillion === undefined) unpriced += usage.cacheWriteTokens
        else pricedTokens += usage.cacheWriteTokens * pricing.cacheWritePerMillion
      }
      const phase = phaseOf(bucket.hourOfWeek)
      const scale = phase === 'off-peak' ? pricing.offPeakMultiplier ?? 1 : 1
      amount = amount.plus(new Big(pricedTokens).times(scale))
    }
    if (pricing !== undefined) {
      amount = amount.div(PER_MILLION)
      if (amount.gt(0)) totals.set(pricing.currency, (totals.get(pricing.currency) ?? new Big(0)).plus(amount))
    }
    unpricedTokens += unpriced
    return {
      provider: route.provider,
      model: route.model,
      reasoningEffort: route.reasoningEffort,
      ...tokens,
      ...(pricing === undefined ? {} : { currency: pricing.currency }),
      amount,
      unpricedTokens: unpriced,
    }
  })
  return {
    routes: priced,
    totals: [...totals].sort(([left], [right]) => left < right ? -1 : 1)
      .map(([currency, amount]) => ({ currency, amount })),
    unpricedTokens,
  }
}

/**
 * Format an estimated spend for display; sub-ten-thousandth amounts stay
 * positive instead of rendering as zero.
 * @param amount - estimated amount.
 * @param currency - ISO 4217 currency code.
 * @param locale - BCP 47 locale for grouping and symbol placement.
 * @returns localized currency text.
 */
export function formatCost(amount: Big, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4,
  })
  const smallest = new Big('0.0001')
  if (amount.gt(0) && amount.lt(smallest)) return `<${formatter.format(smallest.toNumber())}`
  return formatter.format(amount.toNumber())
}

/**
 * Whether a wallet balance at or below its threshold should be marked low.
 * @param balance - decimal balance string.
 * @param threshold - deployment threshold for the wallet's currency, absent when none applies.
 * @returns whether the balance is low.
 */
export function isLowBalance(balance: string, threshold: number | undefined): boolean {
  return threshold !== undefined && new Big(balance).lte(threshold)
}

/**
 * Format one wallet balance with Platform-style two-decimal precision.
 * @param amount - decimal balance string reported by the account service.
 * @param currency - ISO 4217 currency code.
 * @param locale - BCP 47 locale for grouping and symbol placement.
 * @returns localized balance text; positive sub-cent amounts stay visible.
 */
export function formatWallet(amount: string, currency: string, locale: string): string {
  const value = new Big(amount)
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  if (value.gt(0) && value.lt('0.01')) return `<${formatter.format(0.01)}`
  return formatter.format(value.toNumber())
}
