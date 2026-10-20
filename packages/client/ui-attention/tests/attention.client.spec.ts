/** Desktop attention reporting over the session catalog and the approval waterfall. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { apply } from '../src/client/index.ts'

interface ListState {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, { running: boolean }>>
}

type Report = { kind: string; sessionId: string }
type ApprovalListener = (this: Context, request: { toolName: string }, next: () => Promise<string>) => Promise<string>

function bench() {
  const report = vi.fn<(event: Report) => void>()
  vi.stubGlobal('dshDesktop', { activity: { report } })
  const ctx = new Context()
  const list = createSnapshotStore<ListState>({ ids: [], byId: {} })
  const scopeOf = vi.fn((): string | undefined => 'session-1')
  ctx.provide('sessions', { list, scopeOf } as never)
  const approvals: ApprovalListener[] = []
  ctx.provide('remote', {
    $on: vi.fn((event: string, listener: ApprovalListener) => {
      if (event === 'approval/request') approvals.push(listener)
      return () => {}
    }),
  } as never)
  apply(ctx)
  return {
    report,
    scopeOf,
    approvals,
    // Arrow property, not a method: destructuring a method would trip unbound-method.
    emit: (ids: readonly string[], byId: ListState['byId']): void => {
      list.set({ ids, byId })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('task completion', () => {
  it('baselines the first observation and reports one completion per convergence', () => {
    const { report, emit } = bench()
    emit(['session-1'], { 'session-1': { running: true } })
    expect(report).not.toHaveBeenCalled()
    emit(['session-1'], { 'session-1': { running: false } })
    expect(report).toHaveBeenCalledExactlyOnceWith({ kind: 'task-complete', sessionId: 'session-1' })
    emit(['session-1'], { 'session-1': { running: false } })
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('never reports catalog fallback rows outside the Host list', () => {
    const { report, emit } = bench()
    emit([], { 'subagent-1': { running: true } })
    emit([], { 'subagent-1': { running: false } })
    expect(report).not.toHaveBeenCalled()
  })

  it('forgets removed sessions so a re-added session baselines again', () => {
    const { report, emit } = bench()
    emit(['session-1'], { 'session-1': { running: true } })
    emit([], { 'session-1': { running: true } })
    emit(['session-1'], { 'session-1': { running: true } })
    emit(['session-1'], { 'session-1': { running: false } })
    expect(report).toHaveBeenCalledExactlyOnceWith({ kind: 'task-complete', sessionId: 'session-1' })
  })
})

describe('approvals', () => {
  it('wraps the waterfall and reports resolution after the consumer answers', async () => {
    const { report, approvals } = bench()
    expect(approvals).toHaveLength(1)
    const order: string[] = []
    const outcome = await approvals[0]!.call({} as Context, { toolName: 'bash' }, async () => {
      order.push('next')
      return 'allowed-once'
    })
    expect(outcome).toBe('allowed-once')
    expect(order).toEqual(['next'])
    expect(report.mock.calls.map(([event]) => event)).toEqual([
      { kind: 'approval-request', sessionId: 'session-1' },
      { kind: 'approval-resolved', sessionId: 'session-1' },
    ])
  })

  it('passes through approvals without a session scope without reporting', async () => {
    const { report, scopeOf, approvals } = bench()
    scopeOf.mockReturnValue(undefined)
    const answer = await approvals[0]!.call({} as Context, { toolName: 'bash' }, async () => 'rejected')
    expect(answer).toBe('rejected')
    expect(report).not.toHaveBeenCalled()
  })
})

describe('without the Desktop bridge', () => {
  it('registers neither observer', () => {
    vi.stubGlobal('dshDesktop', {})
    const ctx = new Context()
    const list = createSnapshotStore<ListState>({ ids: [], byId: {} })
    const subscribe = vi.fn(() => () => {})
    const listDouble = { getSnapshot: () => list.getSnapshot(), set: list.set.bind(list), subscribe }
    const on = vi.fn()
    ctx.provide('sessions', { list: listDouble, scopeOf: () => 'session-1' } as never)
    ctx.provide('remote', { $on: on } as never)
    apply(ctx)
    expect(subscribe).not.toHaveBeenCalled()
    expect(on).not.toHaveBeenCalled()
  })
})
