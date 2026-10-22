// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installWindowsMenu } from '../src/preload-menu.ts'
import { DESKTOP_IPC } from '../src/ipc.ts'

const invoke = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())
vi.mock('electron', () => ({ ipcRenderer: { invoke } }))
let menu: ReturnType<typeof installWindowsMenu> | undefined

beforeEach(() => {
  const appSeat = document.createElement('div')
  appSeat.dataset.shellOverlay = ''
  document.body.append(appSeat)
  document.documentElement.lang = 'en'
  invoke.mockImplementation(async channel => channel === DESKTOP_IPC.notesRead ? '' : undefined)
})

it('keeps caption menus absent until the application frame replaces loading', async () => {
  document.body.replaceChildren()
  menu = installWindowsMenu()
  const loading = document.createElement('div')
  loading.dataset.dshBoot = ''
  document.body.append(loading)
  await new Promise<void>((resolve) => { queueMicrotask(resolve) })
  expect(document.querySelector('[data-windows-menu]')).toBeNull()
  const appSeat = document.createElement('div')
  appSeat.dataset.shellOverlay = ''
  loading.replaceWith(appSeat)
  await vi.waitFor(() => { expect(document.querySelector('[data-windows-menu]')).not.toBeNull() })
})

it('does not mount menus after a loading document is disposed', async () => {
  document.body.replaceChildren()
  menu = installWindowsMenu()
  menu.dispose()
  const appSeat = document.createElement('div')
  appSeat.dataset.shellOverlay = ''
  document.body.append(appSeat)
  await new Promise<void>((resolve) => { queueMicrotask(resolve) })
  expect(document.querySelector('[data-windows-menu]')).toBeNull()
})
afterEach(() => {
  menu?.dispose()
  menu = undefined
  document.body.replaceChildren()
  document.documentElement.lang = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('localizes caption entries and removes the menu on disposal', () => {
  menu = installWindowsMenu()
  const host = document.querySelector('[data-windows-menu]')!
  const bar = host.shadowRoot!.querySelector('[role=menubar]')!
  expect(bar.outerHTML).toMatchSnapshot('english')
  expect(host.shadowRoot!.querySelector('h2')!.textContent).toBe('Notes')
  document.documentElement.lang = 'zh-CN'
  menu.update()
  expect(bar.outerHTML).toMatchSnapshot('chinese')
  expect(host.shadowRoot!.querySelector('h2')!.textContent).toBe('笔记')
  menu.dispose()
  menu = undefined
  expect(document.querySelector('[data-windows-menu]')).toBeNull()
})

it('opens native menus without stealing pointer focus and resets popup state when closed', async () => {
  let close!: () => void
  invoke.mockImplementation(() => new Promise<void>((resolve) => { close = resolve }))
  menu = installWindowsMenu()
  const button = document.querySelector('[data-windows-menu]')!.shadowRoot!.querySelector('button')!
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(48, 6, 90, 28))
  const pointer = new MouseEvent('pointerdown', { cancelable: true })
  button.dispatchEvent(pointer)
  expect(pointer.defaultPrevented).toBe(true)
  const mouse = new MouseEvent('mousedown', { cancelable: true })
  button.dispatchEvent(mouse)
  expect(mouse.defaultPrevented).toBe(true)
  button.click()
  expect(invoke).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.windowsMenu, 'application', 48, 34)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  close()
  await vi.waitFor(() => { expect(button.getAttribute('aria-expanded')).toBe('false') })
})

it('moves between menu entries with arrow keys and opens the focused entry with ArrowDown', () => {
  menu = installWindowsMenu()
  const buttons = document.querySelector('[data-windows-menu]')!.shadowRoot!.querySelectorAll('button')
  buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }))
  expect(buttons[0]!.tabIndex).toBe(-1)
  expect(buttons[1]!.tabIndex).toBe(0)
  buttons[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
  expect(invoke).toHaveBeenCalledWith(DESKTOP_IPC.windowsMenu, 'edit', 0, 0)
})

it('restores a text input and its selection before opening a keyboard menu', async () => {
  const input = document.createElement('input')
  input.value = 'editor text'
  document.body.append(input)
  menu = installWindowsMenu()
  const button = document.querySelector('[data-windows-menu]')!.shadowRoot!.querySelector('button')!
  input.focus()
  input.setSelectionRange(2, 6, 'backward')
  button.focus()
  input.setSelectionRange(0, 0)
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
  expect(document.activeElement).toBe(input)
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 6, 'backward'])
  await vi.waitFor(() => { expect(button.getAttribute('aria-expanded')).toBe('false') })
})

