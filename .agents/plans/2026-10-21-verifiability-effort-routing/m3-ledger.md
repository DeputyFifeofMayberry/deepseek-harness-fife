# M3 Progress Ledger — Verifiability-Based Effort Routing

Status: **COMPLETE.** Option A was chosen for the route-swap clause and is implemented, tested, and documented.
Baseline: branch `master`, dirty working tree (fork work), 2026-10-21. No commit was created.

## Verified state at last execution

| Check | Result |
| --- | --- |
| `pnpm exec vitest run packages/core/agent-loop packages/llm/effort-policy packages/compaction/compaction-basic packages/llm/llm` | 2083 passed, 1 skipped (103 files) |
| `pnpm run typecheck` | 5 passed, 0 failed |
| `pnpm run build` | 9 passed, 0 failed (artifacts + consumer check) |
| `pnpm exec tsx scripts/run-oxlint.ts packages/core/agent-loop packages/llm/effort-policy` | 0 warnings, 0 errors |
| `pnpm run verify-runtime-closure` | closed graph, 186 packages |
| `pnpm run verify-persistence-changes` | 66 roots match 17 history records |
| `pnpm run verify-md-links` | 2021 files, all links resolve |
| `pnpm run verify-doc-budgets` | 7 budgeted docs within ceiling |
| `pnpm run verify-package-readme-summaries` | 398 Summaries within budget |
| `pnpm run verify-translation-pairing` | clean for every file this change touched |
| `pnpm run verify-no-unknown-casts` | clean for this change |

## Option A: the route swap now falls back

`ReactLoopAgent.prepareRequest` handles `UNSUPPORTED_REASONING_EFFORT` from `prepareCall` the way it already handled `NO_ADAPTER`: the effort is removed, the request is bound again at the route's own default, and the drop is logged at warning level naming the agent, effort, and route. The logged `request/header` therefore records what was dispatched. Every other `LlmError` still fails the turn.

Coverage:

- `packages/core/agent-loop/tests/effort-fallback.spec.ts` — unsupported effort dropped and rebound (`max` → route default `low`), supported effort preserved, route without reasoning metadata dispatched with no effort, and an unrelated `LlmError` still failing the turn.
- `packages/llm/effort-policy/tests/runtime-integration.spec.ts` — the policy writes `max` from a route that advertises it, the loop's bind resolves a shrunken route, and the turn completes at `high` with the header recording `high`.
- Documentation: `docs/architecture.md` (turn-flow map), the loop README pair, and the policy README limitation pair.

## M3 done-when, case by case

| Plan requirement | Evidence |
| --- | --- |
| Escalation raises, records one transition, survives a turn boundary | `runtime-integration.spec.ts`, `loader-composition.spec.ts` (real Loader boot, `high → max` on the continuation) |
| Infrastructure classification | `evidence.spec.ts` (text-verifier error, cancellation, configured category), `integration.spec.ts` (cancelled verification keeps the escalation) |
| Stale evidence: before failure, other command, other verifier, other directory | `loop-policy.spec.ts` (four cases) |
| Revision guard | `policy.spec.ts` (same/newer revision clears, older revision does not) |
| Per-Session isolation, workspace-scoped revision | `integration.spec.ts`, `loop-policy.spec.ts` (child edits advance the parent counter) |
| Resume | `projection-resume.spec.ts` (JSONL round trip through a fresh Context) |
| Resume after compaction | `projection-resume.spec.ts` (surface replacement keeps the escalation) |
| Decode failure | `projection-resume.spec.ts` (unreadable record refused; retained last level) |
| Mount / unmount / remount, dependency replacement, Agent disposal, pending teardown | `lifecycle.spec.ts` (5 cases) |
| Route swapped between resolution and dispatch | `effort-fallback.spec.ts`, `runtime-integration.spec.ts` (shrunken route) |
| Capability-lookup cost (F14) | `runtime-integration.spec.ts`: 2 `resolveModel` calls per request when enabled, 1 when disabled |
| Product composition through the Loader | `loader-composition.spec.ts` (enabled escalation path, disabled inert path) |
| Persistence acknowledgement and catalogs | `docs/persistence-changes/2026-10-21-effort-decision/` |

