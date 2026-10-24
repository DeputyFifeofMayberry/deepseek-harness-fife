/**
 * The fork's verifiability-based effort routing through the shipped headless
 * profile: the first request runs at `low`, a failing configured check raises
 * it, and the same check passing afterwards returns it.
 * @module effort-policy-profile-snapshot
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'
import { describe, expect, it } from 'vitest'

const configPath = fileURLToPath(new URL('./effort-policy.patch.yml', import.meta.url))
const binScript = fileURLToPath(new URL('../../../../../packages/test-support/loader-smoke/tests/fixtures/headless-driver.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../../../tsconfig.json', import.meta.url))

const TASK = 'Run the typecheck, fix what it reports, and run it again.'
const SHELL_TOOL = process.platform === 'win32' ? 'pwsh' : 'bash'

/** The seeded check stands in for the repository's own `pnpm run typecheck`. */
const CHECK_SCRIPT = `
import { readFileSync } from 'node:fs'
// The model repairs the workspace by creating FIXED with the real write tool.
try {
  readFileSync(new URL('./FIXED', import.meta.url))
  console.log('run-gates: 5 passed, 0 failed, 0 skipped in 0.01s.')
} catch {
  console.log('packages/seed/src/probe.ts(1,14): error TS9999: seeded typecheck failure.')
  process.exitCode = 1
}
`
const PACKAGE_JSON = `${JSON.stringify({
  name: 'effort-policy-fixture',
  private: true,
  scripts: { typecheck: 'node ./check.mjs' },
}, null, 2)}\n`

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

/** The effort each request carried, plus whether the adapter supplied it. */
function requestEfforts(stdout: string): string[] {
  return events(stdout, 'request/header').map((row) => {
    const header = row.data?.['header'] as { config: { reasoningEffort?: string } } | undefined
    return header?.config.reasoningEffort ?? '<none>'
  })
}

describe('effort policy through the shipped headless profile', () => {
  it('runs at low, rises while the configured check fails, and returns when it passes', async () => {
    const result = await runLoaderSmoke({
      label: 'effort policy enablement',
      tempDirPrefix: 'dsh-effort-policy-',
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
        await writeFile(join(cwd, 'package.json'), PACKAGE_JSON)
        await writeFile(join(cwd, 'check.mjs'), CHECK_SCRIPT)
      },
    })

    const driver = rows(result.stdout)
    expect(driver.filter(row => row.type === 'result').map(row => row.output)).toEqual(['CHECK_CLEARED'])

    // The route advertises `high` as its default, so `high` here is the raised
    // level materialized by the adapter rather than a policy write. The request
    // after the mutation repeats that header, so only a change is logged.
    expect(requestEfforts(result.stdout)).toEqual(['low', 'high', 'low'])

    const decisions = events(result.stdout, 'effort/decision')
    expect(decisions.map(row => row.data?.['rule'])).toEqual(['escalated', 'base'])
    const open = decisions[0]?.data?.['openFailure'] as
      { verifier: string; sequence: number; revision: number } | undefined
    expect(open?.verifier).toContain('pnpm run typecheck')
    expect(typeof open?.sequence).toBe('number')
    expect(decisions[1]?.data?.['openFailure']).toBeUndefined()

    // One verification, one mutation, one re-verification. The re-check carries
    // a different description, so clearing depends on the identity ignoring it.
    const calls = events(result.stdout, 'tool/call').map(row => row.data?.['name'])
    expect(calls).toEqual([SHELL_TOOL, 'write', SHELL_TOOL])
    const checks = events(result.stdout, 'tool/call')
      .map(row => JSON.parse(String(row.data?.['arguments'])) as { command: string; description: string })
    expect(checks[0]?.command).toBe('pnpm run typecheck')
    expect(checks[2]?.command).toBe(checks[0]?.command)
    expect(checks[2]?.description).not.toBe(checks[0]?.description)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
