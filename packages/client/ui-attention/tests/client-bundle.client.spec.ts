// @vitest-environment jsdom
/**
 * Real tsdown artifact shape: lib/client.js hands off through
 * window.__ModuleLoader__.load, needs no externals through the injected
 * require, exports apply + inject, and a mounted apply reports through the
 * Desktop bridge until fiber disposal. Skips when lib/ is not built
 * (`pnpm --filter @deepseek-ai/dsh-client-ui-attention bundle`).
 */
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'

const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-attention'

interface Handoff { id: string; factory: (require: (spec: string) => unknown) => Record<string, unknown> }
type Win = { __ModuleLoader__?: { load(h: Handoff): void } }

function readBundle(): string | undefined {
  try {
    // import.meta.url is http-scheme in the jsdom pool; vitest runs from the
    // repo root, so resolve the artifact repo-relatively instead.
    return readFileSync(resolve('packages/client/ui-attention/lib/client.js'), 'utf8')
  } catch {
    return undefined
  }
}

afterEach(() => {
  delete (window as Win).__ModuleLoader__
  vi.unstubAllGlobals()
})

describe('tsdown client artifact', () => {
  const code = readBundle()

  async function loadArtifact() {
    let handoff: Handoff | undefined
    ;(window as Win).__ModuleLoader__ = { load: (h) => { handoff = h } }
    // The implied-eval ban targets accidental string execution, not this
    // deliberate built-bundle fixture running in the window scope.
    // oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call
    new Function(code!)()
    expect(handoff).toBeDefined()
    // The bundle is type-only against its neighbors: any module request here
    // would be an undeclared external.
    const exports = handoff!.factory(() => { throw new Error('unexpected require') })
    return { handoff: handoff!, exports }
  }

  it.skipIf(code === undefined)('hands off with the manifest id, apply, and inject', async () => {
    const { handoff, exports } = await loadArtifact()
    expect(handoff.id).toBe(PLUGIN_ID)
    expect(exports.apply).toBeTypeOf('function')
    expect(exports.inject).toEqual(['sessions', 'remote'])
  })

  it.skipIf(code === undefined)('mounted as an object plugin, reports convergences and stops at disposal', async () => {
    const { exports } = await loadArtifact()
    const reports: Array<{ kind: string; sessionId: string }> = []
    vi.stubGlobal('dshDesktop', { activity: { report: (event: { kind: string; sessionId: string }) => { reports.push(event) } } })
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const list = createSnapshotStore<{ ids: string[]; byId: Record<string, { running: boolean }> }>({ ids: [], byId: {} })
    const listeners: unknown[] = []
    ctx.provide('sessions', { list, scopeOf: () => 'session-1' } as never)
    ctx.provide('remote', { $on: (_event: string, listener: unknown) => { listeners.push(listener); return () => {} } } as never)
    const fiber = ctx.plugin(exports as { apply: (ctx: Context) => void })
    await fiber.await()
    expect(listeners).toHaveLength(1)
    // First observation baselines; the transition reports exactly once.
    list.set({ ids: ['session-1'], byId: { 'session-1': { running: true } } })
    list.set({ ids: ['session-1'], byId: { 'session-1': { running: false } } })
    expect(reports).toEqual([{ kind: 'task-complete', sessionId: 'session-1' }])
    // Disposal releases the catalog subscription: later transitions stay silent.
    await fiber.dispose()
    list.set({ ids: ['session-1'], byId: { 'session-1': { running: true } } })
    list.set({ ids: ['session-1'], byId: { 'session-1': { running: false } } })
    expect(reports).toEqual([{ kind: 'task-complete', sessionId: 'session-1' }])
  })

  it.skipIf(code === undefined)('registers nothing without the Desktop bridge', async () => {
    const { exports } = await loadArtifact()
    vi.stubGlobal('dshDesktop', {})
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const subscribe = vi.fn(() => () => {})
    const on = vi.fn()
    ctx.provide('sessions', { list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe }, scopeOf: () => 'session-1' } as never)
    ctx.provide('remote', { $on: on } as never)
    const fiber = ctx.plugin(exports as { apply: (ctx: Context) => void })
    await fiber.await()
    expect(subscribe).not.toHaveBeenCalled()
    expect(on).not.toHaveBeenCalled()
    await fiber.dispose()
  })
})
