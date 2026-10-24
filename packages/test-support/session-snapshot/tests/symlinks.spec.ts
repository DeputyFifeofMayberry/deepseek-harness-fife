import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readSnapshotText, readSnapshotTextSync } from '../src/symlinks.ts'

function sandbox(): string {
  return join(tmpdir(), `dsh-symlinks-spec-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

describe('snapshot symlink resolution', () => {
  it('reads regular fixture content unchanged', async () => {
    const root = sandbox()
    try {
      mkdirSync(root, { recursive: true })
      const file = join(root, 'tool-schemas.expected.json')
      writeFileSync(file, '{"initial":[],"changes":[]}\n')
      await expect(readSnapshotText(file)).resolves.toBe('{"initial":[],"changes":[]}\n')
      expect(readSnapshotTextSync(file)).toBe('{"initial":[],"changes":[]}\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('follows unmaterialized link text to the target content', async () => {
    const root = sandbox()
    try {
      mkdirSync(join(root, 'scenario'), { recursive: true })
      mkdirSync(join(root, 'canonical'), { recursive: true })
      writeFileSync(join(root, 'canonical', 'system-prompt.expected.md'), '# canonical prompt\n')
      const link = join(root, 'scenario', 'system-prompt.expected.md')
      writeFileSync(link, '../canonical/system-prompt.expected.md')
      await expect(readSnapshotText(link)).resolves.toBe('# canonical prompt\n')
      expect(readSnapshotTextSync(link)).toBe('# canonical prompt\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('follows bare same-directory link names and link chains', async () => {
    const root = sandbox()
    try {
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'AGENTS.canonical.md'), 'instructions\n')
      writeFileSync(join(root, 'AGENTS.md'), 'AGENTS.canonical.md')
      writeFileSync(join(root, 'chain.md'), 'AGENTS.md')
      await expect(readSnapshotText(join(root, 'AGENTS.md'))).resolves.toBe('instructions\n')
      await expect(readSnapshotText(join(root, 'chain.md'))).resolves.toBe('instructions\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves prose, multi-line, and dangling-link content alone', async () => {
    const root = sandbox()
    try {
      mkdirSync(root, { recursive: true })
      const prose = join(root, 'system-prompt.expected.md')
      writeFileSync(prose, 'missing.target.md\n\nThe prompt text.\n')
      await expect(readSnapshotText(prose)).resolves.toBe('missing.target.md\n\nThe prompt text.\n')
      const dangling = join(root, 'dangling.json')
      writeFileSync(dangling, '../../nowhere/tool-schemas.expected.json')
      await expect(readSnapshotText(dangling)).resolves.toBe('../../nowhere/tool-schemas.expected.json')
      const oneLine = join(root, 'no-trailing-newline.txt')
      writeFileSync(oneLine, 'plain single line')
      await expect(readSnapshotText(oneLine)).resolves.toBe('plain single line')
      const absolute = join(root, 'absolute.txt')
      writeFileSync(absolute, join(root, 'elsewhere.json'))
      await expect(readSnapshotText(absolute)).resolves.toBe(join(root, 'elsewhere.json'))
      const empty = join(root, 'empty.json')
      writeFileSync(empty, '\n')
      await expect(readSnapshotText(empty)).resolves.toBe('\n')
      const selfLink = join(root, 'self.md')
      writeFileSync(selfLink, 'self.md')
      await expect(readSnapshotText(selfLink)).resolves.toBe('self.md')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('throws after a link cycle exceeds the hop bound', async () => {
    const root = sandbox()
    try {
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'a.md'), 'b.md')
      writeFileSync(join(root, 'b.md'), 'c.md')
      writeFileSync(join(root, 'c.md'), 'd.md')
      writeFileSync(join(root, 'd.md'), 'e.md')
      writeFileSync(join(root, 'e.md'), 'a.md')
      await expect(readSnapshotText(join(root, 'a.md')))
        .rejects.toThrow(/symlink chain exceeds 5 hops/)
      expect(() => readSnapshotTextSync(join(root, 'a.md')))
        .toThrow(/symlink chain exceeds 5 hops/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
