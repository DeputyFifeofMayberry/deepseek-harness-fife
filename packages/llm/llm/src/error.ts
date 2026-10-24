/**
 * Harness error base with a stable machine-routable code and chained cause.
 * Package errors extend it so tool results and replay can retain failure class.
 * @module @deepseek-ai/dsh-llm/error
 */

/**
 * Base class for all harness errors. Carries a `code` (stable, programmatic —
 * e.g. `NO_ADAPTER`, `INVALID_ARGS`) distinct from the
 * human-readable `message`, and supports `cause` chaining via the standard
 * `ErrorOptions`. `name` defaults to the subclass constructor name.
 */
export class HarnessError extends Error {
  /** Stable machine-routable failure class (e.g. `RATE_LIMIT`); route on this, never by parsing `message`. */
  readonly code: string

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.name = new.target.name
  }
}

/** Canonical provider-neutral code for a model request rejected because its context window was exceeded. */
export const CONTEXT_WINDOW_EXCEEDED_CODE = 'CONTEXT_WINDOW_EXCEEDED'

/** Canonical provider-neutral code for an exhausted account quota or balance. */
export const QUOTA_EXCEEDED_CODE = 'QUOTA'

/** Account-token quota that can be replenished through the first-party billing page. */
export const ACCOUNT_QUOTA_EXCEEDED_CODE = 'ACCOUNT_QUOTA'

/**
 * Canonical provider-neutral code for a response that completed normally but
 * carried no content blocks at all. Providers occasionally emit a degenerate
 * completion (a terminal stop with zero output); adapters classify it as this
 * failure instead of yielding an empty assistant message, because an empty
 * message silently ends the turn with nothing for the user or the loop to act
 * on. The attempt produced nothing durable, so retry policy treats it as safe
 * to repeat.
 */
export const EMPTY_RESPONSE_CODE = 'EMPTY_RESPONSE'

/**
 * Canonical provider-neutral code for a credential that was supplied but
 * cannot be used — malformed rather than absent. Distinct from
 * `MISSING_CREDENTIAL` because the fix differs: correct the stored value
 * rather than supply one. Deliberately outside the default retryable set —
 * a malformed credential fails identically on every attempt.
 */
export const INVALID_CREDENTIAL_CODE = 'INVALID_CREDENTIAL'

/** Structured codes and plain phrases that explicitly name a context bound being exceeded. */
const STRUCTURED_CONTEXT_OVERFLOW = new RegExp(
  String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]`
  + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`,
  'i',
)

/** Request-size wording that ties "too large" directly to model context capacity. */
const TOO_LARGE_FOR_CONTEXT = new RegExp(
  String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?`
  + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?`
  + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`,
  'i',
)

/** "Exceeds" wording is safe only when its object is explicitly the model context. */
const EXCEEDS_MODEL_CONTEXT = new RegExp(
  String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}`
  + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}`
  + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`,
  'i',
)

/**
 * Recognize the context-overflow wording used by OpenAI-compatible providers
 * and library adapters. Adapters pass all available provider code, type, and
 * message text so both thrown and in-band delivery styles share one classifier.
 * @param detail - provider error code/type/message text joined into one string.
 * @returns true when the detail identifies a request exceeding the model context window.
 */
export function isContextWindowExceededError(detail: string): boolean {
  return STRUCTURED_CONTEXT_OVERFLOW.test(detail)
    || /\b(?:maximum|max)(?:\s+(?:allowed|supported))?\s+context\s+(?:length|window)\b/i.test(detail)
    || TOO_LARGE_FOR_CONTEXT.test(detail)
    || /\b(?:input|prompt|request)\s+(?:is\s+)?too\s+(?:long|large)\s+for\s+(?:this|the)\s+model\b/i.test(detail)
    || EXCEEDS_MODEL_CONTEXT.test(detail)
}

