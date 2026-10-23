import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'

describe('pruneNewResultsAtStep configuration', () => {
  it('defaults to off and keeps the resolved value detached', () => {
    const resolved = resolveConfig({})
    expect(resolved.pruneNewResultsAtStep).toBe(false)
    expect(resolved.auto).toBe(true)
  })

  it('accepts an explicit on value', () => {
    expect(resolveConfig({ pruneNewResultsAtStep: true }).pruneNewResultsAtStep).toBe(true)
    expect(resolveConfig({ pruneNewResultsAtStep: false }).pruneNewResultsAtStep).toBe(false)
  })

  it('rejects non-boolean values and stale spellings', () => {
    expect(() => resolveConfig({ pruneNewResultsAtStep: 'yes' as never }))
      .toThrow(/pruneNewResultsAtStep must be a boolean/)
    expect(() => resolveConfig({ pruneNewResultsAtStep: 1 as never }))
      .toThrow(/pruneNewResultsAtStep must be a boolean/)
    expect(() => resolveConfig({ pruneAtStep: true } as never))
      .toThrow(/unknown key "pruneAtStep"/)
  })

  it('stays out of the per-model policy vocabulary', () => {
    expect(() => resolveConfig({
      modelPolicies: [{ provider: 'p', model: 'm', pruneNewResultsAtStep: true } as never],
    })).toThrow(/unknown key "pruneNewResultsAtStep"/)
  })
})
