// @vitest-environment jsdom
/**
 * Per-session input history: the capture face's append/dedupe/cap/persistence
 * behavior, the storage reader's tolerance of absent or invalid data, and the
 * input shell's capture-on-commit and recall guards.
 */
import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { $getRoot, $isElementNode, $nodesOfType } from 'lexical'
import { expect, it, onTestFinished, vi } from 'vitest'
import type { DraftSnapshot } from '../src/client/contract/draft-editor.ts'
import type {
  DraftAttachmentId, InputTriggerController, PickOutcome, SubmitOutcome,
} from '../src/client/contract/input.ts'
import { ReferenceChipNode } from '../src/client/input/editor/chip-node.tsx'
import { SessionInputShell } from '../src/client/input/facade.ts'
import { createSessionInputHistory, readInputHistory } from '../src/client/input-history.ts'

const CAP = 50

const commandAttachments = {
  serialize: () => Promise.resolve([]),
  release: () => {},
  unsupportedNotice: (token: string) => `${token.trim()} attachments-unsupported`,
}

function textEntry(text: string): DraftSnapshot {
  return { text, references: [] }
}

function triggers(serializeReference: (source: string, ref: string) => Promise<string>): InputTriggerController {
  return {
    lexicon: { getSnapshot: () => new Map(), subscribe: () => () => {} },
    launcher: { getSnapshot: () => null, subscribe: () => () => {} },
    track: () => {},
    arbitrate: () => 'pass',
    onSpace: () => false,
    serializeReference,
    adjudicate: () => Promise.resolve(undefined),
    resolveClaim: () => Promise.resolve(undefined),
    openReference: () => false,
    toggleSource: () => {},
  }
}

function freshHistory(prefix: string): { id: SessionId; key: string } {
  const id = SessionId(`input-history-${prefix}-${randomUUID()}`)
  const key = `dsh.input-history.${id}`
  onTestFinished(() => { localStorage.removeItem(key) })
  return { id, key }
}

it('records captured inputs oldest-first and persists them under the session key', () => {
  const { id, key } = freshHistory('append')
  const history = createSessionInputHistory(id)
  history.record(textEntry('first'))
  history.record(textEntry('second'))
  expect(history.entries().map(entry => entry.text)).toEqual(['first', 'second'])
  expect(localStorage.getItem(key)).not.toBeNull()
  expect(readInputHistory(id).map(entry => entry.text)).toEqual(['first', 'second'])
})

it('collapses a consecutive duplicate of the newest captured text', () => {
  const { id } = freshHistory('dedupe')
  const history = createSessionInputHistory(id)
  history.record(textEntry('once'))
  history.record(textEntry('once'))
  history.record(textEntry('twice'))
  history.record(textEntry('once'))
  history.record(textEntry('   '))
  expect(history.entries().map(entry => entry.text)).toEqual(['once', 'twice', 'once'])
})

it('caps the list at 50 entries, trimming oldest first', () => {
  const { id } = freshHistory('cap')
  const history = createSessionInputHistory(id)
  for (let index = 0; index < CAP + 2; index += 1) history.record(textEntry(`input ${index}`))
  const texts = history.entries().map(entry => entry.text)
  expect(texts).toHaveLength(CAP)
  expect(texts[0]).toBe('input 2')
  expect(texts.at(-1)).toBe(`input ${CAP + 1}`)
})

it('rehydrates a new store instance from the persisted session key', () => {
  const { id } = freshHistory('rehydrate')
  createSessionInputHistory(id).record(textEntry('before reload'))
  const reopened = createSessionInputHistory(id)
  expect(reopened.entries().map(entry => entry.text)).toEqual(['before reload'])
  reopened.record(textEntry('once'))
  reopened.record(textEntry('once'))
  expect(reopened.entries().map(entry => entry.text)).toEqual(['before reload', 'once'])
})

it('reads nothing from absent, malformed, or invalid storage', () => {
  const { id, key } = freshHistory('read')
  expect(readInputHistory(id)).toEqual([])
  localStorage.setItem(key, 'not json')
  expect(readInputHistory(id)).toEqual([])
  localStorage.setItem(key, JSON.stringify('scalar'))
  expect(readInputHistory(id)).toEqual([])
  localStorage.setItem(key, JSON.stringify({ entries: 'not-a-list' }))
  expect(readInputHistory(id)).toEqual([])
  localStorage.setItem(key, JSON.stringify({ entries: [
    { text: 42 },
    { text: 'a @b', references: [{ source: 'reference', ref: 'x', offset: 5, length: 9, label: 'b', clipboardText: '@b' }] },
    'plain text',
  ] }))
  expect(readInputHistory(id)).toEqual([textEntry('plain text')])
})