/**
 * Recognize provider wording that identifies an exhausted account quota rather
 * than a transient request-rate limit.
 * @param detail - provider error code/type/message text joined into one string.
 * @returns true only for terminal quota, balance, credit, budget, or usage-limit wording.
 */
export function isQuotaExceededError(detail: string): boolean {
  return /\binsufficient[\s_-]+(?:quota|balance|credits?)\b/i.test(detail)
    || /\b(?:quota|usage[\s_-]+limit)[\s_-]+(?:exceeded|exhausted|reached)\b/i.test(detail)
    || /\bexceed(?:ed|s)?[\s_-]+(?:(?:your|the)[\s_-]+)?(?:current[\s_-]+)?quota\b/i.test(detail)
    || /\b(?:balance|credits?)[\s_-]+(?:exhausted|depleted)\b/i.test(detail)
    || /\bout[\s_-]+of[\s_-]+(?:credits?|budget)\b/i.test(detail)
}

/**
 * Z.ai / BigModel vendor business codes routed to canonical harness codes.
 * Each entry pairs a matcher for one code's textual forms with the canonical
 * code it routes to. Terminal quota, fair-use, spend-cap, and
 * concurrency-ceiling codes route to `QUOTA` so a terminal body under a
 * transient-looking 429 status stops retrying; transient rate, overload, and
 * wrapped-network codes route to their retryable families; auth,
 * invalid-request, and context codes keep their harness meanings. Table order
 * decides when text carries more than one vendor code. Codes absent from the
 * table keep the generic status-based classification. Evidence: Z.ai's own
 * harness ships this table with per-code retryability
 * (`.agents/plans/2026-10-23-zai-zcode-integration-research.md`).
 */
const ZAI_BUSINESS_CODE_ROUTES: ReadonlyArray<readonly [RegExp, string]> = [
  // Terminal quota, fair-use, spend cap, and concurrency ceilings: lifting
  // them requires an account change, so no resend can succeed.
  ...[
    'insufficient_quota',
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
    'exceeded_current_quota_error',
    '2056',
    '20097',
    // Observed live on api.z.ai (2026-10-24): "[1113][Insufficient balance or
    // no resource package. Please recharge.]" — balance exhaustion, terminal.
    '1113',
    '1304',
    '1308',
    '1310',
    '1313',
    '1316',
    '1317',
    '1318',
    '1319',
    '1320',
    '1321',
    '3008',
    '3009',
    '3010',
  ].map((code): [RegExp, string] => [zaiBusinessCodePattern(code), QUOTA_EXCEEDED_CODE]),
  // Transient rate limits and provider overload: safe to retry with backoff.
  ...['1302', '1303', '1305', '3002', 'rate_limit_reached_error', 'rate_limit_error']
    .map((code): [RegExp, string] => [zaiBusinessCodePattern(code), 'RATE_LIMIT']),
  ...['1120', '1230', '2007', '1312', 'engine_overloaded_error', 'overloaded_error']
    .map((code): [RegExp, string] => [zaiBusinessCodePattern(code), 'SERVER']),
  ...([
    ['1234', 'TRANSPORT'],
    ['1261', CONTEXT_WINDOW_EXCEEDED_CODE],
    ['1006', 'AUTH'],
    ['3007', 'AUTH'],
    ['1005', 'INVALID_REQUEST'],
    ['3001', 'INVALID_REQUEST'],
    ['3006', 'INVALID_REQUEST'],
  ] as const).map(([code, routed]): [RegExp, string] => [zaiBusinessCodePattern(code), routed]),
]

/**
 * Match one vendor code in its folded-JSON form (`"code":"1302"`), its
 * bracketed SSE form (`[1302]`), or — for the distinctive snake_case codes —
 * bare in message text. Numeric codes never match bare, so an unrelated
 * number in a message cannot route the failure.
 */