it('reports a failed popup request and clears the active menu', async () => {
  const error = new Error('popup rejected')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  invoke.mockRejectedValue(error)
  menu = installWindowsMenu()
  const button = document.querySelector('[data-windows-menu]')!.shadowRoot!.querySelector('button')!
  button.click()
  await vi.waitFor(() => { expect(log).toHaveBeenCalledWith('Desktop caption menu failed', error) })
  expect(button.getAttribute('aria-expanded')).toBe('false')
})

it('restores a contenteditable selection before opening Edit with the keyboard', async () => {
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  editor.setAttribute('contenteditable', 'true')
  editor.tabIndex = 0
  editor.textContent = 'editable text'
  document.body.append(editor)
  menu = installWindowsMenu()
  const buttons = document.querySelector('[data-windows-menu]')!.shadowRoot!.querySelectorAll('button')
  editor.focus()
  const range = document.createRange()
  range.setStart(editor.firstChild!, 2)
  range.setEnd(editor.firstChild!, 8)
  document.getSelection()!.removeAllRanges()
  document.getSelection()!.addRange(range)
  buttons[0]!.focus()
  document.getSelection()!.removeAllRanges()
  buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }))
  buttons[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
  expect(document.activeElement).toBe(editor)
  expect(document.getSelection()!.toString()).toBe('itable')
  await vi.waitFor(() => { expect(buttons[1]!.getAttribute('aria-expanded')).toBe('false') })
})

it('opens the notes panel, loads saved text, and autosaves edits', async () => {
  invoke.mockImplementation(async channel => channel === DESKTOP_IPC.notesRead ? 'first note' : undefined)
  menu = installWindowsMenu()
  const root = document.querySelector('[data-windows-menu]')!.shadowRoot!
  const toggle = root.querySelector<HTMLButtonElement>('[data-notes-toggle]')!
  const panel = root.querySelector<HTMLElement>('[data-notes-panel]')!
  const textarea = root.querySelector('textarea')!
  toggle.click()
  expect(panel.hidden).toBe(false)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  await vi.waitFor(() => { expect(textarea.value).toBe('first note') })
  expect(root.activeElement).toBe(textarea)

  textarea.value = 'edited note'
  textarea.dispatchEvent(new Event('input'))
  await vi.waitFor(() => {
    expect(invoke).toHaveBeenCalledWith(DESKTOP_IPC.notesWrite, 'edited note')
  })
  await vi.waitFor(() => { expect(root.querySelector('[data-notes-status]')!.textContent).toBe('Saved') })

  toggle.click()
  expect(panel.hidden).toBe(true)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(root.activeElement).toBe(toggle)
})

it('closes notes with Escape, saves immediately, and restores the caption button', async () => {
  menu = installWindowsMenu()
  const root = document.querySelector('[data-windows-menu]')!.shadowRoot!
  const toggle = root.querySelector<HTMLButtonElement>('[data-notes-toggle]')!
  const panel = root.querySelector<HTMLElement>('[data-notes-panel]')!
  const textarea = root.querySelector('textarea')!
  toggle.click()
  await vi.waitFor(() => { expect(textarea.disabled).toBe(false) })

  textarea.value = 'unsaved thought'
  textarea.dispatchEvent(new Event('input'))
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  expect(panel.hidden).toBe(true)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(root.activeElement).toBe(toggle)
  await vi.waitFor(() => {
    expect(invoke).toHaveBeenCalledWith(DESKTOP_IPC.notesWrite, 'unsaved thought')
  })
})

it('closes notes on an outside pointer press', async () => {
  menu = installWindowsMenu()
  const root = document.querySelector('[data-windows-menu]')!.shadowRoot!
  const toggle = root.querySelector<HTMLButtonElement>('[data-notes-toggle]')!
  const panel = root.querySelector<HTMLElement>('[data-notes-panel]')!
  toggle.click()
  expect(panel.hidden).toBe(false)
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
  expect(panel.hidden).toBe(true)
})

it('reports a failed notes save and keeps the editor usable', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  invoke.mockImplementation(async (channel) => {
    if (channel === DESKTOP_IPC.notesWrite) throw new Error('disk full')
    if (channel === DESKTOP_IPC.notesRead) return ''
    return undefined
  })
  menu = installWindowsMenu()
  const root = document.querySelector('[data-windows-menu]')!.shadowRoot!
  const toggle = root.querySelector<HTMLButtonElement>('[data-notes-toggle]')!
  const textarea = root.querySelector('textarea')!
  toggle.click()
  await vi.waitFor(() => { expect(textarea.disabled).toBe(false) })

  textarea.value = 'cannot save'
  textarea.dispatchEvent(new Event('input'))
  await vi.waitFor(() => {
    expect(root.querySelector('[data-notes-status]')!.textContent).toBe('Couldn’t save')
  })
  expect(textarea.disabled).toBe(false)
  expect(log).toHaveBeenCalledWith('Desktop notes save failed', expect.any(Error))
  // Clearing the field leaves nothing for disposal to retry against the same failing write.
  textarea.value = ''
})