it('keeps in-memory history when browser storage is unavailable', () => {
  vi.stubGlobal('localStorage', undefined)
  onTestFinished(() => { vi.unstubAllGlobals() })
  const history = createSessionInputHistory(SessionId(`input-history-nostorage-${randomUUID()}`))
  history.record(textEntry('memory only'))
  expect(history.entries().map(entry => entry.text)).toEqual(['memory only'])
  expect(readInputHistory(SessionId(`input-history-nostorage-${randomUUID()}`))).toEqual([])
})

it('captures a successful default send and recalls it through the normal draft path', async () => {
  const { id } = freshHistory('capture')
  const sink = vi.fn(() => Promise.resolve<SubmitOutcome>({ kind: 'success' }))
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: sink,
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  shell.setDraft('hello there')
  shell.submit('queue')
  await vi.waitFor(() => { expect(sink).toHaveBeenCalledTimes(1) })
  expect(readInputHistory(id).map(entry => entry.text)).toEqual(['hello there'])
  expect(shell.recall('previous')).toBe(true)
  expect(shell.snapshot.draft).toBe('hello there')
})

it('does not capture a rejected default send', async () => {
  const { id } = freshHistory('failure')
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: () => Promise.resolve<SubmitOutcome>({ kind: 'error', text: 'rejected' }),
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  shell.setDraft('doomed')
  shell.submit('queue')
  await vi.waitFor(() => { expect(shell.snapshot.draft).toBe('doomed') })
  expect(readInputHistory(id)).toEqual([])
})

it('collapses consecutive identical sends into one history entry', async () => {
  const { id } = freshHistory('repeat')
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: () => Promise.resolve<SubmitOutcome>({ kind: 'success' }),
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  shell.setDraft('hello')
  shell.submit('queue')
  shell.setDraft('hello')
  shell.submit('queue')
  await vi.waitFor(() => { expect(shell.snapshot.draft).toBe('') })
  expect(readInputHistory(id).map(entry => entry.text)).toEqual(['hello'])
})

it('does not capture an attachment-only send', async () => {
  const { id } = freshHistory('attachments')
  const sink = vi.fn(() => Promise.resolve<SubmitOutcome>({ kind: 'success' }))
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: sink,
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  expect(shell.addAttachments(['img-1' as DraftAttachmentId])).toBe(true)
  shell.submit('queue')
  await vi.waitFor(() => { expect(shell.snapshot.attachmentIds).toEqual([]) })
  expect(sink).toHaveBeenCalledTimes(1)
  expect(readInputHistory(id)).toEqual([])
})

