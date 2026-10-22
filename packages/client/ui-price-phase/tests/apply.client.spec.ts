// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.ts'
import { pricePhase } from '../src/client/price-phase.ts'
import { apply as hostApply } from '../src/index.ts'

const INSTANT = Date.UTC(2026, 9, 21, 2, 0, 0)

afterEach(() => {
  vi.useRealTimers()
})

describe('ui-price-phase apply', () => {
  it('provides one shared phase service and injects it into the chip', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(INSTANT)
    const ctx = new Context()
    const register = vi.fn()
    const inject = vi.fn((_name: string, factory: () => unknown) => { factory() })
    ctx.provide('slots', { inject, register } as never)
    ctx.provide('locale', { register: vi.fn(() => () => undefined) } as never)

    apply(ctx)

    expect(ctx.pricePhase.reading.getSnapshot()).toEqual(pricePhase(INSTANT))
    expect(ctx.pricePhase.at(INSTANT)).toEqual(pricePhase(INSTANT))
    expect(register).toHaveBeenCalledTimes(1)
    const options = register.mock.calls[0]?.[0] as {
      inject: () => { hooks: { phase: unknown } }
    }
    expect(options.inject().hooks.phase).toBe(ctx.pricePhase.reading)
    await ctx.fiber.dispose()
  })

  it('keeps the host half inert', () => {
    expect(() => { hostApply() }).not.toThrow()
  })
})
