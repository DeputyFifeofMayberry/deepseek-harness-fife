# Research: what ZCode knows about Z.ai GLM that fifecode does not

Date: 2026-10-23. Read-only research for the request "make fifecode fully and completely optimized for the Z.ai GLM coding plan, using the public `zai-org/ZCode` repository as the reference". Every claim carries a `path:line` citation into one of two checkouts; inferences are labeled; open questions are collected at the end.

Sources:

- `ZCode`: shallow clone of <https://github.com/zai-org/ZCode> at commit `3c5b227649371507ddc4eb46ac5133afe6db1cab` ("chore: sync ZCode source", 2026-10-20), cloned to `Y:\_zcode_ref\ZCode`. Apache-2.0 first-party code with a separate NOTICE (`NOTICE.md:71-73`).
- `fifecode`: this workspace, plus the installed `@earendil-works/pi-ai@1.1.0` that backs its multi-provider adapter.

## Summary

fifecode is already wired for GLM: the installed pi-ai catalog ships `zai` and `zai-coding-cn` routes with Z.ai-specific request shaping (`tool_stream`, `thinking: {type, clear_thinking:false}`, `reasoning_effort`) and seven GLM models down to `glm-5.3`. The gap is not "GLM support"; it is that fifecode speaks only Z.ai's OpenAI-compatible surface, while ZCode treats the **Anthropic Messages** surface as the first-class one for the same API key, and adds a plan-aware model/effort catalog, a documented business-error table, and a thinking-signature repair path that fifecode has no equivalent of.

The honest verdict: **do not merge ZCode code.** Almost everything worth having is either (a) a wire fact that belongs in a catalog entry or a small compat flag, (b) a table of vendor error codes that can be reimplemented in an afternoon, or (c) Z.ai-account plumbing that only works because ZCode *is* Z.ai's client and must not be copied. Only two items plausibly need new first-party code in fifecode: the GLM-5.3 thinking pair (`type:"enabled"` + `output_config.effort`, which pi-ai cannot emit from configuration) and the Anthropic-wire repair layer (unsigned thinking signatures, bracket business codes in SSE text, context-window continuation).

Five findings that change decisions:

1. ZCode ships **two** Z.ai API surfaces for ordinary API keys — `zai-api` (Anthropic Messages at `https://api.z.ai/api/anthropic`) and `zai-standard-api` (OpenAI Chat Completions at `https://api.z.ai/api/paas/v4`) — and enables only `GLM-5.3` / `GLM-5.3-Flash` on each (`config/provider/zcode-builtin.json`, template rules). fifecode implements only the second.
2. On the Anthropic surface ZCode sends `thinking: {type:"enabled"}` plus `output_config.effort` for GLM-5.3, not a token budget (`zcode-builtin.json:2602-2611`). fifecode cannot emit that exact pair from configuration: pi-ai's only adaptive path hard-codes `type:"adaptive"` (`anthropic-messages.js:950-955`), and its non-adaptive path sends `budget_tokens` with no `output_config` (`:957-963`). This is the one wire mismatch that needs code.
3. ZCode's model catalog is a shipped JSON rule release with regex-precedence overlays (`revision: 33`, `config/provider/zcode-builtin.json:2`), not code. Its capability facts (context window, max output, reasoning levels, image/video/pdf) are directly transplantable as data.
4. ZCode classifies ~40 vendor business codes with per-code retryability (`apps/zcode-cli/packages/adapters/src/model/failure-provider-business-codes.ts:53-292`). fifecode's retry executor works on transport status and pi-ai error kinds, so a 200-with-business-error body or an `error` SSE chunk carrying code `1302` is currently indistinguishable from a generic failure.
5. There is **no GLM-specific prompt engineering** to steal: no system-prompt or tool-description string in ZCode branches on the model being GLM (confirmed by search across `apps/zcode-cli/packages/core/src`). The only tool-schema dialect in the repo is Moonshot's MFJS, which is `false` for every GLM model (`zcode-builtin.json:4087-4096`). What does exist is a set of GLM *wire* quirks (unsigned thinking signatures, bare `tool_result`, bracket business codes inside SSE text, context-window continuation) — those are the real remaining quality work, and they live in the adapter, not the prompt.