it('does not capture a claimed human-command submission', async () => {
  const { id } = freshHistory('command')
  const pending = Promise.withResolvers<PickOutcome>()
  const command = vi.fn(async (): Promise<SubmitOutcome> => ({ kind: 'success' }))
  const sink = vi.fn(async (): Promise<SubmitOutcome> => ({ kind: 'success' }))
  const inputTriggers: InputTriggerController = {
    launcher: { getSnapshot: () => null, subscribe: () => () => {} },
    lexicon: { getSnapshot: () => new Map(), subscribe: () => () => {} },
    track: () => {}, arbitrate: () => 'pass', onSpace: () => false,
    serializeReference: async () => '', openReference: () => false, toggleSource: () => {},
    adjudicate: () => pending.promise,
    resolveClaim: () => Promise.resolve(undefined),
  }
  const shell = new SessionInputShell({
    actx: {} as Context,
    inputTriggers: () => inputTriggers,
    defaultSink: sink,
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  shell.setDraft('/compact')
  shell.submit('queue')
  pending.resolve({ claim: { name: 'compact', token: '/compact', submit: command } })
  await vi.waitFor(() => { expect(shell.snapshot.phase).toBe('plain') })
  expect(command).toHaveBeenCalledTimes(1)
  expect(sink).not.toHaveBeenCalled()
  expect(readInputHistory(id)).toEqual([])
})

it('re-claims reference chips when a captured input is recalled', async () => {
  const { id } = freshHistory('chips')
  const mention = '@[Research](dsh-session:InNvdXJjZSI)'
  const sink = vi.fn(() => Promise.resolve<SubmitOutcome>({ kind: 'success' }))
  const shell = new SessionInputShell({
    actx: {} as Context,
    inputTriggers: () => triggers(() => Promise.resolve(mention)),
    defaultSink: sink,
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  shell.setDraft('@res')
  expect(shell.insertReference({
    source: 'reference',
    ref: mention,
    label: 'Research',
    clipboardText: mention,
  }, { start: 0, end: 4, draftRev: shell.snapshot.draftRev })).toBe(true)
  shell.submit('queue')
  await vi.waitFor(() => { expect(sink).toHaveBeenCalledTimes(1) })
  expect(shell.recall('previous')).toBe(true)
  expect(shell.snapshot.draft).toBe(`${mention} `)
  expect(shell.editor.getEditorState().read(() => $nodesOfType(ReferenceChipNode).length)).toBe(1)
})

it('refuses recall when nothing has been captured in this chat', () => {
  const { id } = freshHistory('empty')
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: vi.fn(),
    commandAttachments,
    history: createSessionInputHistory(id),
  })
  onTestFinished(() => { shell.dispose() })
  expect(shell.recall('previous')).toBe(false)
  expect(shell.snapshot.draft).toBe('')
})

it('refuses recall while a slash line is still adjudicating', async () => {
  const { id } = freshHistory('adjudicating')
  const pending = Promise.withResolvers<PickOutcome>()
  const history = createSessionInputHistory(id)
  history.record(textEntry('sent earlier'))
  const inputTriggers: InputTriggerController = {
    launcher: { getSnapshot: () => null, subscribe: () => () => {} },
    lexicon: { getSnapshot: () => new Map(), subscribe: () => () => {} },
    track: () => {}, arbitrate: () => 'pass', onSpace: () => false,
    serializeReference: async () => '', openReference: () => false, toggleSource: () => {},
    adjudicate: () => pending.promise,
    resolveClaim: () => Promise.resolve(undefined),
  }
  const shell = new SessionInputShell({
    actx: {} as Context,
    inputTriggers: () => inputTriggers,
    defaultSink: vi.fn(),
    commandAttachments,
    history,
  })
  onTestFinished(() => {
    pending.resolve(undefined)
    shell.dispose()
  })
  shell.setDraft('/compact')
  shell.submit('queue')
  expect(shell.snapshot.phase).toBe('adjudicating')
  expect(shell.recall('previous')).toBe(false)
})

it('refuses recall when the caret is off the first line or spans a selection', () => {
  const { id } = freshHistory('caret')
  const history = createSessionInputHistory(id)
  history.record(textEntry('sent earlier'))
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: vi.fn(),
    commandAttachments,
    history,
  })
  onTestFinished(() => { shell.dispose() })
  shell.setDraft('first\nsecond')
  expect(shell.recall('previous')).toBe(false)
  shell.editor.update(() => {
    const first = $getRoot().getFirstChild()
    if ($isElementNode(first)) first.select(0, 0)
  }, { discrete: true })
  expect(shell.recall('previous')).toBe(true)
  expect(shell.snapshot.draft).toBe('sent earlier')
  shell.setDraft('first\nsecond')
  shell.editor.update(() => {
    const first = $getRoot().getFirstChild()
    if ($isElementNode(first)) first.select(0, 5)
  }, { discrete: true })
  expect(shell.recall('previous')).toBe(false)
})

it('reserves the forward direction for the history walk', () => {
  const { id } = freshHistory('forward')
  const history = createSessionInputHistory(id)
  history.record(textEntry('sent earlier'))
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: vi.fn(),
    commandAttachments,
    history,
  })
  onTestFinished(() => { shell.dispose() })
  expect(shell.recall('next')).toBe(false)
})

it('refuses recall when no history store is bound', () => {
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: vi.fn(),
    commandAttachments,
  })
  onTestFinished(() => { shell.dispose() })
  expect(shell.recall('previous')).toBe(false)
})

it('refuses recall after disposal', () => {
  const { id } = freshHistory('disposed')
  const history = createSessionInputHistory(id)
  history.record(textEntry('sent earlier'))
  const shell = new SessionInputShell({
    actx: {} as Context,
    defaultSink: vi.fn(),
    commandAttachments,
    history,
  })
  shell.dispose()
  expect(shell.recall('previous')).toBe(false)
})
