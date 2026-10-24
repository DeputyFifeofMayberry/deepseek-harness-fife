/**
 * Observation harness for Z.ai's Anthropic-compatible surface
 * (`https://api.z.ai/api/anthropic/v1/messages`). The probe exists to answer,
 * with recorded evidence instead of inference from another client's source:
 *
 * 1. which thinking encoding the endpoint accepts — `adaptive`, `enabled`
 *    plus `output_config.effort`, or `enabled` alone;
 * 2. whether returned thinking blocks carry a `signature`, which decides
 *    whether an adapter would need stream repair before any route ships;
 * 3. whether the endpoint accepts `x-api-key` alone (every request
 *    authenticates that way, so a successful run is the answer).
 *
 * The harness records outcomes; it never asserts vendor behavior, so vendor
 * changes cannot break CI. Evidence is secret-masked and truncated here, at
 * the capture point, so no caller can leak the key.
 *
 * @module dsh-llm-pi-ai/tests/zai-anthropic-probe
 */

/** The Anthropic-compatible messages endpoint Z.ai publishes for coding plans. */
const PROBE_ENDPOINT = 'https://api.z.ai/api/anthropic/v1/messages'

/** Request bound per probe call, so a plan-side rate limit is never at risk. */
const PROBE_TIMEOUT_MS = 30_000

/** Recorded response text cap per outcome. */
const MAX_EVIDENCE_CHARS = 2_000

/** Recorded response text cap for streaming bodies, whose SSE framing is verbose. */
const MAX_STREAM_EVIDENCE_CHARS = 1_000

/** Unique SSE event names retained per streaming run. */
const MAX_STREAM_EVENT_NAMES = 20

/**
 * Whether observed thinking blocks carried a signature. `none-observed` means
 * no thinking block was available to inspect — an unparseable body, an error
 * body, or a completion without thinking — and is never treated as an answer.
 */
export type ThinkingSignatureObservation = 'present' | 'absent' | 'none-observed'

/** One recorded probe request: outcome facts plus secret-masked response text. */
export interface ZaiProbeOutcome {
  /** Which thinking encoding this request carried. */
  readonly variant: string
  /** HTTP status, undefined when the request failed below HTTP. */
  readonly status: number | undefined
  /** Whether the endpoint answered 2xx. */
  readonly ok: boolean
  /** Secret-masked, truncated response or failure text. */
  readonly detail: string
}

/** One probe run's complete recorded evidence. */
export interface ZaiAnthropicProbeEvidence {
  readonly endpoint: string
  /** One outcome per thinking-encoding variant, plus one streaming follow-up. */
  readonly outcomes: readonly ZaiProbeOutcome[]
  /** Signature observation from the first successful non-streaming response. */
  readonly thinkingSignatures: ThinkingSignatureObservation
  /** Unique SSE event names from the first successful streaming follow-up. */
  readonly streamEventNames: readonly string[]
  /** Whether the streaming follow-up's raw text carried `signature_delta`. */
  readonly streamHasSignatureDelta: boolean
}

/**
 * Replace every occurrence of the credential in captured text with a marker,
 * so recorded evidence can quote response bodies without leaking the key. An
 * empty or absent credential leaves the text unchanged.
 * @param text - captured response or failure text.
 * @param secret - the credential to mask.
 * @returns text safe to record.
 */
export function maskSecret(text: string, secret: string | undefined): string {
  if (secret === undefined || secret.length === 0) return text
  return text.split(secret).join('[redacted:key]')
}

/**
 * Bound captured text to the recorded-evidence cap.
 * @param text - captured text.
 * @param maxChars - retention cap.
 * @returns text at or under the cap, with the trimmed count stated when cut.
 */
export function truncateEvidence(text: string, maxChars: number = MAX_EVIDENCE_CHARS): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Inspect a non-streaming response body for thinking blocks and report whether
 * they carry a signature. Unparseable bodies and bodies without a thinking
 * block report `none-observed` rather than an answer.
 * @param bodyText - raw response body text.
 * @returns the signature observation.
 */
