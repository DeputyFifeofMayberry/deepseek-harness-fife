/**
 * Bash executable resolution, dependency-free so the executor, its suites, and
 * non-package consumers share ONE definition.
 *
 * On Windows a bare `bash` on PATH is usually `%SystemRoot%\\System32\\bash.exe`,
 * the WSL launcher, not Git Bash. A Windows host that installed Git for Windows
 * expects its Git Bash installation instead, so well-known Git Bash locations
 * are probed before PATH entries.
 *
 * @module @deepseek-ai/dsh-bash-local/resolve
 */

import { lstatSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Well-known Windows Git Bash install locations plus PATH entries, in
 * resolution order. Explicitly parameterized (env) so resolution is a pure
 * function of its inputs on every platform.
 * @param env - the environment to probe; defaults to the process environment.
 * @returns candidate `bash` executable paths in resolution order.
 */
export function candidateBashPaths(env: NodeJS.ProcessEnv = process.env): string[] {
  const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
  const localAppData = env.LOCALAPPDATA
  const candidates = [
    join(programFiles, 'Git', 'bin', 'bash.exe'),
  ]
  // Per-user Git installs live under %LOCALAPPDATA%\Programs.
  if (localAppData !== undefined && localAppData.length > 0) {
    candidates.push(join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'))
  }
  // MSYS2 and custom installs expose bash on PATH; entries may carry
  // surrounding quotes from `setx`-style definitions.
  for (const entry of (env.PATH ?? '').split(';')) {
    const trimmed = entry.trim().replace(/^"|"$/g, '')
    if (trimmed.length === 0) continue
    candidates.push(join(trimmed, 'bash.exe'))
  }
  return candidates
}

/**
 * Whether a candidate can be spawned. lstat opens the entry itself instead of
 * following reparse points, so it sees an app execution alias where stat hits
 * the target's ACL; a real directory never matches.
 */
function candidateExists(candidate: string): boolean {
  try {
    const stat = lstatSync(candidate)
    return stat.isFile() || stat.isSymbolicLink()
  } catch {
    // ENOENT (the candidate vanished between listing and probing) is the only
    // expected failure; any other error names an unspawnable path, so false
    // is the safe answer for it too.
    return false
  }
}

/**
 * Resolve the bash executable this executor spawns.
 * @param configured - an explicit `bashPath` config value, trusted as-is.
 * @param env - the environment to probe on Windows; defaults to the process environment.
 * @param platform - the platform to resolve for; defaults to the process platform.
 * @returns the first existing Git Bash location on Windows (the machine-wide
 *   install, a per-user install, then PATH entries such as MSYS2), else `bash`
 *   for PATH resolution.
 */
export function resolveBashPath(
  configured?: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (configured !== undefined && configured.length > 0) return configured
  if (platform === 'win32') {
    for (const candidate of candidateBashPaths(env)) {
      if (candidateExists(candidate)) return candidate
    }
  }
  return 'bash'
}
