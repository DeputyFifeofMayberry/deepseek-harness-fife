/**
 * Real-API probe of Z.ai's Anthropic-compatible surface, per the accepted spec
 * (issue: Probe Z.ai's Anthropic-compatible surface). Self-skips without
 * `ZAI_API_KEY`. The probe records observations — request outcomes, thinking
 * encodings accepted, thinking-block signatures, SSE event names — and asserts
 * nothing about vendor behavior, so vendor changes cannot break CI. Run the
 * evidence-bearing output, then record it on the spec issue and in the
 * research note's open-questions section.
 *
 * @module dsh-llm-pi-ai/tests/zai-anthropic-probe.e2e
 */
import { describe, expect, it } from 'vitest'
import { collectProbeEvidence } from './zai-anthropic-probe.ts'

const zaiKey = process.env.ZAI_API_KEY

describe.skipIf(zaiKey === undefined)('Z.ai Anthropic-surface probe (set ZAI_API_KEY to run)', () => {
  it('records thinking-encoding and thinking-signature observations', { timeout: 180_000 }, async () => {
    if (zaiKey === undefined) throw new Error('ZAI_API_KEY was unset after the skip guard admitted this run')
    const evidence = await collectProbeEvidence(zaiKey)
    // Structure only: every variant attempted, every outcome recorded. Vendor
    // behavior itself is evidence to read, not behavior to assert.
    expect(evidence.outcomes.length).toBeGreaterThanOrEqual(3)
    expect(evidence.outcomes.map(outcome => outcome.variant)).toContain('adaptive')
    expect(evidence.outcomes.map(outcome => outcome.variant)).toContain('enabled-effort')
    expect(evidence.outcomes.map(outcome => outcome.variant)).toContain('enabled')
    console.info('[zai-anthropic-probe] evidence:', JSON.stringify(evidence, null, 2))
  })
})
