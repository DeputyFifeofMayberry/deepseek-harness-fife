# M5 Progress Ledger — Manual Selection

Status: **COMPLETE.** Picks reach the policy's durable base, the pending pick retires on its route, the projection version advanced, ACP records picks, and the upgrade guide exists.
Baseline: branch `master`, dirty working tree (fork work), 2026-10-21. No commit was created.

## Verified state at last execution

| Check | Result |
| --- | --- |
| `pnpm exec vitest run packages/api/session-controller packages/acp/acp packages/llm/effort-policy` | 1241 passed, 1 skipped (68 files); the single failure is the pre-existing Windows symlink `EPERM` |
| `pnpm run typecheck` | 5 passed, 0 failed |
| `pnpm run build` | 9 passed, 0 failed |
| `oxlint` on the three changed packages and both new specs | 0 warnings, 0 errors |
| `verify-upgrade-guides` | guides conform |
| `verify-translation-pairing` | clean for every file this change touched |
| `verify-md-links`, `verify-doc-budgets`, `verify-package-readme-limitations` | 2023 files resolve; 7 docs within ceiling; 345 READMEs conform |
| `gen-module-graph`, `gen-dependency-catalog`, `gen-doc-graphs` | regenerated |

## M5 done-when, case by case

| Plan requirement | Evidence |
| --- | --- |
| A pick of `off` stays `off` | `session-models.host.spec.ts`: the accepted `off` is recorded as an exact base and is never escalated; the ACP spec records an advertised non-level effort the same way |
| A level pick sets the base | `effort-policy.spec.ts` (ACP): `reasoning_effort: low` records `{ base: 'low' }` |
| The provider default clears the exact base | `session-models.host.spec.ts`: a pick with no effort records `{ base: 'standard' }`, which resolves to the route's own default |
| A stale acknowledgement cannot retire a newer pick | `agent.host.spec.ts`: a header at the pick's own position does not retire it, only a later one does |
| The pending pick retires on its route, not its effort | `session-models.host.spec.ts`: a header carrying a policy-chosen effort retires the pending pick, and a cold replay of the same two records reaches the same durable state |
| ACP resume keeps the base | `acp/tests/effort-policy.spec.ts`: pick, prompt, close, resume; the durable base and the resumed `reasoning_effort` option both still report the pick |
| The policy no longer fights a selection | the three cases above: the pick is recorded through `setBase`, so the next request follows the policy |
| Upgrade guide | `docs/upgrade-guide/v0.2.1-rc.2/effort-policy/guide.md` (and its pair) |

## Changes

1. **`session-controller/src/agent.ts`** — `InstalledSelection` gains `pickedAt`, and `consume` matches provider and model only, requiring the acknowledging header to follow the `model/selection` record. `selectForNextRequest` stores the record position from `append`. `index.ts` passes `event.seq`.
2. **`session-controller/src/model-selection-projection.ts`** — the fold retires `pending` when a header matches its provider and model; `stateVersion` 2 → 3 so older rows refold instead of seeding an effort-compare rule.
3. **`session-controller/src/commands.ts`** — after a successful selection, the accepted effort is recorded through `policy.setBase`. The *request's* field decides level versus exact, because `resolveCallConfig` materializes an adapter default the caller did not choose.
4. **`acp/src/model-control.ts`** — an optional `onSelected` callback fires after each accepted config mutation and never after a rejection.
5. **`acp/src/session.ts`** — `effortRecorder` wires that callback to `setBase` on the session's own Agent, composed lazily because `create` builds the control before the Agent exists.
6. **Dependencies** — `dsh-effort-policy` is a dev dependency of both packages, both tsconfigs reference the project, and each source carries a type-only import so `ctx.get('effortPolicy')` is typed instead of `any` (lint caught the missing import in ACP).
7. **Docs** — the upgrade guide pair, plus one sentence in each of the controller, ACP, and policy README pairs.

## Decisions taken during implementation

1. **Retirement matches the route, not the effort.** The pending pick is a statement about provider and model; the effort on a request now belongs to the policy. The record-position guard is what replaces the old effort comparison for the one case it covered: a header logged at or before the pick.
2. **The caller's field, not the resolved config, decides level versus exact.** `resolveCallConfig` fills in `defaultEffort`, so a picker choice of "provider default" and an explicit pick of that same effort are identical after resolution. `request.reasoningEffort` distinguishes them; the provider default becomes the `standard` level.
3. **A rejected ACP change reports nothing.** The recorder fires only after the mutation's validation and resolution succeed, so the durable base never records a change the client was told failed.
4. **ACP still does not append `model/selection`.** The effort survives resume through the policy record and the logged header; provider and model resume from the last logged request, as before. Recording a full selection event in ACP remains a separate change; the plan's M5 line asked only for `setBase`.

## Attribution of failures seen in this run (none caused by this change)

- `media-references.host.spec.ts`: creating a symlink raises `EPERM` on this host (Windows without the symlink privilege), the same environment limit recorded for `verify-node-next-types`.
- `verify-translation-pairing`: `docs/capability-seams.i18n.yaml`, `ui-price-phase`, `ui-schedule` (pre-existing).

## Next action

M6: enable both rows in the fork profile overlay together, add the in-tree fixture profile with a recorded scenario, and verify a real session records `low` and rises only after a failing check.
