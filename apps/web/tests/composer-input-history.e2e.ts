/** The shipped composer recalls a chat's submitted inputs with Up/Down (per-session input history walk). */
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

  it('walks the history with Up and Down, restores the saved draft, and keeps multiline arrows native outside the walk', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-composer-input-history-walk'))
    const composer = page.locator('[data-composer-input][contenteditable="true"]').first()
    const send = async (text: string): Promise<void> => {
      await writeComposerDraft(page, composer, text)
      const settled = scaffold.whenTurnSettled(60_000)
      await composer.press('Enter')
      await page.getByText(text, { exact: false }).last().waitFor({ timeout: 15_000 })
      await settled
      await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe('')
    }
    const alpha = 'WALK_ALPHA tracer prompt'
    const beta = 'WALK_BETA tracer prompt'
    const gamma = 'WALK_GAMMA tracer prompt'
    const workInProgress = 'WALK_WIP unfinished draft'
    await send(alpha)
    await send(beta)
    await send(gamma)

    // Entering the walk saves the in-progress draft; Up walks back one entry per press.
    await writeComposerDraft(page, composer, workInProgress)
    await composer.press('ArrowUp')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(gamma)
    await composer.press('ArrowUp')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(beta)

    // Escape hands the in-progress draft back from anywhere in the walk.
    await composer.press('Escape')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(workInProgress)

    // Down walks forward again and past the newest entry restores the saved draft.
    await composer.press('ArrowUp')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(gamma)
    await composer.press('ArrowUp')
    await composer.press('ArrowDown')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(gamma)
    await composer.press('ArrowDown')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(workInProgress)

    // Outside the walk, Up and Down stay the multiline caret keys: the draft
    // keeps its text (no recall) while the caret crosses the line break.
    await composer.click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('WALK_MULTI line one')
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('WALK_MULTI line two')
    const lineTop = (): Promise<number | null> => page.evaluate(() => {
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount === 0) return null
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      return rect.height === 0 ? null : rect.top
    })
    const multilineBefore = await composer.innerText()
    const beforeUp = await lineTop()
    await composer.press('ArrowUp')
    expect(await composer.innerText()).toBe(multilineBefore)
    const afterUp = await lineTop()
    expect(beforeUp).not.toBeNull()
    expect(afterUp).not.toBeNull()
    expect(afterUp).not.toBe(beforeUp)
    await composer.press('ArrowDown')
    expect(await composer.innerText()).toBe(multilineBefore)

    // Sending the multiline draft recalls it with the caret on its last line;
    // the next Up still walks because the caret guard applies only to entry.
    await composer.press('Enter')
    const multiSettled = scaffold.whenTurnSettled(60_000)
    await page.getByText('WALK_MULTI line two', { exact: false }).last().waitFor({ timeout: 15_000 })
    await multiSettled
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe('')
    await composer.press('ArrowUp')
    await expect.poll(() => composer.innerText(), { timeout: 10_000 }).toContain('WALK_MULTI line one')
    await expect.poll(() => composer.innerText(), { timeout: 10_000 }).toContain('WALK_MULTI line two')
    await composer.press('ArrowUp')
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(gamma)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 180_000)
})
