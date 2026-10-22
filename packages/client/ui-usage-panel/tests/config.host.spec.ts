/** Low-balance thresholds are validated Host configuration embedded in the page bootstrap. */
import { Context } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished } from 'vitest'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { apply, Config } from '../src/index.ts'
import { USAGE_PANEL_CONFIG_GLOBAL } from '../src/config.ts'

it('fills default thresholds, accepts deployment overrides, and injects the validated value', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  expect(Config({}).lowBalance).toEqual({ CNY: 10, USD: 1 })
  expect(Config({ lowBalance: { USD: 0.25 } }).lowBalance).toEqual({ CNY: 10, USD: 0.25 })
  await ctx.plugin({ Config, apply }, { lowBalance: { USD: 0.25 } })
  const table: IndexInjection[] = []
  ctx.emit('webserver/index-inject', table)
  expect(table).toEqual([{
    kind: 'global',
    name: USAGE_PANEL_CONFIG_GLOBAL,
    value: { lowBalance: { CNY: 10, USD: 0.25 } },
  }])
  await ctx.fiber.dispose()
  table.length = 0
  ctx.emit('webserver/index-inject', table)
  expect(table).toEqual([])
})
