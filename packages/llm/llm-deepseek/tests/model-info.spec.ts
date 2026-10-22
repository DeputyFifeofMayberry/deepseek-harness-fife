/** Catalog metadata supports embedding callers without deployment normalization. */
import { expect, it } from 'vitest'
import { catalogModelInfo } from '../src/model-info.ts'
import { DEFAULT_MODELS } from '../src/models.ts'

it('advertises a minimal model declaration as text input with its ID as the label', () => {
  expect(catalogModelInfo('deepseek-official', { id: 'embedded-model' })).toEqual({
    provider: 'deepseek-official', id: 'embedded-model', name: 'embedded-model', inputModalities: ['text'],
  })
})

it('republishes catalog pricing unchanged', () => {
  const pricing = {
    currency: 'USD',
    inputPerMillion: 0.3,
    outputPerMillion: 1.2,
    cacheReadPerMillion: 0.006,
    cacheWritePerMillion: 0.3,
    offPeakMultiplier: 0.5,
  }
  expect(catalogModelInfo('deepseek-official', { id: 'priced-model', pricing })).toMatchObject({ pricing })
})

it('ships the published peak rates for both default models', () => {
  expect(DEFAULT_MODELS.map(model => [model.id, model.pricing?.inputPerMillion, model.pricing?.outputPerMillion]))
    .toEqual([['deepseek-flash', 0.3, 1.2], ['deepseek-v4-pro', 1.32, 3.96]])
  expect(DEFAULT_MODELS.every(model => model.pricing?.offPeakMultiplier === 0.5)).toBe(true)
})