## Decisions taken during implementation (deviations, with reason)

1. **Evidence identity includes the working directory.** `verifierIdentity` is `tool`, exact arguments, and the directory the call ran in (the call's `workdir`, else the Session's `cwd`). Without it a pass in another directory cleared a failure, which the plan forbids.
2. **Infrastructure codes narrow the error-signalled verdict.** Cancellation (`ABORTED`, `ABORTED_BEFORE_DISPATCH`) is always infrastructure; another code is infrastructure only when the deployment lists it in `infrastructureFailureCodes`. The note previously said an unknown code is infrastructure, which made the configuration unobservable because every unlisted code would already be infrastructure. The note and its Chinese pair were corrected.
3. **An unreadable record retains, and then refuses.** Retaining the last successfully read state is implemented; the plan's "appends the uncertainty" row is not, because the frozen rule vocabulary has no value meaning "unreadable" and adding one is a protocol change for the Mayberry boundary. With nothing retained the request fails loud instead of guessing base.
4. **Listener ownership needs no generation token.** Withdrawing a service the loop injects drains every Agent it created (`ctx.agents.list()` is empty afterwards), and one service instance owns exactly one injection child, so two policy generations cannot overlap. `attached` stays a `Map<Agent, disposer>`.
5. **`EffortPolicyUnavailableError` is exported** from the package entry: it is the error a caller sees when the durable record cannot be read.
6. **Dependencies declared properly.** `dsh-llm` was a runtime import without a peer row; it is now a peer and dev dependency. The Loader, loop, prompt, and JSONL persistence packages the tests compose are dev dependencies, and `@deepseek-ai/dsh-effort-policy` joined the Python SDK runtime closure that `compaction-basic` now requires.

## Repository cleanup performed

Twenty compiled `.js`/`.js.map` files sat inside `packages/core/tools/src` and `packages/core/agent-loop/src` (written 12:50 local, untracked, predating this change). They are source-plane residue that made two agent-loop specs fail (`coverage-edges`, `scope-lifecycle`); removing them restored 453 passing tests in that package. Do not emit package builds into `src`: use `pnpm run typecheck`, never `tsc -b` on a package tsconfig.

## Attribution of failures seen in this run (none caused by this change)

- `pnpm run test:snapshot`: 161 failed / 25 passed / 27 skipped. The examined scenario (`replays compaction-recovery through dsh`) differs only in `{{cwd}}` substitution and a message-id ordinal; its diff contains no effort record, it fails identically with the `effort-policy` row `disabled: true`, and it still contains no effort record after the route-swap change. The working tree carries unrelated modified files.
- `pnpm run verify-node-next-types`: directory symlinks raise `EPERM` on this host before `tsc` runs (Windows without symlink privilege). Re-checked the new package's two public specifiers with directory junctions instead: `tsc` exits 0 under `moduleResolution: NodeNext`.
- `pnpm run rescope-vendor:check` fails on a missing `packages/client/ui-primitives/src/FishLogo.tsx`; `constraints` and `verify-package-dependencies` fail on `packages/client/ui-price-phase`; `verify-cordis-config` fails on `apps/cli/tests/profiles/acp/cordis.yml`; `verify-package-readme-model-experience` and `doc-standard.spec.ts` fail on `ui-price-phase`; `verify-translation-pairing` fails on `docs/capability-seams.i18n.yaml` and `packages/client/ui-schedule`. All are unrelated to this change.

## Deferred beyond M3

- Keyless recorded session and the TypeScript/Python SDK expected outputs; no event shape changed since the acknowledgement, but neither was regenerated or replayed here.
- Loader fixture profile for the enabled path (`apps/cli/tests/profiles/`), which belongs with M6.
- M4 may now start: delegation fields, the four flag/service combinations, and the operation minimums.
