/** `pricePhase` dictionaries for the sidebar footer billing-phase chip. */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Dictionary namespace owned by this plugin. */
export const NS = 'pricePhase'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'time.locale': 'zh-CN',
  'phase.peak': '高峰',
  'phase.offPeak': '低谷',
  'chip.aria.peak': 'DeepSeek 高峰计价中',
  'chip.aria.offPeak': 'DeepSeek 低谷计价中',
  'tooltip.peak': 'DeepSeek 高峰计价，至 {time}。',
  'tooltip.offPeak': 'DeepSeek 低谷计价，至 {time}。',
  'tooltip.windows': '高峰时段：周一至周五 01:00–04:00 与 06:00–10:00（UTC；即北京时间 09:00–12:00、14:00–18:00），其余时间（含周末与中国法定节假日）为低谷。',
} satisfies Record<string, string>

/** The pricePhase namespace key union. */
export type PricePhaseKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy of the sidebar footer billing-phase chip. */
    pricePhase: PricePhaseKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'time.locale': 'en',
  'phase.peak': 'Peak',
  'phase.offPeak': 'Off-peak',
  'chip.aria.peak': 'DeepSeek peak rates in effect',
  'chip.aria.offPeak': 'DeepSeek off-peak rates in effect',
  'tooltip.peak': 'DeepSeek peak rates until {time}.',
  'tooltip.offPeak': 'DeepSeek off-peak rates until {time}.',
  'tooltip.windows': 'Peak hours: Mon–Fri 01:00–04:00 and 06:00–10:00 UTC (Beijing 09:00–12:00, 14:00–18:00); all other hours — weekends and Chinese public holidays included — are off-peak.',
} satisfies Record<PricePhaseKey, string>