## 1. What fifecode already does

Established facts, so the plan does not rebuild them:

- Routes `zai` (`ZAI_API_KEY`, `https://api.z.ai/api/coding/paas/v4`) and `zai-coding-cn` (`ZAI_CODING_CN_API_KEY`, `https://open.bigmodel.cn/api/coding/paas/v4`) are registered from generated catalog data (`packages/llm/llm-pi-ai/src/provider-data.generated.ts:50-51`), and the user guide already tells people to pick `zai` for GLM (`docs/user/guide/providers.md:17`).
- The installed catalog carries `glm-4.7`, `glm-5-turbo`, `glm-5.2`, `glm-5.2-highspeed`, `glm-5.3`, `glm-5.3-flash`, `glm-5.3-highspeed`, each with cost, context window, and `compat: {thinkingFormat:"zai", zaiToolStream:true, maxTokensField:"max_tokens", supportsReasoningEffort: …}` (`node_modules/.pnpm/@earendil-works+pi-ai@1.1.0_*/node_modules/@earendil-works/pi-ai/dist/providers/data/zai.json`).
- Z.ai request shaping is implemented in pi-ai, not fifecode: `tool_stream: true` when tools exist (`dist/api/openai-completions.js:601-603`), and `thinking: {type: enabled|disabled, clear_thinking:false}` with optional `reasoning_effort` (`:620-630`). Z.ai is also auto-detected from the base URL, so a hand-declared BigModel route gets the same treatment (`:1223-1226`).
- Per-route `headers`, `compat`, `models`, `modelOverrides`, `reasoningEfforts`, `thinkingBudgets`, and `retryPolicy` are configuration surface (`packages/llm/llm-pi-ai/src/config.ts:121-156`, `docs/config-catalog.md:1890-1891`), so most ZCode behaviors are reachable without code.
- Retries are provider-owned and durable (`packages/llm/llm-retry`), reasoning effort has a policy service (`packages/llm/effort-policy`), and spend is metered per model (`packages/llm/token-meter`). ZCode has no equivalent of the effort policy or of cost accounting in its model path at all (its catalog is strict and has no price field).

## 2. How ZCode organizes its Z.ai layer

Its provider layer is a rule engine over one shipped JSON release, not TypeScript constants:

- `packages/provider/src/config/model-config.ts:387-423` overlays every matching rule in array order; later wins.
- Rule groups, lowest to highest precedence: `modelRules` (regex on model id) → `modelApiRules` (model + api type) → `providerSiteRules` (model + api + base URL) → `templateModelRules` (exact template + model) → `builtinProviderModelRules` / personal provider rules (exact provider + model).
- `modelMatch` is case-insensitive and anchored; `apiTypeMatch`/`baseUrlMatch` are case-sensitive (`model-config.ts:544-559`).
- The baseline is a `modelMatch: ".*"` catch-all (`zcode-builtin.json:932-964`): context 1,000,000, max output 128,000, `supportsToolCall: true`, everything else false. Unknown models are therefore executable-looking but not `enabled`, and resolution refuses them (`packages/provider/src/resolver.ts:278-280`).

This architecture is worth copying as a *concept* (data-driven capability overlays keyed by model and endpoint) but not as code: fifecode's equivalent seam is `providers.<route>.models` / `modelOverrides` / `compat`, which is already the same idea with less machinery.

## 3. The Z.ai endpoint and plan matrix (the core data)

From `config/provider/zcode-builtin.json` (providerRules) — every plan uses the Anthropic Messages wire:

