/** The shipped composer recalls a chat's submitted inputs with Up (per-session input history). */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import type { ReplayEntry, ReplayOverrideDoc } from '@deepseek-ai/dsh-llm-replay'
import { acknowledgeReloadConnectionLoss, launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'

const PROMPT = 'INPUT_HISTORY_TRACER recall this exact prompt'

function ackStream(): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text: 'INPUT_HISTORY_ACK ' },
    { type: 'block-end', index: 0, block: { type: 'text', text: 'INPUT_HISTORY_ACK' } },
    { type: 'usage', usage: { inputTokens: 16, outputTokens: 4 } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

describe('web e2e: composer input history recall', () => {
  let browser: Browser
  let page: Page
  let replayDir: string
  let scaffold: WebScaffold
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    replayDir = await mkdtemp(join(tmpdir(), 'dsh-input-history-replay-'))
    const replayOverride = join(replayDir, 'replay.override.json')
    const override: ReplayOverrideDoc = [{ kind: 'chunks', chunks: ackStream() } satisfies ReplayEntry]
    await writeFile(replayOverride, JSON.stringify(override))
    scaffold = await launchWebScaffold({
      replayFixture: join(replayDir, 'override-only.jsonl'),
      replayOverride,
      replayContextWindow: 100_000,
    })
    const launched = await chromium.launch()
    browser = launched
    page = await newEnglishPage(launched)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await connectFreshWorkspace(page, scaffold.workspaceCwd, 'composer-input-history')
  }, 120_000)

  afterAll(async () => {
    const failures: unknown[] = []
    await browser?.close().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (replayDir !== undefined) {
      await rm(replayDir, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'input-history e2e cleanup failed')
  })

  it('recalls the submitted prompt with Up and again after a reload', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-composer-input-history'))
    const composer = page.locator('[data-composer-input][contenteditable="true"]').first()
    await writeComposerDraft(page, composer, PROMPT)
    const settled = scaffold.whenTurnSettled(60_000)
    await composer.press('Enter')
    await page.getByText(PROMPT, { exact: false }).last().waitFor({ timeout: 15_000 })
    await settled
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe('')

    // Up on the cleared, settled composer refills the submitted prompt.
    await composer.press('ArrowUp')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(PROMPT)

    // The recall survives a reload: the history store rehydrates per session.
    const warningStart = tripwire.warnings.length
    await page.reload()
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
    const reloaded = page.locator('[data-composer-input][contenteditable="true"]').first()
    await reloaded.waitFor({ timeout: 30_000 })
    await reloaded.click()
    await reloaded.press('ArrowUp')
    await expect.poll(() => reloaded.textContent(), { timeout: 10_000 }).toBe(PROMPT)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 120_000)
})
