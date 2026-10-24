/** Default DeepSeek model catalog. */
import { DEFAULT_CONTEXT_WINDOW } from './defaults.ts'
import type { DeepSeekCatalogModel } from './types.ts'

/**
 * Published peak rates per million tokens; off-peak is half of peak. The
 * published table lists only cache hit and cache miss, so cache writes use
 * the cache-miss rate. Source: https://api-docs.deepseek.com/quick_start/pricing/
 */
const FLASH_PRICING = {
  currency: 'USD',
  inputPerMillion: 0.3,
  outputPerMillion: 1.2,
  cacheReadPerMillion: 0.006,
  cacheWritePerMillion: 0.3,
  offPeakMultiplier: 0.5,
} as const

/** Published peak rates for the Pro route; see {@link FLASH_PRICING}. */
const PRO_PRICING = {
  currency: 'USD',
  inputPerMillion: 1.32,
  outputPerMillion: 3.96,
  cacheReadPerMillion: 0.044,
  cacheWritePerMillion: 1.32,
  offPeakMultiplier: 0.5,
} as const

/** Advisory official model entries; deployments may replace the catalog. */
export const DEFAULT_MODELS: DeepSeekCatalogModel[] = [
  {
    id: 'deepseek-flash',
    name: 'DeepSeek-V4.1-Flash',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    inputModalities: ['text', 'image'],
    systemPromptUpdate: 'in-history',
    toolUpdate: 'addition-only',
    pricing: { ...FLASH_PRICING },
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek-V4-Pro',
    description: 'Stronger agentic coding, knowledge, and difficult reasoning; suited to complex or quality-critical tasks at higher cost.',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    pricing: { ...PRO_PRICING },
  },
]