| Provider id | Family | Access | Base URL | Models |
|---|---|---|---|---|
| `account:zai-individual-coding-plan` | zai | zhipu-account | `https://api.z.ai/api/anthropic` | GLM-5.3, GLM-5.3-Flash |
| `account:zai-team-coding-plan` | zai | zhipu-account | `https://api.z.ai/api/anthropic` | GLM-5.3, GLM-5.3-Flash |
| `account:zai-start-plan` | zai | zhipu-account | `https://zcode.z.ai/api/v1/zcode-plan/anthropic` | dynamic (account-supplied) |
| `account:zai-offpeak-idle-plan` | zai | zhipu-account | `https://zcode.z.ai/api/v1/off-peak/anthropic` | GLM-5.3, GLM-5.3-Flash (hidden) |
| `account:zai-highspeed-card` | zai | zhipu-account | `https://zcode.z.ai/api/v1/highspeed/anthropic` | GLM-5.3, GLM-5.3-Flash (hidden) |
| `account:bigmodel-*` (five mirrors) | bigmodel | zhipu-account | same paths on `open.bigmodel.cn` / `zcode.z.ai` | same |

Plus two API-key templates that matter most to a third-party harness:

| Template | API type | Base URL | Enabled members |
|---|---|---|---|
| `zai-api` / `bigmodel-api` | `anthropic-messages` | `https://api.z.ai/api/anthropic`, `https://open.bigmodel.cn/api/anthropic` | GLM-5.3, GLM-5.3-Flash |
| `zai-standard-api` / `bigmodel-standard-api` | `openai-chat-completions` | `https://api.z.ai/api/paas/v4`, `https://open.bigmodel.cn/api/paas/v4` | GLM-5.3, GLM-5.3-Flash (of 24 listed, the rest `enabled:false`) |

fifecode's `zai` route is the `zai-standard-api` row. The `zai-api` row is the part fifecode lacks, and it is the one ZCode treats as first-class for coding plans.

## 4. Wire comparison

| Dimension | fifecode today (`zai`, OpenAI wire) | ZCode coding-plan path (Anthropic wire) |
|---|---|---|
| Endpoint | `api.z.ai/api/coding/paas/v4` | `api.z.ai/api/anthropic` → `/v1/messages` |
| Auth | `Authorization: Bearer <key>` | Anthropic SDK `x-api-key` for API keys; account tokens additionally refreshed per attempt |
| Thinking | `thinking: {type:"enabled", clear_thinking:false}` + `reasoning_effort` | `thinking: {type:"enabled"}` + `output_config: {effort:"low"|"high"|"max"}` for GLM-5.3 (`zcode-builtin.json:2602-2611`); `disabled` only for GLM-5.2/Turbo families |
| Tool streaming | `tool_stream: true` in the body | `anthropic.eagerInputStreaming=false` on tool declarations (`tool-transform.ts:236-247`) |
| Mid-conversation system | Concatenated into the leading system prompt | Genuine `role:"system"` messages mid-history (`supportsMidConversationSystem: true` for every Z.ai Anthropic site) |
| Prompt cache | Provider-automatic, `cacheRead` priced | Explicit `cache_control: {type:"ephemeral"}` on the last non-system message when the call site opts in (`provider-request-messages.ts:84-89`) |
| Max output | `max_tokens` (catalog `maxTokens: 131072`) | `max_tokens` from the model rule (128,000 for 5.3) |
| Native web search | none | `web_search_20260209` tool when the model rule allows it (`tool-transform.ts:271-275`) |
| Errors | transport status + pi-ai error kind | ~40 vendor business codes plus status, classified for retryability |

The two surfaces are the same product; the Anthropic one is simply the richer contract. Nothing in the repository suggests the OpenAI path is deprecated — `zai-standard-api` still enables the same two models — so this is a "use the better wire", not a migration.

## 5. Model facts worth transplanting

Effective capabilities after ZCode's overlays. `ctx` and `maxTokens` are request budgets, not billing.

