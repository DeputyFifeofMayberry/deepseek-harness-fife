/**
 * Ad-hoc M6 evidence driver: boot the real headless profile with the fork's real
 * verifier, run one task whose configured check is this repository's own
 * `pnpm run typecheck`, and print the durable effort transitions.
 * @module m6-real-session
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runLoaderSmoke } from '../../../../packages/test-support/loader-smoke/src/index.ts'

const here = fileURLToPath(new URL('./', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const patchPath = join(here, 'real-session.patch.yml')
const probePath = join(repositoryRoot, 'packages/llm/effort-policy/src/__m6-real-session-probe.ts')
const binScript = join(repositoryRoot, 'packages/test-support/loader-smoke/tests/fixtures/headless-driver.ts')
const tsconfigPath = join(repositoryRoot, 'tsconfig.json')

interface Row {
  readonly type: string
  readonly data?: Record<string, unknown>
}

let report = ''

function summarize(label: string, log: string): void {
  const rows: Row[] = log.split(/\r?\n/).filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Row)
  const headers = rows.filter(row => row.type === 'request/header').map((row) => {
    const header = row.data?.['header'] as {
      config: { provider: string; model: string; reasoningEffort?: string }
      adapterDefaults?: { reasoningEffort?: boolean }
    }
    return `${header.config.provider}/${header.config.model}`
      + ` effort=${header.config.reasoningEffort ?? '<none>'}`
      + ` adapterDefault=${String(header.adapterDefaults?.reasoningEffort ?? false)}`
  })
  const decisions = rows.filter(row => row.type === 'effort/decision').map((row) => {
    const failure = row.data?.['openFailure'] as { verifier?: string } | undefined
    return `${String(row.data?.['rule'])}`
      + ` base=${String(row.data?.['base'])}`
      + ` open=${failure === undefined ? 'none' : `yes(${String(failure.verifier).replaceAll('\u0000', ' | ')})`}`
  })
  const calls = rows.filter(row => row.type === 'tool/call').map((row) => {
    const args = JSON.parse(String(row.data?.['arguments'])) as { command: string }
    return `${String(row.data?.['name'])}: ${args.command}`
  })
  const results = rows.filter(row => row.type === 'tool/result').map((row) => {
    const message = row.data?.['message'] as
      { content: { type: string; text?: string }[]; isError?: boolean } | undefined
    const text = (message?.content ?? []).flatMap(block => block.type === 'text' ? [block.text ?? ''] : []).join('')
    const check = text.includes('run-gates:') || text.includes('error TS')
    return check
      ? `${message?.isError === true ? 'ERROR' : 'ok'}: ${text.split(/\r?\n/).filter(line => line.includes('run-gates:') || line.includes('error TS')).slice(-3).join(' | ')}`
      : `${message?.isError === true ? 'ERROR' : 'ok'}: ${text.slice(0, 80).replaceAll('\n', ' ')}`
  })
  report += [
    `${label}`,
    `  requests: ${headers.join('\n            ')}`,
    `  decisions:\n            ${decisions.join('\n            ')}`,
    `  tool calls:\n            ${calls.join('\n            ')}`,
    `  results:\n            ${results.join('\n            ')}`,
  ].join('\n') + '\n'
}

async function main(): Promise<void> {
  await mkdir(join(repositoryRoot, 'packages/llm/effort-policy/src'), { recursive: true })
  await writeFile(probePath, "export const probe: number = 'not a number'\n")
  try {
    const result = await runLoaderSmoke({
      label: 'm6 real session',
      tempDirPrefix: 'dsh-m6-real-',
      binScript,
      libBinScript: binScript,
      configPath: patchPath,
      binArgs: [patchPath, 'Run the typecheck, remove the seeded probe if it fails, and run it again.'],
      tsconfigPath,
      processTimeoutMs: 300_000,
      env: {
        DSH_PERMISSION_MODE: 'danger-full-access',
        DSH_TELEMETRY_DISABLED: '1',
      },
      inspect: async (cwd) => {
        const root = join(cwd, '.sessions')
        const files = await readdir(root, { recursive: true })
        const logs = files.filter(name => name.includes('session') && name.endsWith('.jsonl'))
        for (const file of logs) {
          summarize(file, await readFile(join(root, file), 'utf8'))
        }
      },
    })
    const final = result.stdout.split(/\r?\n/).filter(line => line.trim() !== '')
      .map(line => JSON.parse(line) as { type: string; output?: string })
      .filter(row => row.type === 'result').map(row => row.output)
    report += `final output: ${String(final.at(-1))}\n`
    process.stdout.write(report)
    process.stdout.write(`stderr:\n${result.stderr}\n`)
  } finally {
    await rm(probePath, { force: true })
  }
}

await main()
