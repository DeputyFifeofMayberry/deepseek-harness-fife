/**
 * Deployment thresholds at or below which the usage panel marks an account
 * balance as low. Amounts are stated in each wallet's own currency; a currency
 * without a threshold is never marked low.
 *
 * @module @deepseek-ai/dsh-client-ui-usage-panel/config
 */
import z from '@deepseek-ai/schemastery'

/** Low-balance threshold per supported Platform wallet currency. */
export interface LowBalanceThresholds {
  /** Threshold for a CNY wallet. */
  CNY: number
  /** Threshold for a USD wallet. */
  USD: number
}

/** Deployment configuration for the sidebar usage panel. */
export interface Config {
  /** Wallet-currency thresholds that mark a balance as low. */
  lowBalance: LowBalanceThresholds
}

/** Browser global carrying the validated Host configuration. */
export const USAGE_PANEL_CONFIG_GLOBAL = '__DSH_USAGE_PANEL_CONFIG__'

/**
 * Validated deployment configuration. The defaults mark roughly one
 * substantive session as low; deployments price their own alert level.
 */
export const Config: z<{ lowBalance?: Partial<LowBalanceThresholds> }, Config> = z.object({
  lowBalance: z.object({
    CNY: z.number().min(0).default(10),
    USD: z.number().min(0).default(1),
  }).default({}),
})