export function thinkingSignatureObservation(bodyText: string): ThinkingSignatureObservation {
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return 'none-observed'
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.content)) return 'none-observed'
  for (const block of parsed.content) {
    if (!isRecord(block) || block.type !== 'thinking') continue
    return typeof block.signature === 'string' && block.signature.length > 0 ? 'present' : 'absent'
  }
  return 'none-observed'
}

/**
 * Collect the SSE `event:` names from a streaming response body, in first-seen
 * order, capped so a long stream cannot grow recorded evidence without bound.
 * @param sseText - raw streaming response text.
 * @returns unique event names.
 */
export function streamedEventNames(sseText: string): readonly string[] {
  const names: string[] = []
  for (const line of sseText.split(/\r?\n/)) {
    if (!line.startsWith('event:')) continue
    const name = line.slice('event:'.length).trim()
    if (name.length > 0 && !names.includes(name) && names.length < MAX_STREAM_EVENT_NAMES) names.push(name)
  }
  return names
}

function probeBody(thinking: Record<string, unknown>, outputConfig: Record<string, unknown> | undefined, stream: boolean): string {
  return JSON.stringify({
    model: 'glm-5.3',
    max_tokens: 64,
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    thinking,
    ...(outputConfig === undefined ? {} : { output_config: outputConfig }),
    ...(stream ? { stream: true } : {}),
  })
}

async function probeOnce(key: string, body: string): Promise<{ status: number; ok: boolean; text: string }> {
  const response = await fetch(PROBE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Deliberately x-api-key alone: a successful run doubles as the answer
      // to whether the endpoint accepts the pi-ai authentication shape.
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body,
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
  return { status: response.status, ok: response.ok, text: await response.text() }
}

/**
 * Run the probe: one non-streaming request per thinking-encoding variant, and
 * for the first success one streaming follow-up. Every request outcome —
 * success, 4xx/5xx, or transport failure — is recorded, never thrown.
 * @param key - the coding-plan API key (`ZAI_API_KEY`).
 * @returns the complete recorded evidence.
 */
export async function collectProbeEvidence(key: string): Promise<ZaiAnthropicProbeEvidence> {
  const variants: ReadonlyArray<readonly [string, Record<string, unknown>, Record<string, unknown> | undefined]> = [
    ['adaptive', { type: 'adaptive' }, { effort: 'low' }],
    ['enabled-effort', { type: 'enabled' }, { effort: 'low' }],
    ['enabled', { type: 'enabled' }, undefined],
  ]
  const outcomes: ZaiProbeOutcome[] = []
  let thinkingSignatures: ThinkingSignatureObservation = 'none-observed'
  let streamEventNames: readonly string[] = []
  let streamHasSignatureDelta = false
  let streamedFollowUpDone = false
  for (const [variant, thinking, outputConfig] of variants) {
    try {
      const run = await probeOnce(key, probeBody(thinking, outputConfig, false))
      outcomes.push({
        variant,
        status: run.status,
        ok: run.ok,
        detail: truncateEvidence(maskSecret(run.text, key)),
      })
      if (run.ok && thinkingSignatures === 'none-observed') {
        thinkingSignatures = thinkingSignatureObservation(run.text)
      }
      if (run.ok && !streamedFollowUpDone) {
        streamedFollowUpDone = true
        const streamed = await probeOnce(key, probeBody(thinking, outputConfig, true))
        streamEventNames = streamedEventNames(streamed.text)
        streamHasSignatureDelta = streamed.text.includes('signature_delta')
        outcomes.push({
          variant: `${variant}-stream`,
          status: streamed.status,
          ok: streamed.ok,
          detail: truncateEvidence(maskSecret(streamed.text, key), MAX_STREAM_EVIDENCE_CHARS),
        })
      }
    } catch (error) {
      outcomes.push({
        variant,
        status: undefined,
        ok: false,
        detail: maskSecret(error instanceof Error ? error.message : String(error), key),
      })
    }
  }
  return { endpoint: PROBE_ENDPOINT, outcomes, thinkingSignatures, streamEventNames, streamHasSignatureDelta }
}
