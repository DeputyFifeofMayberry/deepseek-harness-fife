#!/usr/bin/env node
/**
 * Command-line entry for the fork's fife alias.
 *
 * The alias runs the same profile launcher as dsh and changes only the launcher
 * name and the version string printed by --version. It intentionally shares the
 * dsh home, profiles, settings, sessions, and credentials.
 * @module @deepseek-ai/dsh/fife
 */

/* v8 ignore file -- built-bin acceptance exercises this self-executing dispatch. */

import { getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot'
import { runCli } from './launcher.ts'

/** Fork format revision; increment when fork-specific launcher behavior changes. */
const FIFE_REVISION = 1

/** Compose the fork-aware display version without changing the runtime version. */
function fifeDisplayVersion(): string {
  const base = getDshRuntimeVersion()
  return base.includes('+') ? `${base}.fife.${FIFE_REVISION}` : `${base}+fife.${FIFE_REVISION}`
}

if (import.meta.main) {
  await runCli({ programName: 'fife', displayVersion: fifeDisplayVersion() })
}
