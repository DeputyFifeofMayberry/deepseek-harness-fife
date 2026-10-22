/**
 * Sidebar usage panel: one collapsible summary of the active Session's spend
 * and the account balance, mounted above the footer actions and Settings row.
 *
 * @module @deepseek-ai/dsh-client-ui-usage-panel/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the sidebar slot declarations ('sidebar.footer.panel').
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the price-phase service merge (ctx.pricePhase).
import type {} from '@deepseek-ai/dsh-client-ui-price-phase/client'
// Type-only: pulls the account read service merge (ctx.accountRead).
import type {} from '@deepseek-ai/dsh-client-ui-settings-account/client'
// Type-only: pulls the model catalog service merge (ctx.modelDirectories).
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { Config, USAGE_PANEL_CONFIG_GLOBAL, type LowBalanceThresholds } from '../config.ts'
import { UsagePanel } from './UsagePanel.tsx'
import { utcWeekStart } from './pricing.ts'
import { en, NS, zh } from './locales.ts'

const HOUR_MS = 3_600_000

/** Required services: copy, the panel seat, the phase schedule, and shared account/catalog reads. */
export const inject = ['slots', 'locale', 'pricePhase', 'accountRead', 'modelDirectories']

/**
 * Register the dictionaries and the footer usage panel.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const page = globalThis as Partial<Record<typeof USAGE_PANEL_CONFIG_GLOBAL, unknown>>
  const config = Config(page[USAGE_PANEL_CONFIG_GLOBAL] ?? {})
  const lowBalance: LowBalanceThresholds = config.lowBalance
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-usage-panel: dictionaries')
  // The published schedule repeats weekly, so one Monday anchors every slot.
  const weekStart = utcWeekStart(Date.now())
  ctx.slots.inject('sidebar.footer.panel', () => ctx.slots.register({
    name: 'sidebar.footer.panel',
    locale: NS,
    inject: () => ({
      hooks: {
        account: ctx.accountRead.snapshot,
        catalog: ctx.modelDirectories.modelCatalog.store,
      },
      /** @param hourOfWeek - UTC hour-of-week slot (0 = Monday 00:00). @returns the phase that slot always bills in. */
      phaseOfHour: (hourOfWeek: number) => ctx.pricePhase.at(weekStart + hourOfWeek * HOUR_MS).phase,
      refreshBalance: () => ctx.accountRead.refreshBalance(),
      lowBalance,
    }),
  }, UsagePanel))
}
