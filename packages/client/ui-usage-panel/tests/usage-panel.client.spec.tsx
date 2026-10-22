// @vitest-environment jsdom
/** Sidebar usage panel presentation: summary, detail, rail, and balance states. */
import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelCatalog } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ModelCatalogState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { AccountReadSnapshot } from '@deepseek-ai/dsh-client-ui-settings-account/client'
import type { UsageByRouteProjection } from '@deepseek-ai/dsh-token-meter/client'
import { UsagePanel, type UsagePanelProps } from '../src/client/UsagePanel.tsx'
import { en, zh } from '../src/client/locales.ts'
import type { RoutePricing } from '../src/client/pricing.ts'

const PRICING: RoutePricing = {
  currency: 'USD', inputPerMillion: 2, outputPerMillion: 4, cacheReadPerMillion: 0.5, cacheWritePerMillion: 2, offPeakMultiplier: 0.5,
}

const CATALOG: ModelCatalog = {
  default: { provider: 'deepseek', model: 'deepseek-flash' },
  routableProviders: ['deepseek'],
  groups: [{
    id: 'deepseek',
    name: 'DeepSeek',
    models: [{
      id: 'deepseek-flash',
      name: 'DeepSeek-V4.1-Flash',
      reasoning: { efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high' },
      pricing: PRICING,
    }],
  }],
  failures: [],
}

const ACCOUNT: AccountReadSnapshot = {
  status: 'signed-in',
  links: { usageUrl: 'https://platform.test/usage', topUpUrl: 'https://platform.test/top-up' },
  wallets: [{ currency: 'USD', balance: '0.50' }],
}

const USAGE: UsageByRouteProjection = {
  routes: [{
    provider: 'deepseek',
    model: 'deepseek-flash',
    reasoningEffort: 'high',
    buckets: [{ hourOfWeek: 2, usage: { uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }],
  }],
}

/** Minimal translate seat over one dictionary. */
function makeTranslate(dictionary: Record<string, string>): UsagePanelProps['t'] {
  return (key, params) => (dictionary[key] ?? '').replace(/\{(\w+)\}/gu, (_match, name: string) => {
    const value = params?.[name]
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  })
}

function usageState(usage: UsageByRouteProjection | undefined): SessionListState {
  const session = 'session-1' as SessionListState['ids'][number]
  return {
    ids: [session],
    byId: {
      [session]: {
        id: session, displayTitle: 'Session', running: false, blank: false, updatedAt: 0,
        retainedBy: { mainView: 1 },
      },
    },
    phase: 'ready',
    projectionsBySession: {
      [session]: { values: usage === undefined ? {} : { usageByRoute: usage }, state: 'idle', error: null },
    },
  }
}

/** The renderer injects the global standard props; direct renders stub them out. */
function panelProps(overrides: {
  wide?: boolean
  t?: UsagePanelProps['t']
  usage?: UsageByRouteProjection | null
  list?: SessionListState
  account?: AccountReadSnapshot
  catalog?: ModelCatalogState
  phaseOfHour?: UsagePanelProps['phaseOfHour']
  refreshBalance?: UsagePanelProps['refreshBalance']
  lowBalance?: UsagePanelProps['lowBalance']
}): ComponentProps<typeof UsagePanel> {
  const account = overrides.account ?? ACCOUNT
  const catalog = overrides.catalog ?? { value: CATALOG, status: 'ready', error: null }
  const usage = overrides.usage === null ? undefined : overrides.usage ?? USAGE
  return {
    wide: overrides.wide ?? true,
    t: overrides.t ?? makeTranslate(en),
    useSessions: selector => selector(overrides.list ?? usageState(usage)),
    useAccount: selector => selector(account),
    useCatalog: selector => selector(catalog),
    phaseOfHour: overrides.phaseOfHour ?? (() => 'peak'),
    refreshBalance: overrides.refreshBalance ?? vi.fn(async () => {}),
    lowBalance: overrides.lowBalance ?? { CNY: 10, USD: 1 },
  } as UsagePanelProps
}

afterEach(() => { cleanup() })

describe('UsagePanel', () => {
  it('renders nothing for a signed-out or unknown account', () => {
    for (const status of ['signed-out', 'unknown'] as const) {
      const view = render(<UsagePanel {...panelProps({ account: { status } })} />)
      expect(view.container.textContent).toBe('')
      cleanup()
    }
  })

  it('summarizes the active Session and expands into route and balance detail', () => {
    const refreshBalance = vi.fn(async () => {})
    const view = render(<UsagePanel {...panelProps({ refreshBalance })} />)
    expect(screen.getByText('Usage')).toBeTruthy()
    expect(screen.getByText('$2.00')).toBeTruthy()
    expect(screen.queryByText('This session')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Show usage details:/u }))
    expect(refreshBalance).toHaveBeenCalledOnce()
    expect(screen.getByText('This session')).toBeTruthy()
    expect(screen.getByText('DeepSeek-V4.1-Flash')).toBeTruthy()
    expect(screen.getByText('High')).toBeTruthy()
    expect(screen.getAllByText('$2.00')).toHaveLength(3)
    expect(screen.getByText('Balance')).toBeTruthy()
    expect(screen.getByText('$0.50')).toBeTruthy()
    expect(screen.getByText('Low balance: $0.50')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Top up' }).getAttribute('href')).toBe('https://platform.test/top-up')
    expect(screen.getByRole('link', { name: 'Usage' }).getAttribute('href')).toBe('https://platform.test/usage')
    expect(screen.getByRole('region', { name: 'Usage and balance' })).toBeTruthy()
    expect(view.container.textContent).toContain('Estimated from provider-reported usage')

    fireEvent.click(screen.getByRole('button', { name: /^Hide usage details:/u }))
    expect(screen.queryByText('This session')).toBeNull()
  })

  it('uses the published off-peak multiplier for off-peak buckets', () => {
    render(<UsagePanel {...panelProps({ phaseOfHour: () => 'off-peak' })} />)
    expect(screen.getByText('$1.00')).toBeTruthy()
  })

  it('shows an empty session and unavailable balance without inventing values', () => {
    render(<UsagePanel {...panelProps({
      usage: { routes: [] },
      account: { status: 'signed-in', balanceFailed: true },
      lowBalance: { CNY: 10, USD: 1 },
    })} />)
    expect(screen.getByText('No usage yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Show usage details:/u }))
    expect(screen.getAllByText('No usage yet')).toHaveLength(3)
    expect(screen.getByText('Balance unavailable')).toBeTruthy()
  })

  it('shows no usage before a main-view Session is retained', () => {
    const list = usageState(USAGE)
    const session = list.ids[0]!
    list.byId[session] = { ...list.byId[session]!, retainedBy: {} }
    render(<UsagePanel {...panelProps({ list })} />)
    expect(screen.getByText('No usage yet')).toBeTruthy()
  })

  it('omits an absent effort label and shows a loading balance with no links', () => {
    const usage: UsageByRouteProjection = {
      routes: [{
        provider: 'deepseek',
        model: 'deepseek-flash',
        reasoningEffort: '',
        buckets: [{ hourOfWeek: 2, usage: { uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }],
      }],
    }
    render(<UsagePanel {...panelProps({
      usage,
      account: { status: 'signed-in' },
    })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Show usage details:/u }))
    expect(screen.getByText('DeepSeek-V4.1-Flash')).toBeTruthy()
    expect(screen.queryByText('High')).toBeNull()
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Top up' })).toBeNull()
  })

  it('keeps an unpriced route visible and explains the missing price', () => {
    render(<UsagePanel {...panelProps({ catalog: { value: null, status: 'idle', error: null } })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Show usage details:/u }))
    expect(screen.getByText('deepseek-flash')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('Some tokens have no published price.')).toBeTruthy()
  })

  it('collapses to one accessible rail icon with the same reading', () => {
    render(<UsagePanel {...panelProps({ wide: false })} />)
    expect(screen.queryByText('Usage')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('note', { name: /^Usage and balance:/u })).toBeTruthy()
  })

  it('renders localized Chinese copy', () => {
    render(<UsagePanel {...panelProps({
      t: makeTranslate(zh),
      account: { ...ACCOUNT, wallets: [{ currency: 'CNY', balance: '3.50' }] },
    })} />)
    expect(screen.getByText('用量')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^展开用量详情：/u }))
    expect(screen.getByText('余额')).toBeTruthy()
    expect(screen.getByText('余额不足：¥3.50')).toBeTruthy()
  })
})
