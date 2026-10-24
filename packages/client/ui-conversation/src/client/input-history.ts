/** Per-session composer input history: successful default sends, captured for Up/Down recall. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DraftSnapshot } from './contract/draft-editor.ts'
import { parseStoredDraft } from './draft.ts'

const INPUT_HISTORY_STORE_KEY = 'dsh.input-history'

/** Oldest-first capture order with this many entries retained per session. */
const INPUT_HISTORY_LIMIT = 50

/** Persisted per-session captured-input list. */
export interface InputHistoryState {
  entries: DraftSnapshot[]
}

/** Declared write set for the input-history store. */
type InputHistoryActions = {
  record: (history: InputHistoryState, entry: DraftSnapshot) => void
}

/** Capture face the input shell binds: append and read without storage details. */
export interface InputHistoryStore {
  /**
   * Append one captured input; empty text is refused, a duplicate of the
   * newest text collapses into the existing entry, and the oldest entries
   * fall off past the cap.
   * @param entry - the submitted draft's semantic snapshot.
   */
  record(entry: DraftSnapshot): void
  /** Captured inputs, oldest first. */
  entries(): readonly DraftSnapshot[]
}

/**
 * Declare the per-session input-history persistence (own key namespace, kept
 * separate from the per-keystroke draft store).
 * @returns the store handle.
 */
export function createInputHistoryStore(): EngineStoreHandle<InputHistoryState, InputHistoryActions> {
  return defineStore({
    init: (): InputHistoryState => ({ entries: [] }),
    persist: INPUT_HISTORY_STORE_KEY,
    actions: {
      record: (history, entry) => {
        if (entry.text.trim() === '') return
        const last = history.entries[history.entries.length - 1]
        if (last !== undefined && last.text === entry.text) return
        const appended = [...history.entries, entry]
        history.entries = appended.length > INPUT_HISTORY_LIMIT
          ? appended.slice(appended.length - INPUT_HISTORY_LIMIT)
          : appended
      },
    },
  })
}

/**
 * Create the real per-session history store, persisted under its own session key.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns the capture face.
 */
export function createSessionInputHistory(sessionId: SessionId): InputHistoryStore {
  const instance = createInputHistoryStore().create(sessionId)
  return {
    record: (entry) => { instance.actions.record(entry) },
    entries: () => instance.getSnapshot().entries,
  }
}

/**
 * Read a Session's captured inputs before its shell binds the live store.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns the captured inputs, oldest first; empty when storage is absent, unavailable, or invalid.
 */
export function readInputHistory(sessionId: SessionId): readonly DraftSnapshot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${INPUT_HISTORY_STORE_KEY}.${sessionId}`)
    if (raw === null) return []
    const stored: unknown = JSON.parse(raw)
    if (typeof stored !== 'object' || stored === null || !('entries' in stored) || !Array.isArray(stored.entries)) return []
    return stored.entries
      .map(entry => parseStoredDraft(entry))
      .filter((entry): entry is DraftSnapshot => entry !== undefined)
  } catch (_error: unknown) {
    // Unavailable browser storage or malformed JSON has no usable history.
    return []
  }
}
