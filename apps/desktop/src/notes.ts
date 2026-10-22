/** Device-local caption scratchpad stored as one Markdown file under Electron userData. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

/** Longest accepted scratchpad, in UTF-16 code units; the renderer cannot expand storage without bound. */
export const NOTES_MAX_LENGTH = 200_000

/** One device's caption notes file. */
export class DesktopNotes {
  readonly #path: string

  /**
   * @param path - absolute notes file inside the shell-owned userData tree.
   */
  constructor(path: string) {
    this.#path = path
  }

  /**
   * Read the saved scratchpad.
   * @returns the stored text, or an empty string before the first save.
   */
  async read(): Promise<string> {
    try {
      return await readFile(this.#path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
      throw error
    }
  }

  /**
   * Replace the saved scratchpad atomically.
   * @param text - complete next content, already length-limited by the caller.
   */
  async write(text: string): Promise<void> {
    await writeFileAtomic(this.#path, text, { mode: 0o600, dirMode: 0o700 })
  }
}

/**
 * Locate the current device's notes file.
 * @param userData - Electron's userData directory, never a Renderer-supplied path.
 * @returns the notes store written beneath the desktop settings directory.
 */
export function desktopNotes(userData: string): DesktopNotes {
  return new DesktopNotes(join(userData, 'desktop', 'notes.md'))
}
