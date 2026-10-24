# Plan Review Report — Effort-Policy Hardening and Token-Budget Tightening

## Verdict

**CONDITIONAL.** The plan is executable as written for W1, W4, W5, W6, and W7b; W2 and W7a carry explicit unverified assumptions (A1, A2) whose probes gate their final edits, and the live-profile value changes await user approval. No blocker prevents starting.

## Review scope and evidence

Tier: Standard, run as a single author-and-harden pass (CTO, senior-engineer, and pre-mortem lenses sequential; independence limitation: no fresh-context reviewer was used, so the final verification is the author's own second pass).

Inspected: working tree `master` as of 2026-10-22; `packages/llm/effort-policy` (src, config, tests inventory, README), `@mayberry/effort-policy-core` lib (`levels.js`, `policy.js`), `packages/compaction/compaction-basic/src/index.ts` and `config.ts`, `packages/compaction/compaction-tool-result-pruner/src/config.ts`, `packages/web/tool-web/src/index.ts` config schema, `packages/bundle/base/cordis.patch.yml`, `packages/bundle/web-app/cordis.patch.yml`, both profile patches (live home and dev home), `docs/upgrade-guide/v0.2.1-rc.2/`, the M6/M7 ledgers, and the 2026-10-22 feature-review session record.

Not available: measured cache-retention data for this machine (local session store is header-only), a fresh-context independent review, real `pnpm run test` summary output for pattern tuning.

## Findings

| ID | Severity | Evidence status | Finding | Evidence/reference | Resolution | State |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | High | Verified | Dev-home patch pins `reasoningEffort: high`, neutering the policy in that composition | Dev-home patch, `agent-default-model` row; `service.ts:385-392` | W1 removes the line | Resolved in plan |
| F-02 | Medium | Verified gap, selection unverified | Delegation flags cover `preset-standard` only; dev-home restates `preset-cordis` without them and `selectedDefault: cordis` there makes that the likely dev preset | Dev-home/live patches; `web-app/cordis.patch.yml:602-605` | W2 verifies selection, fixes dev-home restatement, records or fixes live | Resolved in plan (gate: A2) |
| F-03 | Low | Verified | Only typecheck escalates; test failures never raise effort | Live/dev patches, `effort-policy` row | W3 adds the verifier with drafted patterns to tune | Resolved in plan |
| F-04 | Low | Verified | Required-on-read `effort/decision` event refuses older builds on enabled sessions | `docs/upgrade-guide/v0.2.1-rc.2/effort-policy/` exists; M7 ledger | W4 verifies both documents state it; conditional two-sentence edit | Resolved in plan |
| F-05a | Low | Verified | No-op `agent/request-error` passthrough listener misleads readers | `service.ts:175` | W5 deletes it and updates tests | Resolved in plan |
| F-05b | Low | Verified | `@mayberry/effort-policy-core` npm release outstanding (account suspension) | M7 ledger | W5 records the pending switch in the README; execution deferred | Risk accepted |
| I-01 | High | Verified | Compaction waits for ~678k tokens; warm-history resend at 1M-window scale dominates input cost | `compaction-basic/src/config.ts:20`; base bundle row; token-anatomy audit | W6 sets `thresholdRatio: 0.4`, `retainRatio: 0.12` in user profiles | Resolved in plan (approval gate) |
| I-02 | Medium | Verified | Fat inline results persist for the session: spill 12,500 tokens, fetch 200,000 chars, pruning only near pressure | `base/cordis.patch.yml:423-426`; `tool-web/src/index.ts:34`; `compaction-basic/src/index.ts:160-176` | W7a/b config now; W7c default-off step-boundary pruner, new-nodes-only | Resolved in plan (A1 gate, approval gate) |
| I-03 | Medium | Unverified | Bundle-level `spill-policy` may not see preset-isolated agents, in which case today's sessions have no spill at all | Absent from preset restatement; effort-policy needed per-agent attach for a similar seam | W7a probes first; fallback restates spill-policy in the preset | Open (gates W7a) |
| R-01 | Medium | Likely | Step-boundary pruning of old, cached nodes would break provider prefixes and could raise cost | Pre-mortem: prefix-cache mechanics from the 2026-10-22 audit | W7c constrained to new-nodes-only, stated as a design invariant | Resolved in plan |

## Traceability and verification

Every requested item maps to at least one milestone and one acceptance check: F1→W1, F2→W2, F3→W3, F4→W4, F5→W5, Idea 1→W6, Idea 2→W7a/b/c, each with a done-when in section 4 and an observable criterion in section 7. In-repo changes carry suite, typecheck, lint, snapshot-unchanged, doc-sync, and build gates. Profile changes carry dump-config composition plus one real-session behavioral check each.

Independent review was not performed; the author's second pass checked requirement coverage, evidence citations, sequencing, and rollback. A fresh-context review is recommended before W7c lands upstream.

## Open decisions and residual risks

- Approve the live-profile and dev-home value changes (W1, W2, W3, W6, W7a, W7b): owner, user.
- A1/A2 probes must run before W7a/W2 finalize their edits: owner, implementing agent.
- Summarization-cadence quality tradeoff at `thresholdRatio: 0.4`: owner, user, judged over a week of real use.
- npm registration restore: external, owner user; plan only records the pending switch.

## Review limitations

No fresh-context reviewer; no measured cache-retention or token-volume data from this machine's sessions (store header-only); `pnpm run test` output not sampled, so the W3 regexes are labeled drafts; spill coverage inside preset realms asserted by neither source nor test, hence A1.