| Model | ctx | max out | reasoning levels | image | video | pdf |
|---|---|---|---|---|---|---|
| GLM-5.3 | 1,000,000 | 128,000 | low, high, max | yes (site rule) | yes (site rule) | no |
| GLM-5.3-Flash | 1,000,000 | 128,000 | low, high, max | yes | yes | yes |
| GLM-5.2 | 1,000,000 | 128,000 | disabled, high, max | yes | yes | no |
| GLM-5-Turbo | 200,000 | 64,000 | disabled, enabled | yes | yes | no |
| GLM-5V-Turbo | 200,000 | 131,072 | disabled, enabled | yes | yes | no |
| GLM-5.1 / 5.1-Highspeed | 200,000 | 64,000 | disabled, enabled | no | no | no |
| GLM-5 | 200,000 | 64,000 | disabled, enabled | no | no | no |
| GLM-4.7 / -FlashX / -Flash | 200,000 | 131,072 | disabled, enabled | no | no | no |
| GLM-4.6 | 200,000 | 131,072 | disabled, enabled | no | no | no |
| GLM-4.5 / -Air | 131,072 | 98,304 | disabled, enabled | no | no | no |
| GLM-4.6V / -Flash / -FlashX | 131,072 | 32,768 | disabled, enabled | yes | no | no |
| GLM-4.1V-Thinking-Flash / -FlashX | 65,536 | 32,768 | (none declared) | yes | no | no |
| GLM-4-FlashX-250414 / GLM-4-Flash-250414 | 131,072 | 16,384 | disabled, enabled | no | no | no |
| GLM-4V-Flash | 16,384 | 1,024 | (none declared) | yes | no | no |

Divergences from the installed pi-ai catalog worth reconciling:

- pi-ai declares `glm-5.3` max output `131072`; ZCode's rule says `128000`. ZCode's number is the vendor-documented budget; adopting it avoids a 400 at the cap.
- pi-ai's `glm-5.3-flash` already declares `input: ["text","image"]` and an image resize limit; ZCode additionally allows video and pdf on that one model.
- pi-ai has no `glm-5v-turbo`, `glm-5.1`, `glm-5`, `glm-4.6`, `glm-4.6v*`, `glm-4.5*`, or the `-flashx` variants. Whether to add them is a product call; ZCode disables everything except 5.3/5.3-Flash for API-key plans anyway.
- ZCode's default reasoning level is the **highest** advertised value (`values.at(-1)`, `model-selection-config.ts:65`), i.e. `max` for GLM-5.3. fifecode's effort policy starts at `standard`, which maps differently per route.

## 6. Error and retry semantics worth porting

`failure-provider-business-codes.ts` is the single most portable artifact in the repository: plain data plus a retryability decision, with comments tying codes to vendor documentation.

- Retryable: `500`, `1120`, `1230`, `1234` (wrapped network), `1302`, `1303`, `1305`, `1312`, `2007`, `3002`, `rate_limit_reached_error`, `rate_limit_error`, `engine_overloaded_error`, `overloaded_error`.
- Terminal rate limit (quota exhausted, concurrency cap, fair-use): `insufficient_quota`, `credit_balance_exhausted`, `*_spend_limit_exceeded`, `*_usage_limit_exceeded`, `2056`, `20097`, `1316`-`1321`, `3008`, `3009`, `3010`, `1304`, `1308`, `1310`, `1313`.
- Terminal invalid/auth: `1006` (provider not configured → auth refresh), `1005`, `3001`, `3006`, `3007`.
- Context exceeded: `1261`.
- `retry-after` is honored up to 5 minutes and overrides computed backoff (`runner-retry.ts:38-56`), with jitter at `0.5 + rand*0.5`.
- Off-peak adds a queue protocol: `429`/`3105` are "queued, keep waiting without consuming the attempt budget"; `400`/`3102` mark a stable failure (`offpeak-retry.ts`, `runner-stream.ts:711-768`). This is ZCode-server-specific and should not be ported.

