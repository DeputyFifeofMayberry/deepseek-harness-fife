/**
 * DeepSeek peak-rate indicator for the Web sidebar foot: one quiet chip on the
 * `sidebar.footer.action` seat stating whether API billing is currently in
 * peak or off-peak hours, visible on every screen that shows the sidebar.
 *
 * @module @deepseek-ai/dsh-client-ui-price-phase/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the sidebar slot declarations ('sidebar.footer.action').
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { PricePhaseChip } from './PricePhaseChip.tsx'
import { PricePhaseService } from './service.ts'
import { en, NS, zh } from './locales.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** One application-wide DeepSeek billing-phase reading. */
    pricePhase: PricePhaseService
  }
}

export type { PricePhaseChipProps } from './PricePhaseChip.tsx'
export { pricePhase } from './price-phase.ts'
export type { PricePhase, PricePhaseReading } from './price-phase.ts'

/** Required services: the dictionaries and the slot registry. */
export const inject = ['locale', 'slots']

/**
 * Register the dictionaries, the shared phase service, and the footer chip.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const pricePhase = new PricePhaseService(ctx)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-price-phase: dictionaries')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'price-phase',
    order: 100,
    locale: NS,
    inject: () => ({ hooks: { phase: pricePhase.reading } }),
  }, PricePhaseChip))
}