function zaiBusinessCodePattern(code: string): RegExp {
  return /[a-z_]/.test(code)
    ? new RegExp(String.raw`"code"\s*:\s*"?${code}"?|\b${code}\b`)
    : new RegExp(String.raw`"code"\s*:\s*"?${code}(?!\d)"?|\[${code}\]`)
}

/**
 * Route a Z.ai / BigModel business code carried in provider error text to its
 * canonical harness failure code. The vendor code reaches this layer inside
 * the flattened error message — a folded JSON body, the bracketed SSE form, or
 * a bare snake_case code — so recognition is text-shaped like the other
 * recognition helpers in this module.
 * @param detail - provider error code/type/message text joined into one string.
 * @returns the canonical code of the first matching table entry, or undefined
 *   when the detail carries none.
 */
export function zaiBusinessErrorCode(detail: string): string | undefined {
  for (const [pattern, code] of ZAI_BUSINESS_CODE_ROUTES) {
    if (pattern.test(detail)) return code
  }
  return undefined
}

/**
 * Render a thrown value with its full `cause` chain and AggregateError
 * members, so transport wrappers like undici's `TypeError: fetch failed`
 * surface the underlying failure instead of masking it. Plain structured
 * failures render their own data-backed `message`. Diagnostic-surface
 * rendering only (messages, notices, logs) — never parse the result; route on
 * {@link HarnessError.code}.
 * @param value - the caught value (`unknown` in catch clauses).
 * @returns the outermost message first, each cause appended with `: ` (skipped
 * when it repeats the wrapper message verbatim), and AggregateError members
 * bracketed and `; `-joined.
 */
export function errorChain(value: unknown): string {
  // Tracks the active recursion path (entries removed on exit), so only true
  // cycles are flagged and a diamond-shared cause still renders in full.
  const path = new Set<unknown>()
  const render = (current: unknown): string => {
    if (path.has(current)) return '<circular cause>'
    path.add(current)
    try {
      if (!(current instanceof Error)) {
        if (typeof current === 'object' && current !== null) {
          const descriptor = Object.getOwnPropertyDescriptor(current, 'message')
          if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'string') {
            return descriptor.value
          }
        }
        return String(current)
      }
      const message = current.message === '' ? current.name : current.message
      const members = current instanceof AggregateError && current.errors.length > 0
        ? ` [${current.errors.map(render).join('; ')}]`
        : ''
      const causeText = current.cause === undefined || current.cause === null
        ? ''
        : render(current.cause)
      // Wrappers like `new HarnessError(String(value), code, { cause: value })`
      // repeat their cause verbatim; rendering it again would only add noise.
      const cause = causeText === '' || causeText === message ? '' : `: ${causeText}`
      return `${message}${members}${cause}`
    } catch {
      // Only hostile coercion or hostile accessors (a throwing toString /
      // Symbol.toPrimitive on a non-Error, or a throwing message/name/cause/
      // errors getter on an Error subclass): this renderer feeds UI notices
      // and logs, so nothing may escape. Inner frames catch their own throws,
      // so only the hostile node collapses, not the whole chain.
      return '<unrenderable value>'
    } finally {
      path.delete(current)
    }
  }
  return render(value)
}

/**
 * Narrow an arbitrary thrown value to a HarnessError (for `instanceof` at runtime boundaries).
 * @param value - the caught value (`unknown` in catch clauses).
 * @returns true only for real instances; duck-typed or cross-realm errors do not narrow.
 */
export function isHarnessError(value: unknown): value is HarnessError {
  return value instanceof HarnessError
}

/**
 * Canonical code for a request an image-capable route cannot send until more
 * of its images are offloaded. The failure's `offloadImages` names how many
 * more of the oldest retained occurrences must be offloaded;
 * `dsh-compaction-image-offload` records an `image/offload` selection before
 * the agent or summarizer retries with freshly derived input.
 */
export const IMAGE_OFFLOAD_REQUIRED_CODE = 'IMAGE_OFFLOAD_REQUIRED'
