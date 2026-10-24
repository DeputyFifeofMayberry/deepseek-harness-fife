/**
 * Reading helpers for snapshot fixtures checked out on hosts without symlink
 * support. Shared snapshot sidecars are committed as git symlinks (`120000`);
 * when `core.symlinks=false` git materializes them as plain files whose entire
 * content is the link text, so a plain read returns a relative path where the
 * payload was expected. Real symlinks resolve transparently in the filesystem;
 * these helpers only repair the unmaterialized plain-file form.
 * @module @deepseek-ai/dsh-session-snapshot/symlinks
 */

import { readFile as readFileAsync } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

/** Maximum link-text hops before a fixture is treated as corrupt. */
const MAX_LINK_HOPS = 5

/**
 * The link text of an unmaterialized git symlink, when `content` is exactly
 * one relative path that names an existing file beside `file`. Real payloads
 * (JSON, JSONL, prose) never satisfy all three conditions.
 * @param file - absolute path of the file the content was read from.
 * @param content - the file's text.
 * @returns the absolute path the link names, or `undefined` when the content is not link text.
 */
function unmaterializedLinkTarget(file: string, content: string): string | undefined {
  const text = content.endsWith('\n') ? content.slice(0, -1) : content
  if (text.length === 0 || text.includes('\n')) return undefined
  if (isAbsolute(text)) return undefined
  const target = join(dirname(file), text)
  return existsSync(target) && existsSync(file) && target !== file ? target : undefined
}

/**
 * Read one snapshot fixture, following git-symlink link text left by a
 * checkout with `core.symlinks=false`. A real symlink never reaches the
 * detection: the filesystem resolves it before the content is read.
 * @param path - absolute fixture path.
 * @returns the file text, with link text replaced by the target's text.
 * @throws after {@link MAX_LINK_HOPS} hops, which means a fixture link cycle.
 */
export async function readSnapshotText(path: string, encoding: 'utf8' = 'utf8'): Promise<string> {
  void encoding
  let current = path
  let content = await readFileAsync(current, 'utf8')
  for (let hop = 0; hop < MAX_LINK_HOPS; hop += 1) {
    const target = unmaterializedLinkTarget(current, content)
    if (target === undefined) return content
    current = target
    content = await readFileAsync(current, 'utf8')
  }
  throw new Error(`session-snapshot: fixture symlink chain exceeds ${MAX_LINK_HOPS} hops at ${path}`)
}

/**
 * Synchronous variant of {@link readSnapshotText} for callers that read
 * fixtures before any asynchronous work.
 * @param path - absolute fixture path.
 * @returns the file text, with link text replaced by the target's text.
 * @throws after {@link MAX_LINK_HOPS} hops, which means a fixture link cycle.
 */
export function readSnapshotTextSync(path: string, encoding: 'utf8' = 'utf8'): string {
  void encoding
  let current = path
  let content = readFileSync(current, 'utf8')
  for (let hop = 0; hop < MAX_LINK_HOPS; hop += 1) {
    const target = unmaterializedLinkTarget(current, content)
    if (target === undefined) return content
    current = target
    content = readFileSync(current, 'utf8')
  }
  throw new Error(`session-snapshot: fixture symlink chain exceeds ${MAX_LINK_HOPS} hops at ${path}`)
}