fifecode's `dsh-llm-retry` classifies `QUOTA` vs `RATE_LIMIT` already, but from transport status and pi-ai error kinds. A Z.ai body carrying `{"error":{"code":1316,...}}` with HTTP 200, or an SSE `error` chunk, has no path into that classification today.

Also portable: thinking-signature repair. When a 400 names a thinking-block signature problem, ZCode strips signed reasoning blocks, substitutes a `[Thinking removed]` text block so the assistant turn is not empty, and retries once (`reasoning-history-normalization.ts:42-92`). fifecode validates replay metadata and omits unsupported signatures (`llm-pi-ai` README), but has no wire-level "400 signature rejected → repair and retry" path.

Two protocol details worth recording because they change what a port must send:

- **Auth is doubled, not chosen.** ZCode sends `x-api-key` (from the Anthropic SDK) *and* `Authorization: Bearer <key>` (`model-execution.ts:327-334,425-438`), skipping the Bearer header only when the profile already sets `Authorization`. This holds for both API-key and coding-plan access; the comment states Anthropic-compatible gateways read both. fifecode/pi-ai sends `x-api-key` only (`anthropic-messages.js:790-815`), which is very likely sufficient but is the first thing to probe.
- **Base URL normalization differs but lands on the same URL.** ZCode appends `/v1` because the AI SDK appends only `/messages` (`model-execution.ts:448-469`); pi-ai uses the official SDK, which appends `/v1/messages` itself. Configuring `https://api.z.ai/api/anthropic` in fifecode therefore produces `…/api/anthropic/v1/messages`, matching ZCode.

## 7. Prompts, tools, and GLM wire quirks

**Prompts: nothing to port.** No system-prompt or tool-description string branches on the model being GLM; the closest model-visible variance is capability-gated, not GLM-authored — `env-info.ts:93-95` ("You are powered by the model named …") and `media-policy.ts:57` (`[Media omitted from provider input …]`, driven by `supportsImage:false`).

**Tool schemas.** MFJS is **Moonshot Flavored JSON Schema**, not GLM: scoped to `kimi-k3` on `https://api.moonshot.cn/anthropic` (`zcode-builtin.json:4087-4096`, UI copy at `packages/ui/src/i18n/locales/en-US.ts:4400`), and it only hoists local `#/...` refs into `$defs/zcode_ref_N` (`tool-transform.ts:107-153`). Do not port it for GLM. `strict: true` is Anthropic-first-party only (`tool-transform.ts:86-94`, `isAnthropicFirstPartyModelId` in `strict-tool-schema.ts:50-52` matches `claude-*`), so GLM **never** receives strict schemas. fifecode's catalog sets `supportsStrictMode: true` on `zai` entries, which is more aggressive than ZCode and untested against the vendor.

**Real GLM wire quirks (the valuable part).** All verified in source:

| Quirk | What ZCode does | Citation |
|---|---|---|
| Anthropic-compatible services return `thinking` blocks without `signature` | Synthesizes a `signature_delta` SSE frame so the SDK accepts the block; in non-stream JSON, drops unsigned thinking blocks and keeps text/usage/stop_reason | `anthropic-stream-compat.ts:185-262` |
| Bare `tool_result` assistant blocks from BigModel | Dropped during stream normalization | `anthropic-stream-compat.ts:187-330` |
| Mid-conversation `system` messages with a single text block | Restores `content` to a plain string, because the AI SDK expands it to a block array | `anthropic-stream-compat.ts:59-79` |
| Business code embedded in SSE error text as `[1302][…][request_id]` | Parses it with `/^\[(\d{4})\](?=\[)/` and maps it to the failure table | `provider-finish-business-error.ts:6,178-185,248-252` |
| GLM returns `thinking:{type:"enabled"}` with no `budget_tokens` | Suppresses the SDK warning about the fallback budget | `apps/zcode-cli/packages/cli/src/runtime-warnings.ts:18-19` |
| `model_context_window_exceeded` finish reason | Treated as "continue", not an error | `core/src/runtime/methods/turn-output-token-continuation.ts:19-23,44-56` |
| Compact ends with `length` and empty text | Reclassified as context pressure rather than a bad summary | `core/src/runtime/methods/compact-active-helpers.ts:61-65` |
| `submit_result.result` arrives as a JSON *string* | One `JSON.parse` retry | `dynamic-workflow/src/engine/scheduler-submit.ts:57-92` |
| Non-stream JSON assistant `tool_result` for websearch | Forces streaming instead | `core/src/tool/handlers/websearch.ts:103-105` |
| Forced named `web_search` `tool_choice` rejected (code 1210) | Keeps `tool_choice` auto | `core/src/tool/handlers/websearch.ts:94-95` |

