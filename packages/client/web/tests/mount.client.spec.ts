// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import type { ClientEntries, ClientEntryState } from '@deepseek-ai/dsh-client-modules/client'
import * as UiRenderer from '@deepseek-ai/dsh-client-ui-renderer/client'
import { act } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mountClient } from '../src/mount.ts'
import { BootPage } from '../src/boot-page.ts'

/** Provide a fake `uiRenderer` from its own plugin fiber so it can be replaced. */
function provideRenderer(ctx: Context, mount: (container: HTMLElement) => () => void) {
  return ctx.plugin({ apply: (scope: Context) => { scope.reflect.provide('uiRenderer', { mount }) } })
}

function entryStates() {
  let snapshot: ClientEntryState = { syncing: false, failures: [] }
  const listeners = new Set<() => void>()
  const state: ClientEntries['state'] = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
  return { state, listeners, publish(next: ClientEntryState) { snapshot = next; for (const listener of listeners) listener() } }
}

describe('mountClient', () => {
  it('keeps the real React root unmounted while its layout registration is absent', async () => {
    const ctx = new Context()
    const states = entryStates()
    const container = document.createElement('div')
    document.body.append(container)
    new BootPage(container)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await ctx.plugin(UiRenderer)
      const binding = { key: undefined, hooks: {}, keyedHooks: {}, props: {} }
      const current = { getSnapshot: () => binding, subscribe: () => () => {} }
      ctx.slots.installScope('session', { current, bindingSource: () => current })
      const layout = () => ctx.plugin({
        inject: ['slots'],
        apply(scope: Context) { scope.slots.register({ name: 'root' }, () => createElement('div', {}, 'Workspace ready')) },
      })
      const first = layout()
      await first
      await act(async () => {
        await mountClient(ctx, container, states.state)
        expect(container.textContent).toBe('Workspace ready')
        states.publish({ syncing: true, failures: [] })
        await first.dispose()
      })
      expect(container.textContent).toContain('Loading plugins')
      await act(async () => {
        await layout()
        states.publish({ syncing: false, failures: [] })
      })
      expect(container.textContent).toBe('Workspace ready')
      expect(error).not.toHaveBeenCalled()
    } finally {
      await act(async () => { await ctx.fiber.dispose() })
      error.mockRestore()
      container.remove()
    }
  })
  it('mounts into the container and unmounts when the tree is disposed', async () => {
    const ctx = new Context()
    const unmount = vi.fn()
    const mount = vi.fn((_container: HTMLElement) => unmount)
    provideRenderer(ctx, mount)
    const container = document.createElement('div')

    await mountClient(ctx, container, entryStates().state)

    expect(mount).toHaveBeenCalledExactlyOnceWith(container)
    expect(unmount).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
    expect(unmount).toHaveBeenCalledOnce()
  })

  it('remounts when uiRenderer is replaced', async () => {
    const ctx = new Context()
    const container = document.createElement('div')
    const first = { unmount: vi.fn(), mount: vi.fn(() => first.unmount) }
    const second = { unmount: vi.fn(), mount: vi.fn(() => second.unmount) }

    await mountClient(ctx, container, entryStates().state)
    expect(first.mount).not.toHaveBeenCalled()

    const renderer = provideRenderer(ctx, first.mount)
    await vi.waitFor(() => { expect(first.mount).toHaveBeenCalledExactlyOnceWith(container) })

    await renderer.dispose()
    expect(first.unmount).toHaveBeenCalledOnce()

    provideRenderer(ctx, second.mount)
    await vi.waitFor(() => { expect(second.mount).toHaveBeenCalledExactlyOnceWith(container) })
    await ctx.fiber.dispose()
    expect(second.unmount).toHaveBeenCalledOnce()
  })

  it('unmounts before entry teardown and waits for settled replacement services before mounting again', async () => {
    const ctx = new Context()
    const states = entryStates()
    const container = document.createElement('div')
    const first = { unmount: vi.fn(), mount: vi.fn(() => first.unmount) }
    const second = { unmount: vi.fn(), mount: vi.fn(() => second.unmount) }
    const renderer = provideRenderer(ctx, first.mount)
    try {
      await mountClient(ctx, container, states.state)
      states.publish({ syncing: true, failures: [] })
      expect(first.unmount).toHaveBeenCalledOnce()
      expect(container.textContent).toContain('Loading plugins')
      await renderer.dispose()
      const replacement = provideRenderer(ctx, second.mount)
      await replacement
      expect(second.mount).not.toHaveBeenCalled()
      states.publish({ syncing: false, failures: [] })
      expect(second.mount).toHaveBeenCalledOnce()
      expect(container.textContent).not.toContain('Loading plugins')
    } finally { await ctx.fiber.dispose() }
    expect(states.listeners.size).toBe(0)
    expect(second.unmount).toHaveBeenCalledOnce()
    expect(container.textContent).toBe('')
  })

  it('keeps failed reconciliation visible and remounts after a successful retry', async () => {
    const ctx = new Context()
    const states = entryStates()
    const container = document.createElement('div')
    const mount = vi.fn(() => {
      expect(container.querySelector('[data-dsh-boot]')).toBeNull()
      return vi.fn()
    })
    provideRenderer(ctx, mount)
    try {
      await mountClient(ctx, container, states.state)
      states.publish({ syncing: false, failures: [{ id: 'layout', message: 'bundle unavailable' }] })
      expect(container.textContent).toContain('layout: bundle unavailable')
      expect(container.textContent).toContain('Failed to load plugins')
      expect(mount).toHaveBeenCalledOnce()
      states.publish({ syncing: true, failures: [] })
      expect(container.textContent).toContain('Loading plugins')
      states.publish({ syncing: false, failures: [] })
      expect(mount).toHaveBeenCalledTimes(2)
      states.publish({ syncing: false, failures: [] })
      expect(mount).toHaveBeenCalledTimes(2)
    } finally { await ctx.fiber.dispose() }
  })
})
