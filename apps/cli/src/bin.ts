#!/usr/bin/env node
/**
 * Command-line entry for dsh.
 * @module @deepseek-ai/dsh/bin
 */

/* v8 ignore file -- built-bin acceptance exercises this self-executing dispatch. */

import { runCli } from './launcher.ts'

export { runCli }
export type { RunCliOptions } from './launcher.ts'

if (import.meta.main) {
  await runCli()
}