For fifecode the rows with real failure cost are the unsigned-thinking-block repair, the bracket business code inside SSE text, and the context-window-exceeded finish: pi-ai's Anthropic client validates `signature` on thinking blocks, `dsh-llm-retry` cannot see a code embedded in an SSE message, and a context-window finish currently ends the turn instead of continuing it.

## 8. Do not port

| Item | Why |
|---|---|
| Coding-plan OAuth and project-token exchange (`auth/coding-plan-api-key.ts:19,126`) | Depends on Z.ai account services (`api.z.ai/api/auth/z/login`, project-token client). Only ZCode's own client identity is authorized for it; a third-party harness should use a coding-plan API key. |
| Official gateway rewrite (`official-coding-plan-gateway.ts:8-11`) | Rewrites `api.z.ai/api/anthropic/v1/messages` → `/api/v1/ultra-zai/anthropic/v1/messages` on ZCode's own origin, preserving auth headers. This is ZCode telemetry/routing, disclosed in `NOTICE.md:39`, not an API contract. |
| Off-peak ticket queue, highspeed cards | Server-side plan features reachable only through `zcode.z.ai` proxy paths. |
| Provider runtime headers RPC (`provider-runtime-headers.ts`) | Desktop host supplies credentials per request; not reproducible outside their app. |
| Device/session identifiers on Anthropic calls (`NOTICE.md:36`) | ZCode client identity; sending them from fifecode would be impersonation. |
| Attribution header block | `User-Agent: ZCode/<version>`, `X-ZCode-App-Version`, `X-Title`, `X-Release-Channel`, `X-Client-Language`, `X-Client-Timezone`, `X-ZCode-Agent: glm`, `X-Platform`, `X-Os-Category`, `X-Os-Version`, `x-request-id`, `x-zcode-trace-id`, `x-session-id`, `x-query-id`, `x-zcode-session-type`, `x-zcode-query-source` (`bootstrap/src/model-config.ts:58-68`, `runtime-platform-headers.ts:10-12`, `runner-attribution.ts:17-52`). None is required by the API; several are telemetry. |
| Off-peak / highspeed auth headers | `X-Coding-Plan-Api-Key`, `X-Off-Peak-Ticket-ID`, `X-Bigmodel-Authorization`, `Bigmodel-Target-Type`, `Bigmodel-Organization`, `Bigmodel-Project`, `X-Highspeed-Card-ID` — all bound to ZCode's server-issued tickets (`services/src/session/offPeakRuntimeModel.ts:259-262`, `services/src/highspeed/highspeedCardService.ts:89-98`). |
| Brand, UI copy, icons, plugin marketplace | Product surface, and the license carve-out in `NOTICE.md:71-73` does not extend to third-party assets. |

## 9. Gap matrix

