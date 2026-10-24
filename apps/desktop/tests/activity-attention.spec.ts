import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, expect, it, vi } from 'vitest'
import { DesktopActivityAttention, type DesktopActivityOptions } from '../src/activity-attention.ts'
import { resolveDesktopLocale } from '../src/locale.ts'

const native = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  const notices: Notice[] = []
  class Notice extends EventEmitter {
    static isSupported = vi.fn(() => true)
    show = vi.fn()
    close = vi.fn()
    constructor(readonly options: unknown) { super(); notices.push(this) }
  }
  return { notices, Notice }
})
vi.mock('electron', () => ({ Notification: native.Notice }))

const OPTIONS: DesktopActivityOptions = {
  enabled: true, taskComplete: true, approval: true, approvalSound: true, taskCompleteSound: false,
}

let attention: DesktopActivityAttention | undefined
afterEach(() => { attention?.reset(); native.notices.length = 0; vi.clearAllMocks(); native.Notice.isSupported.mockReturnValue(true) })

type WindowState = { visible?: boolean; focused?: boolean; minimized?: boolean; destroyed?: boolean }

function setup(options: Partial<DesktopActivityOptions> = {}, state: WindowState = {}) {
  const window = Object.assign(new EventEmitter(), {
    visible: true, focused: true, minimized: false,
    isDestroyed: () => state.destroyed ?? false,
    isVisible() { return this.visible },
    isFocused() { return this.focused },
    isMinimized() { return this.minimized },
    show: vi.fn(), focus: vi.fn(), restore: vi.fn(),
  })
  if (state.visible !== undefined) window.visible = state.visible
  if (state.focused !== undefined) window.focused = state.focused
  if (state.minimized !== undefined) window.minimized = state.minimized
  attention = new DesktopActivityAttention(
    () => resolveDesktopLocale('zh'),
    { ...OPTIONS, ...options },
    () => window as unknown as BrowserWindow,
  )
  return { window }
}

it.each([
  ['hidden', { visible: false }],
  ['minimized', { minimized: true }],
  ['unfocused', { focused: false }],
])('notifies hidden attention states: %s', (_name, state) => {
  const { window } = setup({}, state)
  attention!.report('task-complete', 'session-1')
  expect(native.notices).toHaveLength(1)
  expect(native.notices[0]!.options).toEqual({
    title: '任务已完成', body: '一个 DeepSeek Harness 会话已运行完成，点击返回。', silent: true,
  })
  expect(native.notices[0]!.show).toHaveBeenCalledOnce()
  expect(window.show).not.toHaveBeenCalled()
})

it('suppresses a visible, focused, restored window', () => {
  setup()
  attention!.report('task-complete', 'session-1')
  attention!.report('approval-request', 'session-1')
  expect(native.notices).toHaveLength(0)
})

it('keeps one owned approval notification, resolves it, and focuses on click', () => {
  const { window } = setup({}, { visible: false })
  attention!.report('approval-request', 'session-1')
  attention!.report('approval-request', 'session-2')
  expect(native.notices).toHaveLength(2)
  expect(native.notices[0]!.close).toHaveBeenCalledOnce()
  expect(native.notices[1]!.options).toEqual({
    title: '需要批准', body: 'DeepSeek Harness 正在等待你的批准，点击返回。', silent: false,
  })
  attention!.report('approval-resolved', 'session-2')
  expect(native.notices[1]!.close).toHaveBeenCalledOnce()
  window.minimized = true
  attention!.report('approval-request', 'session-3')
  const clickable = native.notices.at(-1)!
  clickable.emit('click')
  expect(window.restore).toHaveBeenCalledOnce()
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
})

it('keeps one task notification per converged session', () => {
  setup({}, { visible: false })
  attention!.report('task-complete', 'session-1')
  attention!.report('task-complete', 'session-2')
  expect(native.notices).toHaveLength(2)
  attention!.report('task-complete', 'session-1')
  expect(native.notices).toHaveLength(3)
  expect(native.notices[0]!.close).toHaveBeenCalledOnce()
})

it('honors the settings flags', () => {
  setup({ enabled: false }, { visible: false })
  attention!.report('task-complete', 'session-1')
  attention!.report('approval-request', 'session-1')
  expect(native.notices).toHaveLength(0)
  setup({ taskComplete: false, approvalSound: false, taskCompleteSound: true }, { visible: false })
  attention!.report('task-complete', 'session-1')
  attention!.report('approval-request', 'session-1')
  expect(native.notices).toHaveLength(1)
  expect(native.notices[0]!.options).toEqual({
    title: '需要批准', body: 'DeepSeek Harness 正在等待你的批准，点击返回。', silent: true,
  })
  setup({ taskCompleteSound: true }, { visible: false })
  attention!.report('task-complete', 'session-1')
  const audible = native.notices.at(-1)!
  expect(audible.options).toEqual({
    title: '任务已完成', body: '一个 DeepSeek Harness 会话已运行完成，点击返回。', silent: false,
  })
})

it('does not require notification support or a live window', () => {
  const { window } = setup({}, { visible: false })
  native.Notice.isSupported.mockReturnValue(false)
  attention!.report('task-complete', 'session-1')
  expect(native.notices).toHaveLength(0)
  setup({}, { visible: false, destroyed: true })
  attention!.report('task-complete', 'session-1')
  attention!.report('approval-request', 'session-1')
  expect(native.notices).toHaveLength(0)
  attention = new DesktopActivityAttention(() => resolveDesktopLocale('zh'), OPTIONS, () => undefined)
  attention.report('task-complete', 'session-1')
  expect(native.notices).toHaveLength(0)
  expect(window.isDestroyed()).toBe(false)
})

it('clears owned notifications on demand and survives failed shows', () => {
  setup({}, { visible: false })
  attention!.report('task-complete', 'session-1')
  attention!.report('approval-request', 'session-1')
  expect(native.notices).toHaveLength(2)
  attention!.clear()
  expect(native.notices[0]!.close).toHaveBeenCalledOnce()
  expect(native.notices[1]!.close).toHaveBeenCalledOnce()
  attention!.report('task-complete', 'session-1')
  native.notices.at(-1)!.emit('failed')
  attention!.report('approval-request', 'session-1')
  expect(native.notices).toHaveLength(4)
})
