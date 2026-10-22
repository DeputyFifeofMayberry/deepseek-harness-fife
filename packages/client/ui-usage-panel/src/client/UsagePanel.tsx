/**
 * Sidebar footer usage panel: one collapsible row showing the active
 * Session's estimated spend and the account's recharge balance. Collapsed it
 * is a quiet summary; expanded it lists spend per model route and marks a low
 * balance with a top-up destination. In the 56px rail it is a single icon whose
 * tooltip carries the same reading.
 *
 * @module @deepseek-ai/dsh-client-ui-usage-panel/UsagePanel
 */
import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconGaugeOutlineRegular, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelCatalogState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { ModelCatalogModel } from '@deepseek-ai/dsh-api-session-controller/types'
import type { PricePhase } from '@deepseek-ai/dsh-client-ui-price-phase/client'
import type { AccountReadSnapshot } from '@deepseek-ai/dsh-client-ui-settings-account/client'
import type { HostObservable, PropsHooks, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the GlobalStandardProps merge (useSessions) into the slot runtime face.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { UsageByRouteEntry, UsageByRouteProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { LowBalanceThresholds } from '../config.ts'
import { formatCost, formatWallet, isLowBalance, priceUsage, type CurrencyTotal } from './pricing.ts'
import css from './UsagePanel.module.css'

/** Localized route labels resolved from the model catalog. */
interface RouteLabels {
  provider: string
  model: string
  effort?: string
}

/** Facts and operations injected into the Cordis-free panel. */
export interface UsagePanelInjected {
  /** Account reading shared with Account settings. */
  hooks: {
    account: HostObservable<AccountReadSnapshot>
    catalog: HostObservable<ModelCatalogState>
  }
  /** Billing phase in force for one UTC hour-of-week slot. */
  phaseOfHour: (hourOfWeek: number) => PricePhase
  /** Re-read only the recharge wallets after the user opens the detail. */
  refreshBalance: () => Promise<void>
  /** Deployment thresholds that mark a wallet balance as low. */
  lowBalance: LowBalanceThresholds
}

/** Composed component props: the sidebar's column state, copy, and injected facts. */
export type UsagePanelProps =
  PropsRuntime<'sidebar.footer.panel'>
  & PropsLocale<'usagePanel'>
  & PropsHooks<UsagePanelInjected['hooks']>
  & Pick<UsagePanelInjected, 'phaseOfHour' | 'refreshBalance' | 'lowBalance'>

/** The active Session's route-bucketed usage, absent before any Session is open. */
function activeUsage(state: SessionListState): UsageByRouteProjection | undefined {
  const active = Object.values(state.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)
  return active === undefined ? undefined : state.projectionsBySession[active.id]?.values.usageByRoute
}

/** Resolve display labels for one recorded route from the latest catalog. */
function routeLabels(catalog: ModelCatalogState['value'], route: Pick<UsageByRouteEntry, 'provider' | 'model' | 'reasoningEffort'>): RouteLabels {
  const group = catalog?.groups.find(candidate => candidate.id === route.provider)
  const model: ModelCatalogModel | undefined = group?.models.find(candidate => candidate.id === route.model)
  const effort = route.reasoningEffort === ''
    ? undefined
    : model?.reasoning?.efforts.find(candidate => candidate.id === route.reasoningEffort)?.name ?? route.reasoningEffort
  return {
    provider: group?.name ?? route.provider,
    model: model?.name ?? route.model,
    ...(effort === undefined ? {} : { effort }),
  }
}

/** Join every currency total into one localized line. */
function totalsText(totals: readonly CurrencyTotal[], locale: string): string {
  return totals.map(total => formatCost(total.amount, total.currency, locale)).join(' · ')
}

/**
 * Render the sidebar usage panel.
 * @param props - sidebar column state, copy, injected account/catalog hooks, and pricing inputs.
 * @returns the summary row and, when open, its detail; nothing for a signed-out account.
 */
export function UsagePanel({
  wide, t, useSessions, useAccount, useCatalog, phaseOfHour, refreshBalance, lowBalance,
}: UsagePanelProps): ReactNode {
  const account = useAccount(value => value)
  const catalog = useCatalog(value => value)
  const usage = useSessions(activeUsage)
  const [open, setOpen] = useState(false)
  const detailId = useId()

  const price = useMemo(() => {
    const models = new Map<string, ModelCatalogModel>()
    for (const group of catalog.value?.groups ?? []) {
      for (const model of group.models) models.set(`${group.id}\u0000${model.id}`, model)
    }
    return priceUsage(usage?.routes ?? [], (provider, model) => models.get(`${provider}\u0000${model}`)?.pricing, phaseOfHour)
  }, [catalog, usage, phaseOfHour])

  const locale = t('number.locale')
  const sessionText = price.totals.length > 0 ? totalsText(price.totals, locale) : t('noUsage')
  const wallets = account.wallets ?? []
  const balanceText = wallets.length > 0
    ? wallets.map(wallet => formatWallet(wallet.balance, wallet.currency, locale)).join(' · ')
    : account.balanceFailed ? t('balanceUnavailable') : t('loading')
  const low = wallets.filter(wallet => isLowBalance(wallet.balance, lowBalance[wallet.currency]))
  const lowText = low.map(wallet => formatWallet(wallet.balance, wallet.currency, locale)).join(' · ')
  const tooltip = t('summary.tooltip', { session: sessionText, balance: balanceText })

  if (account.status !== 'signed-in') return null

  /** Open or close the detail and, on opening, refresh the balance read. */
  const toggle = (): void => {
    const next = !open
    setOpen(next)
    if (next) void refreshBalance()
  }

  return (
    <div className={css.root}>
      {wide && open && (
        <div className={css.detail} id={detailId} role="region" aria-label={t('aria')}>
          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span>{t('session')}</span>
              <span className={css.amount}>{sessionText}</span>
            </div>
            {price.routes.length === 0
              ? <p className={css.empty}>{t('noUsage')}</p>
              : (
                <ul className={css.routes} aria-label={t('routes.label')}>
                  {price.routes.map((route) => {
                    const labels = routeLabels(catalog.value, route)
                    const key = `${route.provider}\u0000${route.model}\u0000${route.reasoningEffort}`
                    return (
                      <li key={key} className={css.route}>
                        <span className={css.routeCopy}>
                          <span className={css.routeModel} title={labels.provider}>{labels.model}</span>
                          {labels.effort !== undefined && <span className={css.routeEffort}>{labels.effort}</span>}
                        </span>
                        <span className={css.routeAmount}>
                          {route.currency === undefined ? '—' : formatCost(route.amount, route.currency, locale)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            {price.unpricedTokens > 0 && <p className={css.note}>{t('unpriced')}</p>}
          </div>
          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span>{t('balance')}</span>
              <span className={css.amount}>{balanceText}</span>
            </div>
            {low.length > 0 && (
              <p className={css.lowBalance} role="status">{t('lowBalance', { balance: lowText })}</p>
            )}
            {account.links !== undefined && (
              <span className={css.links}>
                <a className={css.link} href={account.links.topUpUrl} target="_blank" rel="noreferrer">
                  {t('topUp')}
                </a>
                <a className={css.link} href={account.links.usageUrl} target="_blank" rel="noreferrer">
                  {t('usage')}
                </a>
              </span>
            )}
          </div>
          <p className={css.note}>{t('estimateNote')}</p>
        </div>
      )}
      {wide
        ? (
          <button
            type="button"
            className={css.summary}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={t(open ? 'collapse.reading' : 'expand.reading', { reading: tooltip })}
            onClick={toggle}
          >
            <span className={css.glyph} aria-hidden="true"><IconGaugeOutlineRegular size={16} /></span>
            <span className={css.title}>{t('title')}</span>
            {low.length > 0 && <span className={css.lowDot} aria-hidden="true" />}
            <span className={css.amount}>{sessionText}</span>
            <span className={css.chevron} aria-hidden="true">
              {open ? <IconChevronDownOutlineRegular size={12} /> : <IconChevronUpOutlineRegular size={12} />}
            </span>
          </button>
        )
        : (
          <Tooltip label={tooltip} side="right" maxWidth={320}>
            <span className={css.rail} role="note" aria-label={`${t('aria')}: ${tooltip}`}>
              <IconGaugeOutlineRegular size={18} />
              {low.length > 0 && <span className={css.lowDot} aria-hidden="true" />}
            </span>
          </Tooltip>
        )}
    </div>
  )
}
