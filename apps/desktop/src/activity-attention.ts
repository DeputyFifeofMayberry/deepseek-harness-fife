/** Best-effort background attention for finished tasks and pending approvals; it never grants any authorization. */
import { type BrowserWindow, Notification } from 'electron'
import type { DesktopActivityKind } from './ipc.ts'
import type { DesktopLocale } from './locale.ts'

/** Shell settings gating background activity notifications; read once per process. */
export interface DesktopActivityOptions {
  readonly enabled: boolean
  readonly taskComplete: boolean
  readonly approval: boolean
  readonly approvalSound: boolean
  readonly taskCompleteSound: boolean
}

/**
 * Owns native notifications for background activity until window focus, a click,
 * or an approval resolution releases them. One task notification per converged
 * session and one replaceable approval notification; everything foreground,
 * disabled, or unsupported is dropped without error.
 */
export class DesktopActivityAttention {
  readonly #taskNotices = new Map<string, Notification>()
  #approvalNotice: Notification | undefined

  /**
   * @param locale - Shell-owned notification copy.
   * @param options - Notification settings flags.
   * @param window - Current product window, when one exists.
   */
  constructor(
    private readonly locale: () => DesktopLocale,
    private readonly options: DesktopActivityOptions,
    private readonly window: () => BrowserWindow | undefined,
  ) {}

  /** Report one renderer activity event; everything unowned, disabled, or foreground is dropped. */
  report(kind: DesktopActivityKind, sessionId: string): void {
    if (kind === 'approval-resolved') {
      this.#closeApproval()
      return
    }
    if (!this.options.enabled || (kind === 'approval-request' ? !this.options.approval : !this.options.taskComplete)) return
    const window = this.window()
    if (window === undefined || window.isDestroyed()) return
    if (window.isVisible() && window.isFocused() && !window.isMinimized()) return
    if (!Notification.isSupported()) return
    try {
      if (kind === 'approval-request') this.#showApproval(window)
      else this.#showTaskComplete(window, sessionId)
    } catch (error) { console.warn('desktop activity: notification unavailable', error) }
  }

  /** Release every owned notification; the shell calls this when the product window gains focus. */
  clear(): void {
    this.#closeApproval()
    for (const notification of this.#taskNotices.values()) this.#close(notification)
    this.#taskNotices.clear()
  }

  /** Test seam: releases owned notifications without touching shell listeners. */
  reset(): void { this.clear() }

  #showApproval(window: BrowserWindow): void {
    this.#closeApproval()
    const messages = this.locale().messages
    const notification = new Notification({
      title: messages.activityApprovalTitle,
      body: messages.activityApprovalNotification,
      silent: !this.options.approvalSound,
    })
    this.#approvalNotice = notification
    notification.once('click', () => {
      if (this.#approvalNotice === notification) this.#approvalNotice = undefined
      notification.removeAllListeners()
      this.#focus(window)
    })
    notification.once('failed', () => {
      if (this.#approvalNotice === notification) this.#approvalNotice = undefined
      notification.removeAllListeners()
    })
    notification.show()
  }

  #showTaskComplete(window: BrowserWindow, sessionId: string): void {
    const previous = this.#taskNotices.get(sessionId)
    if (previous !== undefined) {
      this.#taskNotices.delete(sessionId)
      this.#close(previous)
    }
    const messages = this.locale().messages
    const notification = new Notification({
      title: messages.activityTaskCompleteTitle,
      body: messages.activityTaskCompleteNotification,
      silent: !this.options.taskCompleteSound,
    })
    this.#taskNotices.set(sessionId, notification)
    notification.once('click', () => {
      if (this.#taskNotices.get(sessionId) === notification) this.#taskNotices.delete(sessionId)
      notification.removeAllListeners()
      this.#focus(window)
    })
    notification.once('failed', () => {
      if (this.#taskNotices.get(sessionId) === notification) this.#taskNotices.delete(sessionId)
      notification.removeAllListeners()
    })
    notification.show()
  }

  #focus(window: BrowserWindow): void {
    try {
      if (window.isDestroyed()) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    } catch (error) { console.warn('desktop activity: could not focus the window', error) }
  }

  #closeApproval(): void {
    const notification = this.#approvalNotice
    this.#approvalNotice = undefined
    this.#close(notification)
  }

  #close(notification: Notification | undefined): void {
    if (notification === undefined) return
    notification.removeAllListeners()
    try { notification.close() }
    catch (error) { console.warn('desktop activity: could not close notification', error) }
  }
}
