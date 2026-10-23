/**
 * The step-boundary incremental pruner through the shipped headless profile:
 * the tool result emitted by step 1 reaches step 2's request already pruned,
 * the shadowed original stays durable at full size, and the pass runs once.
 * @module step-prune-profile-snapshot
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'
import { describe, expect, it } from 'vitest'

const configPath = fileURLToPath(new URL('./step-prune.patch.yml', import.meta.url))
const binScript = fileURLToPath(new URL('../../../../../packages/test-support/loader-smoke/tests/fixtures/headless-driver.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../../../tsconfig.json', import.meta.url))

const TASK = 'Emit the sample output.'
const SHELL_TOOL = process.platform === 'win32' ? 'pwsh' : 'bash'

const EMIT_SCRIPT = `console.log('${'A'.repeat(400)}TAIL_TOKEN')\n`

interface SessionRow {
  readonly type: string
  readonly data?: Record<string, unknown>
}

interface DriverRow {
  readonly type: 'session_event' | 'result'
  readonly event?: SessionRow
  readonly output?: string
}

function rows(stdout: string): DriverRow[] {
  return stdout.split(/\r?\n/).filter(line => line.trim() !== '').map(line => JSON.parse(line) as DriverRow)
}

function events(stdout: string, type: string): SessionRow[] {
  return rows(stdout).flatMap((row) => {
    if (row.type !== 'session_event' || row.event?.type !== type) return []
    return [row.event]
  })
}

describe('step-boundary pruner through the shipped headless profile', () => {
  it('prunes a fresh tool result before its first request and leaves older surface untouched', async () => {
    const result = await runLoaderSmoke({
      label: 'step prune enablement',
      tempDirPrefix: 'dsh-step-prune-',
      binScript,
      libBinScript: binScript,
      configPath,
      binArgs: [configPath, TASK],
      tsconfigPath,
      env: {
        DSH_PERMISSION_MODE: 'danger-full-access',
        DSH_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: [process.env.NODE_OPTIONS, '--disable-warning=ExperimentalWarning']
          .filter(Boolean).join(' '),
      },
      prepare: async (cwd) => {
        await writeFile(join(cwd, 'emit.mjs'), EMIT_SCRIPT)
      },
    })

    // The mock replies PRUNE_SEEN only when the second request's tool result
    // kept the tail sentinel but lost the over-budget middle: proof that the
    // prune landed between the two requests, not after the fact.
    expect(driverResults(result.stdout)).toEqual(['PRUNE_SEEN'])

    // Exactly one bounded pass ran, and it shadow-priced one node.
    const prunes = events(result.stdout, 'compaction/prune')
    expect(prunes).toHaveLength(1)
    expect(prunes[0]?.data?.['shadowedSeqs']).toHaveLength(1)

    // The shadowed original stays durable at full size; the replacement
    // carries the pruned middle marker.
    const toolResults = JSON.stringify(events(result.stdout, 'tool/result'))
    expect(toolResults).toContain('A'.repeat(400))
    expect(toolResults).toContain('middle pruned')
    expect(toolResults).toContain('TAIL_TOKEN')

    // Two steps only: the prune replaced the result in place rather than
    // spawning extra loop work.
    expect(events(result.stdout, 'step/start')).toHaveLength(2)
    expect(callsOf(result.stdout)).toEqual([SHELL_TOOL])
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})

function driverResults(stdout: string): string[] {
  return rows(stdout).filter(row => row.type === 'result').map(row => row.output ?? '')
}

function callsOf(stdout: string): string[] {
  return events(stdout, 'tool/call').map(row => String(row.data?.['name']))
}
