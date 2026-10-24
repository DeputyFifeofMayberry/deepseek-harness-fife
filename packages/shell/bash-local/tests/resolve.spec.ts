import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { candidateBashPaths, resolveBashPath } from '@deepseek-ai/dsh-bash-local'

const scratch = mkdtempSync(join(tmpdir(), 'dsh-bash-resolve-'))
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('resolveBashPath and candidateBashPaths (pure, every platform)', () => {
  it('trusts an explicit configured path verbatim', () => {
    expect(resolveBashPath('C:\\Git\\bin\\bash.exe')).toBe('C:\\Git\\bin\\bash.exe')
    expect(resolveBashPath('bash')).toBe('bash')
  })

  it('falls through an empty configured path to platform resolution', () => {
    expect(resolveBashPath('', {
      PATH: 'P:\\no-bin',
      ProgramFiles: 'P:\\no-program-files',
      LOCALAPPDATA: 'L:\\no-local-app-data',
    }, 'win32')).toBe('bash')
  })

  it('returns bash on non-Windows platforms regardless of the environment', () => {
    expect(resolveBashPath(undefined, { ProgramFiles: 'P:\\Program Files' }, 'linux')).toBe('bash')
    expect(resolveBashPath(undefined, { PATH: 'P:\\Git\\bin' }, 'darwin')).toBe('bash')
  })

  it('lists the machine-wide Git install, the per-user install, then PATH entries on win32', () => {
    expect(candidateBashPaths({
      ProgramFiles: 'P:\\Program Files',
      LOCALAPPDATA: 'L:\\Local',
      PATH: ';"Q:\\quoted git";' + ';',
    })).toEqual([
      join('P:\\Program Files', 'Git', 'bin', 'bash.exe'),
      join('L:\\Local', 'Programs', 'Git', 'bin', 'bash.exe'),
      join('Q:\\quoted git', 'bash.exe'),
    ])
    // A missing PATH contributes no entries, and absent roots keep the defaults.
    expect(candidateBashPaths({})).toEqual([
      join('C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    ])
  })

  it('returns the first EXISTING win32 candidate, else bash', () => {
    const store = join(scratch, 'store')
    mkdirSync(store, { recursive: true })
    writeFileSync(join(store, 'bash.exe'), '')
    // The existing PATH entry wins over the non-existent well-known installs.
    expect(resolveBashPath(undefined, {
      ProgramFiles: join(scratch, 'missing'),
      LOCALAPPDATA: join(scratch, 'missing-local'),
      PATH: store,
    }, 'win32')).toBe(join(store, 'bash.exe'))
    // No candidate exists anywhere → the PATH-resolution fallback.
    expect(resolveBashPath(undefined, {
      ProgramFiles: join(scratch, 'missing'),
      LOCALAPPDATA: join(scratch, 'missing-local'),
      PATH: join(scratch, 'empty'),
    }, 'win32')).toBe('bash')
  })

  it('skips a directory candidate and falls through to the PATH-resolution default', () => {
    const store = join(scratch, 'directory-store')
    mkdirSync(join(store, 'bash.exe'), { recursive: true })
    expect(resolveBashPath(undefined, {
      ProgramFiles: join(scratch, 'missing'),
      LOCALAPPDATA: join(scratch, 'missing-local'),
      PATH: store,
    }, 'win32')).toBe('bash')
  })
})