| # | Gap | Impact | Effort | Where it lands |
|---|---|---|---|---|
| 1 | No Anthropic-wire Z.ai route | Medium-high: unlocks explicit cache control and native search; mid-conversation system stays blocked by the compat gate (row 3) | S | `cordis.yml` route config; no code |
| 2 | Cannot emit ZCode's GLM-5.3 thinking pair (`type:"enabled"` + `output_config.effort`) | High on the Anthropic route: adaptive is the only path pi-ai offers, and ZCode avoids it for GLM | M | pi-ai compat field or first-party adapter |
| 3 | Mid-conversation system/effort/tool changes withheld from profile `compat` | Medium: system-prompt changes rewrite the cached prefix | M | `packages/llm/llm-pi-ai/src/catalog.ts` gate, or upstream pi-ai catalog entry |
| 4 | No vendor business-code classification | Medium-high: quota exhaustion looks like a generic failure; no fail-fast | M | `dsh-llm-retry` or adapter |
| 5 | No thinking-signature repair-and-retry | Low-medium: a stale signature fails the turn instead of degrading | S-M | adapter |
| 6 | Unsigned thinking blocks on the Anthropic wire | High *if* the vendor omits signatures: pi-ai's client schema-validates them and fails the response | M | adapter (synthesize/repair before parse) |
| 7 | SSE business codes (`[1302][…]`) invisible to retry | Medium: same class as 4, different encoding | S | adapter |
| 8 | Context-window-exceeded finish treated as an error | Low-medium: turn dies instead of continuing | S | agent loop / adapter finish mapping |
| 9 | Catalog drift (`131072` vs `128000`, missing models, video/pdf) | Low | S | `models` overrides |
| 10 | Default reasoning level differs (`max` in ZCode) | Low, product call | S | `reasoningEfforts` + effort policy base |
| 11 | Strict tool mode may exceed vendor support | Low, needs probe | S | `compat.supportsStrictMode` |

## 10. Integration plan

### Tier 0 — configuration only, after two probes

Add a second Z.ai route that speaks Anthropic Messages, keeping the existing `zai` route for the OpenAI surface:

```yaml
- name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      zai-anthropic:
        displayName: Z.ai GLM (Anthropic wire)
        apiKeyEnv: ZAI_API_KEY
        api: anthropic-messages
        baseURL: https://api.z.ai/api/anthropic
        models:
          - id: glm-5.3
            name: GLM-5.3
            contextWindow: 1000000
            maxTokens: 128000
            reasoningEfforts: { low: low, high: high, max: max }
          - id: glm-5.3-flash
            name: GLM-5.3-Flash
            contextWindow: 1000000
            maxTokens: 128000
            reasoningEfforts: { low: low, high: high, max: max }
```

Do not add `compat.forceAdaptiveThinking: true` blindly. It emits `thinking:{type:"adaptive"}`, which ZCode never sends to GLM; ZCode sends `type:"enabled"` with `output_config.effort` (`zcode-builtin.json:2602-2611`). Probe both payloads against the real endpoint before choosing:

1. `POST /v1/messages` with `thinking:{type:"adaptive"}` + `output_config:{effort:"high"}`.
2. `POST /v1/messages` with `thinking:{type:"enabled"}` + `output_config:{effort:"high"}`.

If (2) is the only accepted form — the likely outcome — Tier 0 buys the Anthropic route's cache-control and catalog shape but not ZCode's effort encoding, and gap 2 moves to Tier 2.

### Tier 1 — data and compat (small PR)

