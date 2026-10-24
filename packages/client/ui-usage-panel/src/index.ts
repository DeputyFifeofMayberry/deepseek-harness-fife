/** Host configuration for the sidebar usage panel. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { Config, USAGE_PANEL_CONFIG_GLOBAL } from './config.ts'

export { Config } from './config.ts'

/**
 * Embed validated low-balance thresholds in browser pages before client
 * plugins activate.
 * @param ctx - Host context collecting page initialization data.
 * @param config - validated deployment configuration.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: USAGE_PANEL_CONFIG_GLOBAL, value: config })
  })
}
