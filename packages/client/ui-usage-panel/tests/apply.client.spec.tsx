// @vitest-environment jsdom
/** Usage panel registration in the shipped client composition. */
import { expect, vi } from 'vitest'
import { createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { UsagePanel, type UsagePanelInjected } from '../src/client/UsagePanel.tsx'

const it = createClientTest({ roster: webApp })
const SELF = '@deepseek-ai/dsh-client-ui-usage-panel'

it('registers one footer panel over the shared account, catalog, and phase services', async ({ start }) => {
  const c = await start()
  const entries = c.ctx.slots.entries('sidebar.footer.panel')
  expect(entries).toHaveLength(1)
  expect(entries[0]!.component).toBe(UsagePanel)
  expect(entries[0]!.locale).toBe('usagePanel')
  const injected: object = entries[0]!.inject!()
  const panel = injected as UsagePanelInjected
  const injectedPanel = panel
  expect(injectedPanel.hooks.account.getSnapshot().status).toBe('signed-out')
  expect(injectedPanel.hooks.catalog.getSnapshot().status).toBeDefined()
  expect(injectedPanel.lowBalance).toEqual({ CNY: 10, USD: 1 })
  // Monday 00:00 is off-peak; Monday 02:00 and 06:00 are inside peak windows.
  expect(injectedPanel.phaseOfHour(0)).toBe('off-peak')
  expect(injectedPanel.phaseOfHour(2)).toBe('peak')
  expect(injectedPanel.phaseOfHour(5)).toBe('off-peak')
  expect(injectedPanel.phaseOfHour(6)).toBe('peak')
  await injectedPanel.refreshBalance()

  await c.unload(SELF)
  expect(c.ctx.slots.entries('sidebar.footer.panel')).toHaveLength(0)
}, 60_000)

it('reads deployment low-balance thresholds from the page configuration', async ({ start }) => {
  vi.stubGlobal('__DSH_USAGE_PANEL_CONFIG__', { lowBalance: { USD: 0.25 } })
  try {
    const c = await start()
    const injected: object = c.ctx.slots.entries('sidebar.footer.panel')[0]!.inject!()
    expect((injected as UsagePanelInjected).lowBalance).toEqual({ CNY: 10, USD: 0.25 })
  } finally {
    vi.unstubAllGlobals()
  }
}, 60_000)
