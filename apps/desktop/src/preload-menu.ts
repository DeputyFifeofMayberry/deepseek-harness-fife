/** Windows caption menu labels, native popup anchors, and the device-local notes scratchpad. */
import { ipcRenderer } from 'electron'
import { DESKTOP_IPC } from './ipc.ts'
import { resolveDesktopLocale } from './locale.ts'

const NOTES_SAVE_DELAY_MS = 400

/**
 * Mount the Windows caption menubar without moving focus out of the active editor.
 * @returns Language refresh and document teardown operations.
 */
export function installWindowsMenu(): { update(): void; dispose(): void } {
  const host = document.createElement('div')
  host.dataset.windowsMenu = ''
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    :host { position: fixed; top: 0; left: var(--dsh-windows-menu-start, 48px); z-index: 1100;
      height: var(--dsh-windows-titlebar-height); display: flex; align-items: center;
      font-family: var(--dsw-font-family); -webkit-app-region: no-drag; }
    [role=menubar] { display: flex; gap: 2px; }
    [role=menubar] button { height: 28px; padding: 0 10px; border: 0; border-radius: 6px;
      background: transparent; color: var(--dsw-alias-label-secondary);
      font: inherit; font-size: 14px; cursor: default; }
    [role=menubar] button:hover, [role=menubar] button[aria-expanded=true] {
      background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
    [role=menubar] button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }
    :host-context(html[data-input-modality='pointer']) [role=menubar] button:focus-visible { outline-color: transparent; }
    [data-notes-panel] { position: fixed; top: calc(var(--dsh-windows-titlebar-height) + 2px);
      display: flex; flex-direction: column; width: min(360px, calc(100vw - 16px));
      height: min(320px, calc(100vh - 52px)); box-sizing: border-box; overflow: hidden;
      border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 8px);
      background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
      box-shadow: 0 12px 32px rgb(0 0 0 / 18%); font: inherit; }
    [data-notes-panel][hidden] { display: none; }
    [data-notes-panel] header { display: flex; align-items: center; justify-content: space-between;
      padding: 6px 6px 2px 12px; }
    [data-notes-panel] h2 { margin: 0; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
    [data-notes-panel] textarea { flex: 1; min-height: 0; width: 100%; box-sizing: border-box; resize: none;
      border: 0; outline: 0; padding: 6px 12px; background: transparent; color: inherit;
      font: inherit; font-size: 13px; line-height: 1.5; }
    [data-notes-panel] textarea:disabled { opacity: 0.6; }
    [data-notes-panel] footer { display: flex; justify-content: flex-end; align-items: center;
      min-height: 20px; padding: 0 12px 8px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
    [data-notes-status][data-state=error] { color: var(--dsw-alias-state-error-primary); }
    [data-notes-close] { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px;
      background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; cursor: default; }
    [data-notes-close]:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
  `
  const messages = () => resolveDesktopLocale(document.documentElement.lang).messages
  const bar = document.createElement('div')
  bar.setAttribute('role', 'menubar')
  const panel = document.createElement('div')
  panel.dataset.notesPanel = ''
  panel.id = 'dsh-desktop-notes'
  panel.setAttribute('role', 'dialog')
  panel.hidden = true
  const panelTitle = document.createElement('h2')
  panelTitle.id = `${panel.id}-title`
  panel.setAttribute('aria-labelledby', panelTitle.id)
  const closeNotesButton = document.createElement('button')
  closeNotesButton.type = 'button'
  closeNotesButton.dataset.notesClose = ''
  closeNotesButton.textContent = '×'
  const header = document.createElement('header')
  header.append(panelTitle, closeNotesButton)
  const textarea = document.createElement('textarea')
  textarea.setAttribute('aria-labelledby', panelTitle.id)
  const status = document.createElement('span')
  status.dataset.notesStatus = ''
  status.dataset.state = 'idle'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const footer = document.createElement('footer')
  footer.append(status)
  panel.append(header, textarea, footer)

  let restoreEditor = (): void => {}
  const rememberEditor = (event: FocusEvent): void => {
    const target = event.composedPath()[0]
    if (!(target instanceof HTMLElement) || target === host || shadow.contains(target)) return
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)
      && !target.matches('[contenteditable="true"]')) return
    const selection = document.getSelection()
    const ranges = selection === null ? [] : Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
    const input = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : undefined
    const start = input?.selectionStart
    const end = input?.selectionEnd
    const direction = input?.selectionDirection
    restoreEditor = () => {
      if (!target.isConnected) return
      target.focus({ preventScroll: true })
      if (input !== undefined && start != null && end != null) input.setSelectionRange(start, end, direction ?? undefined)
      else if (selection !== null && ranges.length > 0) {
        selection.removeAllRanges()
        for (const range of ranges) selection.addRange(range)
      }
    }
  }
  document.addEventListener('focusout', rememberEditor, true)

  let notesLoaded = false
  let notesLoading: Promise<void> | undefined
  let notesEdited = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let saveInFlight: Promise<void> | undefined
  let pendingSave = false
  let lastSavedValue = ''
  let statusState: 'idle' | 'loading' | 'saving' | 'saved' | 'error' = 'idle'

  const renderStatus = (): void => {
    const copy = messages()
    status.dataset.state = statusState
    status.textContent = statusState === 'loading' ? copy.notesLoading
      : statusState === 'saving' ? copy.notesSaving
        : statusState === 'saved' ? copy.notesSaved
          : statusState === 'error' ? copy.notesSaveFailed
            : ''
  }

  const loadNotes = (): Promise<void> => {
    if (notesLoaded) return Promise.resolve()
    notesLoading ??= (async () => {
      statusState = 'loading'
      renderStatus()
      textarea.disabled = true
      try {
        const stored = await (ipcRenderer.invoke(DESKTOP_IPC.notesRead) as Promise<unknown>)
        if (typeof stored !== 'string') throw new Error('desktop notes: read returned non-string')
        if (!notesEdited) {
          textarea.value = stored
          lastSavedValue = stored
        }
        statusState = 'idle'
      } catch (error) {
        console.error('Desktop notes load failed', error)
        statusState = 'error'
      } finally {
        notesLoaded = true
        textarea.disabled = false
        renderStatus()
      }
    })()
    return notesLoading
  }

  const saveNotes = async (): Promise<void> => {
    if (saveInFlight !== undefined) {
      pendingSave = true
      return saveInFlight
    }
    const value = textarea.value
    if (value === lastSavedValue) {
      if (statusState === 'saving') {
        statusState = 'saved'
        renderStatus()
      }
      return
    }
    statusState = 'saving'
    renderStatus()
    saveInFlight = (async () => {
      try {
        await ipcRenderer.invoke(DESKTOP_IPC.notesWrite, value)
        lastSavedValue = value
        if (textarea.value === value) statusState = 'saved'
        else pendingSave = true
      } catch (error) {
        console.error('Desktop notes save failed', error)
        statusState = 'error'
      } finally {
        saveInFlight = undefined
        if (pendingSave) {
          pendingSave = false
          if (textarea.value !== lastSavedValue) {
            void saveNotes()
            return
          }
        }
        if (textarea.value === lastSavedValue && statusState === 'saving') statusState = 'saved'
        renderStatus()
      }
    })()
    await saveInFlight
  }

  const flushNotes = (): void => {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (textarea.value !== lastSavedValue) void saveNotes()
  }

  const notesButton = document.createElement('button')
  notesButton.type = 'button'
  notesButton.dataset.notesToggle = ''
  notesButton.setAttribute('role', 'menuitem')
  notesButton.setAttribute('aria-haspopup', 'dialog')
  notesButton.setAttribute('aria-expanded', 'false')
  notesButton.setAttribute('aria-controls', panel.id)
  notesButton.tabIndex = -1
  notesButton.addEventListener('pointerdown', (event) => { event.preventDefault() })
  notesButton.addEventListener('mousedown', (event) => { event.preventDefault() })

  const openNotes = (): void => {
    if (!panel.hidden) return
    panel.hidden = false
    notesButton.setAttribute('aria-expanded', 'true')
    const rect = notesButton.getBoundingClientRect()
    const width = panel.getBoundingClientRect().width
    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
    void loadNotes().then(() => {
      if (panel.hidden || !host.isConnected) return
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }

  const hideNotes = (restoreFocus: boolean): void => {
    if (panel.hidden) return
    flushNotes()
    panel.hidden = true
    notesButton.setAttribute('aria-expanded', 'false')
    if (restoreFocus) notesButton.focus()
  }

  notesButton.addEventListener('click', () => {
    if (panel.hidden) openNotes()
    else hideNotes(true)
  })
  closeNotesButton.addEventListener('click', () => { hideNotes(true) })
  textarea.addEventListener('input', () => {
    notesEdited = true
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void saveNotes()
    }, NOTES_SAVE_DELAY_MS)
  })
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    hideNotes(true)
  })
  const closeOnOutsidePointer = (event: PointerEvent): void => {
    if (panel.hidden || event.composedPath().includes(host)) return
    hideNotes(false)
  }
  document.addEventListener('pointerdown', closeOnOutsidePointer, true)

  const openNativeMenu = async (name: 'application' | 'edit', button: HTMLButtonElement): Promise<void> => {
    if (button.getAttribute('aria-expanded') === 'true') return
    hideNotes(false)
    const rect = button.getBoundingClientRect()
    button.setAttribute('aria-expanded', 'true')
    if (document.activeElement === host) restoreEditor()
    try { await ipcRenderer.invoke(DESKTOP_IPC.windowsMenu, name, rect.left, rect.bottom) }
    catch (error) { console.error('Desktop caption menu failed', error) }
    finally { button.setAttribute('aria-expanded', 'false') }
  }
  const createNativeButton = (name: 'application' | 'edit', index: 0 | 1): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('role', 'menuitem')
    button.setAttribute('aria-haspopup', 'menu')
    button.setAttribute('aria-expanded', 'false')
    button.tabIndex = index === 0 ? 0 : -1
    button.addEventListener('pointerdown', (event) => { event.preventDefault() })
    button.addEventListener('mousedown', (event) => { event.preventDefault() })
    button.addEventListener('click', () => { void openNativeMenu(name, button) })
    return button
  }
  const applicationButton = createNativeButton('application', 0)
  const editButton = createNativeButton('edit', 1)
  bar.append(applicationButton, editButton, notesButton)
  const buttons = [applicationButton, editButton, notesButton]
  buttons.forEach((button, index) => {
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const next = index + (event.key === 'ArrowLeft' ? -1 : 1)
        const target = buttons[next]
        if (target === undefined) return
        button.tabIndex = -1
        target.tabIndex = 0
        target.focus()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (button === notesButton) openNotes()
        else void openNativeMenu(button === applicationButton ? 'application' : 'edit', button)
      }
    })
  })
  shadow.append(style, bar, panel)
  const mount = (): void => {
    // AppFrame owns this seat; boot readiness alone precedes the rendered application.
    if (document.querySelector('[data-shell-overlay]') === null) return
    document.body.append(host)
    observer.disconnect()
  }
  const observer = new MutationObserver(mount)
  observer.observe(document.body, { childList: true, subtree: true })
  mount()
  const update = (): void => {
    const copy = messages()
    bar.setAttribute('aria-label', copy.menuBar)
    applicationButton.textContent = copy.application
    editButton.textContent = copy.edit
    notesButton.textContent = copy.notes
    panelTitle.textContent = copy.notes
    textarea.placeholder = copy.notesPlaceholder
    closeNotesButton.setAttribute('aria-label', copy.notesClose)
    renderStatus()
  }
  update()
  return {
    update,
    dispose: () => {
      observer.disconnect()
      document.removeEventListener('focusout', rememberEditor, true)
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      flushNotes()
      host.remove()
    },
  }
}
