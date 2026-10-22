# M4 Progress Ledger — Delegation

Status: **COMPLETE.** The flag, the three model-facing fields, the child fields, the policy's start levels, and the inheritance switch are implemented, tested, and documented.
Baseline: branch `master`, dirty working tree (fork work), 2026-10-21. No commit was created.

## Verified state at last execution

| Check | Result |
| --- | --- |
| `pnpm exec vitest run packages/subagent/tool-subagent packages/subagent/subagent packages/llm/effort-policy packages/compaction/compaction-basic` | 1157 passed, 1 skipped (62 files) before the last policy test; `runtime-integration` alone is 10 passed |
| `pnpm run typecheck` | 5 passed, 0 failed |
| `pnpm run build` | 9 passed, 0 failed |
| `oxlint` on the three changed packages | 0 warnings, 0 errors |
| `verify-config-catalog`, `verify-module-graph`, `verify-dependency-catalog`, `verify-tool-catalog`, `verify-doc-graphs` | all up to date after regeneration |
| `verify-package-readme-*` | summaries and limitations conform; Model Experience fails only on the pre-existing `ui-price-phase` |
| `verify-translation-pairing` | clean for every file this change touched |
| `verify-no-unknown-casts`, `verify-package-dependencies` | clean for this change |

## M4 done-when, case by case

| Plan requirement | Evidence |
| --- | --- |
| Flag on + policy active: fields appear and the child is stamped | `tool-subagent/tests/effort-policy.spec.ts` (`operation: plan` stamps `effortOperation: 'plan'`, `effortInherited: false`) |
| Flag on + service absent: fail loud naming both rows | same spec, message contains `effortPolicy: true` and `enabled: true` |
| Flag on + service disabled: same failure | same spec, message contains `disabled` |
| Flag off: schema unchanged, child fields absent, children at today's effort | same spec, two cases (`with` policy and `without`) |
| Operation minimums and overrides | same spec (`plan` + `reasoning_effort: low` rejected naming `deep`; `mechanical` + `low` accepted) plus `meetsOperationMinimum` in the policy |
| `mechanical` requires verification | same spec (missing → rejected, blank → rejected, provided → accepted) |
| Child starts at its operation | `effort-policy/tests/runtime-integration.spec.ts` (`plan` → `max`, `mechanical` → `low` through the real loop) |
| Explicit delegation effort wins | same spec (child with `reasoningEffort: low` and `effortOperation: plan` requests `low`) |
| Parent-child isolation | same spec (an escalated parent's child starts at its own `high`, keeps no open failure, and the parent stays at `max`) |
| `inherit_effort` semantics | `subagent/tests/child-agent.spec.ts`: `effortInherited: false` drops the inherited effort, an explicit effort survives either value, `true` keeps the inherited one |
| Cold-resumed child starts at the configured base | documented limitation in both READMEs; the descriptor carries no operation, so `startFor` finds none |

## Decisions taken during implementation

1. **The policy owns the operation table; the tool never re-derives it.** `AgentOptions.effortOperation` and `effortInherited` are declared in a new `src/agent-options.ts` of the policy package, so a host that composes the policy gets the fields and one that does not is unaffected. The tool, the subagent manager, and the policy each carry only a type-only import of that declaration.
2. **A declared effort is resolved once, in the policy.** `applyTo(session, proposed, start?)` takes the Agent's declared start; `decide` then runs on `record.base ?? start.level ?? configured base`, and a non-level declared effort becomes `exact`. This is what keeps a delegation's `reasoning_effort` from being overwritten by the configured base, which the M3 listener would otherwise have done.
3. **The operation minimum constrains level names only.** `meetsOperationMinimum` rejects `low`/`standard`/`deep` below the operation start and passes any other advertised effort through as the caller's exact choice, because only the adapter knows how an arbitrary effort id ranks. Rejecting is the tool's job; the policy supplies the rule.
4. **`verification` is validation-only.** `mechanical` cannot be requested without naming the check, and the value is not forwarded to the child; the README says so.
5. **`record()` no longer defaults the base.** Returning the recorded state verbatim is what lets a declared start outrank the configured base while a recorded pick still outranks both. `stateOf`, `applyTo`, and `observe` were updated around it.
6. **A cold-resumed child starts at the configured base, not literally `standard`.** The plan said `standard`; the shipped default is `standard`, but a deployment whose base is `low` gets `low`. The READMEs state the configured-base rule rather than a value.

## Repository cleanup performed

- A raw `tsc -b tsconfig.host.json` invocation had emitted 40 generated `.js`/`.d.ts`/map files into `packages/llm/effort-policy/src`, which then failed `oxlint`. `pnpm run typecheck` does not recreate them; the residue was removed and the sanctioned driver confirmed clean. Use `pnpm run typecheck`, never a raw `tsc -b` on the aggregate.
- Earlier residue under `packages/core/tools/src` and `packages/core/agent-loop/src` was removed in the M3 pass.

## Attribution of failures seen in this run (none caused by this change)

- `verify-no-unknown-casts`: `apps/desktop/tests/activity-attention.spec.ts` (pre-existing).
- `verify-package-dependencies`: `packages/client/ui-price-phase` (pre-existing).
- `verify-translation-pairing`: `docs/capability-seams.i18n.yaml`, `ui-price-phase`, `ui-schedule` (pre-existing).
- `verify-package-readme-model-experience`: `ui-price-phase` (pre-existing).

## Deferred to M6 and beyond

- Both `tool-subagent` rows in `packages/bundle/base` keep `effortPolicy` defaulted off; M6 turns them on with the fork overlay.
- The enabled composition still has no recorded-session snapshot; M6 adds the profile fixture.
- SDK catalogs and expected outputs were not regenerated for the new `AgentOptions` fields; no event or wire shape changed.

## Next action

M5: retire picks on provider/model acknowledgement, call `setBase` from the controller and ACP, bump the model-selection projection version, and add the upgrade guide.
