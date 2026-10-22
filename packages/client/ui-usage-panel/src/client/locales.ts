/** `usagePanel` dictionaries for the sidebar usage and balance panel. */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Dictionary namespace owned by this plugin. */
export const NS = 'usagePanel'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'number.locale': 'zh-CN',
  'title': '用量',
  'aria': '用量与余额',
  'session': '本会话',
  'balance': '余额',
  'noUsage': '暂无用量',
  'loading': '加载中…',
  'balanceUnavailable': '余额不可用',
  'topUp': '充值',
  'usage': '用量',
  'lowBalance': '余额不足：{balance}',
  'unpriced': '部分 token 没有公开价格。',
  'estimateNote': '按服务商上报的用量与模型公开价格估算，并按其请求时段计价。',
  'tokens': '{tokens} 个 token',
  'expand': '展开用量详情',
  'collapse': '收起用量详情',
  'expand.reading': '展开用量详情：{reading}',
  'collapse.reading': '收起用量详情：{reading}',
  'summary.tooltip': '本会话：{session}。余额：{balance}。',
  'routes.label': '按模型统计的用量',
  'defaultEffort': '默认',
} satisfies Record<string, string>

/** The usagePanel namespace key union. */
export type UsagePanelKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy of the sidebar usage and balance panel. */
    usagePanel: UsagePanelKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'number.locale': 'en',
  'title': 'Usage',
  'aria': 'Usage and balance',
  'session': 'This session',
  'balance': 'Balance',
  'noUsage': 'No usage yet',
  'loading': 'Loading…',
  'balanceUnavailable': 'Balance unavailable',
  'topUp': 'Top up',
  'usage': 'Usage',
  'lowBalance': 'Low balance: {balance}',
  'unpriced': 'Some tokens have no published price.',
  'estimateNote': 'Estimated from provider-reported usage and published model rates, priced at each request’s hour.',
  'tokens': '{tokens} tokens',
  'expand': 'Show usage details',
  'collapse': 'Hide usage details',
  'expand.reading': 'Show usage details: {reading}',
  'collapse.reading': 'Hide usage details: {reading}',
  'summary.tooltip': 'This session: {session}. Balance: {balance}.',
  'routes.label': 'Usage by model',
  'defaultEffort': 'Default',
} satisfies Record<UsagePanelKey, string>