1. Correct `glm-5.3*` max output to 128,000 in the route config (or upstream in pi-ai), and add the video/pdf declarations ZCode carries for `glm-5.3-flash`.
2. Add the Z.ai business-code table to `dsh-llm-retry` as a provider-keyed classifier, covering both a JSON error body and the `[code][message][request_id]` form scraped from SSE text.
3. Teach the retry path the context-window-exceeded finish reason as "continue" rather than "fail" (ZCode's `turn-output-token-continuation` equivalent).
4. Add the 400-signature-repair-and-retry step if the vendor omits thinking signatures.
5. Record the decision in an Agent Note: OpenAI wire is the default, Anthropic wire is the opt-in for coding plans.

### Tier 2 — first-party adapter (only if Tier 1 proves insufficient)

A `dsh-llm-zai` package modelled on `dsh-llm-deepseek` would own the Anthropic wire directly and could then emit the GLM thinking pair, allow mid-conversation system messages and effort, place cache breakpoints deliberately, repair unsigned signatures, and classify business codes without fighting the pi-ai compat gate. That is the honest cost of "fully optimized"; it is roughly the size of the DeepSeek adapter (`packages/llm/llm-deepseek/src`, ~25 files), not a weekend patch.

### Upstream alternative

The cheapest path for gap 3 is a pi-ai catalog entry for the Z.ai Anthropic endpoints, because `supportsMidConvoSystemMessages` / `supportsMidConvoEffort` / `allowedFallbackModels` are `withhold` precisely so vendor facts live in the catalog, not in user config (`packages/llm/llm-pi-ai/src/catalog.ts:292-307`). Contributing that entry upstream fixes it for every pi-ai consumer and removes the need for Tier 2 on this point.

## 11. Open questions and probes

1. Does `https://api.z.ai/api/anthropic/v1/messages` accept a coding-plan API key as `x-api-key` alone? ZCode deliberately sends both `x-api-key` and `Authorization: Bearer` and comments that compatible gateways read both (`model-execution.ts:433`), so this is likely fine, but one probe decides whether Tier 0 needs an auth shim.
2. Does the endpoint accept `thinking:{type:"adaptive"}` at all, or only the `type:"enabled"` + `output_config.effort` pair ZCode sends to GLM-5.3? This decides whether Tier 0 is viable without code.
3. Does this plan's Anthropic surface emit `signature` on thinking blocks? ZCode's compat layer exists because some Anthropic-compatible services do not; if Z.ai is one of them, pi-ai will reject the response and gap 6 becomes mandatory, not optional.
4. ZCode's API-key Chat Completions template points at `https://api.z.ai/api/paas/v4`, while fifecode's `zai` route points at `https://api.z.ai/api/coding/paas/v4`. Both exist; which one does a coding-plan key belong to, and does either accept `output_config`-style effort?
5. What quota/rate headers does the coding plan return (`x-ratelimit-*`, vendor codes in `Retry-After`)? ZCode reads a separate quota API (`/api/monitor/usage/quota/limit`) rather than response headers.
6. Does the coding plan accept `glm-5.2` / `glm-5-turbo` on API-key access, or only through `zcode.z.ai` start-plan routing? ZCode's API-key templates list only the two 5.3 models.
7. Whether fifecode wants ZCode's `max` default effort or its own `standard` policy base — a product decision, not a vendor fact.

## Appendix: where to look in the ZCode clone

| Path | What it holds |
|---|---|
| `config/provider/zcode-builtin.json` | The shipped catalog: 10 account providers, 83 model rules, 73 api rules, 54 site rules, templates |
| `packages/provider/src/config/model-config.ts` | Rule resolution and precedence |
| `packages/provider/src/resolver.ts` | Executability/entitlement chain, provider and model ordering |
| `apps/zcode-cli/packages/adapters/src/model/runner*.ts` | Request assembly, retry, streaming, off-peak |
| `.../model/failure-provider-business-codes.ts` | Vendor code table (port this) |
| `.../model/reasoning-history-normalization.ts` | Signature rejection and replay cleanup |
| `.../model/anthropic-stream-compat.ts` | Unsigned thinking blocks, bare `tool_result`, mid-conversation system content |
| `.../model/provider-finish-business-error.ts` | Bracket business codes inside SSE text |
| `.../model/tool-transform.ts` | Tool schema transforms (MFJS is Kimi-only) |
| `packages/llm/llm-pi-ai` (fifecode) | Compat gate, profiles, catalog integration |
| `node_modules/.pnpm/@earendil-works+pi-ai@1.1.0_*/.../dist/api/openai-completions.js` | Actual Z.ai request shaping fifecode relies on |
