import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { onTestFinished, expect, it } from 'vitest'
import { desktopNotes } from '../src/notes.ts'

function fixture(): string {
  const userData = mkdtempSync(join(tmpdir(), 'dsh-desktop-notes-'))
  onTestFinished(() => { rmSync(userData, { recursive: true, force: true }) })
  return userData
}

it('reads an empty scratchpad before the first save', async () => {
  await expect(desktopNotes(fixture()).read()).resolves.toBe('')
})

it('round-trips notes through one private file', async () => {
  const userData = fixture()
  const notes = desktopNotes(userData)
  await notes.write('first thought\n')
  await expect(notes.read()).resolves.toBe('first thought\n')
  const path = join(userData, 'desktop', 'notes.md')
  expect(readFileSync(path, 'utf8')).toBe('first thought\n')
  expect(statSync(path).isFile()).toBe(true)
})

it('replaces the previous content atomically', async () => {
  const notes = desktopNotes(fixture())
  await notes.write('draft')
  await notes.write('final')
  await expect(notes.read()).resolves.toBe('final')
})
