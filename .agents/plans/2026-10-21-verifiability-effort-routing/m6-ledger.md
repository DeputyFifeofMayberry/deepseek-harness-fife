# M6 Progress Ledger — Fork Enablement

Status: **COMPLETE.** The fork profiles enable the policy and both delegation row families, an in-tree fixture gates the composition through the shipped headless profile, and a real session records `low`, rises on a real failing `pnpm run typecheck`, and returns only after that check passes.
Baseline: branch `master`, dirty working tree (fork work), 2026-10-21. No commit was created. No `DEEPSEEK_API_KEY` is available in this environment, so the model in every executed session is the keyless test adapter; the rest of each run is the product path.

## Verified state at last execution

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | 5 passed, 0 failed, 0 skipped |
| `pnpm exec vitest run packages/llm/effort-policy packages/subagent/tool-subagent packages/subagent/subagent packages/acp/acp packages/api/session-controller packages/compaction/compaction-basic` | 2300 passed, 2 skipped, 1 failed — the pre-existing Windows symlink `EPERM` in `media-references.host.spec.ts` |
| `pnpm exec vitest run packages/llm/effort-policy` | 102 passed (13 files) |
| `pnpm vitest run --config vitest.expected.config.ts apps/cli/tests/profiles/effort-policy/...` | 1 passed; a negative control with `ignoredArgumentKeys: []` fails on the uncleared escalation |
| `oxlint` on the policy package, the profile fixture, and the M6 evidence scripts | 0 warnings, 0 errors |
| `pnpm run verify-config-catalog`, `verify-doc-budgets`, `verify-upgrade-guides`, `verify-md-links`, `verify-export-jsdoc` | all pass |
| `verify-translation-pairing` for the two touched pairs | consistent; the corpus-wide run still reports the three pre-existing unrelated pairs |
| `dsh --profile web --dump-config` (`DSH_HOME=%USERPROFILE%\.dsh`) | composes `effort-policy` with `enabled: true`/`baseLevel: low` and both delegation rows inside `preset-standard` with `effortPolicy: true` |
| `loadOverlayPatches` over all three edited profile overlays | every row parses; each carries the policy row, both host delegation rows, and the restated preset with both flags |

## M6 done-when, case by case

| Plan requirement | Evidence |
| --- | --- |
| The fixture scenario passes | `apps/cli/tests/profiles/effort-policy/` boots the shipped headless profile with the fork's rows, runs the configured check, repairs the workspace with `write`, and re-runs it: request efforts `low → high → low`, decisions `escalated → base`, and the final text `CHECK_CLEARED` |
| A real session records `low` | Real-run transcript below: first `request/header` carries `reasoningEffort: low` with `adapterDefaults.reasoningEffort` absent, so the policy wrote it |
| It rises on a broken typecheck | The planted probe makes the real `pnpm run typecheck` print `run-gates: 1 passed, 1 failed, 3 skipped`; the next request carries `high` with `adapterDefaults.reasoningEffort: true` |
| It returns only after that check passes | The failing decision records the open failure with identity `pwsh \| {"command":"pnpm run typecheck"} \| Y:\deepseek-harness_fife\`; the `Remove-Item` mutation does not clear it; only the passing re-run appends `rule: base` with no open failure, and the following request is `low` again |
| Upstream keeps its defaults | `packages/bundle/base/cordis.patch.yml` still mounts `effort-policy` disabled, and the two `tool-subagent` rows still default `effortPolicy: false` |

## Real-session transcript

Composition: the shipped headless profile plus the fork's verifier rows, the `real-check-agent` fixture (root Agent, `cwd` = this repository), and a scripted model. Command: `pnpm tsx .agents/plans/2026-10-21-verifiability-effort-routing/m6-real-session/run.ts` with `TSX_TSCONFIG_PATH=tsconfig.json`. The probe is written before the run and removed by the script afterwards.

```text
requests: real-check/real-check effort=low adapterDefault=false
          real-check/real-check effort=high adapterDefault=true
          real-check/real-check effort=low adapterDefault=false
decisions:
          escalated base=low open=yes(pwsh | {"command":"pnpm run typecheck"} | Y:\deepseek-harness_fife\)
          base base=low open=none
tool calls:
          pwsh: pnpm run typecheck
          pwsh: Remove-Item -Force 'packages/llm/effort-policy/src/__m6-real-session-probe.ts'
          pwsh: pnpm run typecheck
results:
          ok: run-gates: PASS Host Typert (4.34s) | run-gates: 1 passed, 1 failed, 3 skipped in 4.35s.
          ok: (no output)
          ok: run-gates: start client aggregate check | run-gates: PASS client aggregate check (3.63s) |
              run-gates: 5 passed, 0 failed, 0 skipped in 8.62s.
final output: REAL_CHECK_CLEARED
```

## Changes

**Product code**

1. **`packages/llm/effort-policy/src/config.ts`** — `ignoredArgumentKeys` (default `['description']`) joins the validated configuration, with JSDoc that states the contract.
2. **`packages/llm/effort-policy/src/service.ts`** — `argumentsTextOf` removes those keys before the classifier and the identity see the call, so a retitled check keeps one identity.
3. **`packages/llm/effort-policy/src/evidence.ts`** — the `ToolOutcome.argumentsText` contract now states that presentation keys are already removed.
4. **`packages/llm/effort-policy/README.md`** (and pair) — evidence identity documents the removal and why.
5. **`docs/upgrade-guide/v0.2.1-rc.2/effort-policy/guide.md`** (and pair) — the new field, its default, and the preset caveat under migration.
6. **Config literals in four consuming specs** — `acp/tests/effort-policy.spec.ts`, `api/session-controller/tests/session-models.host.spec.ts`, `subagent/tool-subagent/tests/effort-policy.spec.ts`, and two inline literals in `compaction/compaction-basic/tests/compaction-basic.spec.ts` restate the new required field.
7. **`packages/llm/effort-policy/tests/integration.spec.ts`** — two cases: retitling clears the escalation, and a title that names the command does not become the command.

**In-tree gate**

8. **`apps/cli/tests/profiles/effort-policy/effort-policy.patch.yml`** — the fork's three rows plus fixture isolation (no startup task, no title request, replayed provider, local session root).
9. **`.../fixtures/effort-policy-mock-llm.ts`** — keyless script: check, `write`, retitled check.
10. **`.../fixtures/effort-policy-agent.ts`** — creates the one root Agent on the default selection.
11. **`.../effort-policy.expected.e2e.ts`** — the assertions above.

**Fork profiles (outside the repository)**

12. `~/.dsh/profiles/desktop/cordis.patch.yml`, `~/.dsh/profiles/web/cordis.patch.yml`, and `<repo>/apps/desktop/.desktop-build/development/home/profiles/desktop/cordis.patch.yml` now carry: the `effort-policy` row (`enabled: true`, `baseLevel: low`, two verifier rules for the platform shell tools, two read-only patterns), both host `tool-subagent` rows with `effortPolicy: true`, and a `preset-standard` row that restates the standard preset's plugin list with the same flag on its two delegation rows. `agent-default-model` in all three no longer names `reasoningEffort`.

**Evidence scripts**

13. `.agents/plans/2026-10-21-verifiability-effort-routing/m6-real-session/{run.ts,real-session.patch.yml,real-check-agent.ts,real-check-llm.ts,check-overlays.ts,preset-standard.block.yml}` — the real-session driver, its composition, and the overlay parse check.

## Decisions taken during implementation

1. **Presentation arguments leave the identity.** The plan's identity is `tool + arguments + working directory`. A real agent retitles `pnpm run typecheck` on every call, so with the raw JSON included the escalation could never clear — the M6 criterion is unreachable and the feature would be inert in practice. `ignoredArgumentKeys` defaults to `description`, the one required field the shell tools document as a UI label, and the removal happens once, before matching and identity. A negative control proves the fixture depends on it.
2. **The in-tree fixture seeds a stand-in check.** Running the repository's own `pnpm run typecheck` twice inside a committed test would cost minutes and break on cold CI. The fixture seeds a `typecheck` script in its temporary workspace that prints the real contract text (`run-gates: N passed, 0 failed` / `error TS####`), so the composition, the shell, the policy, and the verifier patterns are the fork's; only the check's body is local. The real command is exercised in the manual proof above.
3. **The desktop app needed the preset restated.** `dsh-web-app` disables the host `tool-subagent` rows and mounts both inside `preset-standard`; a patch replaces a row's whole config and `applyEntryPatches` does not descend into a preset's `config.plugins` (a `preset:` patch row is warned and skipped — verified). The owner chose restating the preset over leaving desktop delegations without operation fields. The restated block is copied verbatim from `--profile web --dump-config` and carries a comment naming that refresh path.
4. **`agent-default-model` stops naming an effort.** A configured Agent effort reaches the policy as an exact start that never escalates, so `reasoningEffort: max`/`high` in these profiles would have pinned every session and defeated the feature. The policy now owns the base; the model picker still writes an exact base when the user picks one.
5. **`human` deployment choices stay configuration.** The verifier rules name the shell tool for both platforms because the base bundle mounts exactly one of `tool-bash`/`tool-pwsh` per platform; `readOnlyCommands` keeps only unambiguous inspection patterns, since a mutation counter that misses one costs nothing while a real mutation read as read-only would preserve stale evidence.

## Remaining and unverified

- **No live-model session.** No `DEEPSEEK_API_KEY` exists here and the account provider was not used, so the model in both executed sessions is the keyless adapter. Everything model-independent (composition, shell, policy, session log, verifier matching) is real.
- **The copied preset does not track upstream.** After an upstream merge that changes `packages/bundle/web-app/presets/standard.patch.yml` or later patches to `preset-standard`, the restated row must be refreshed from the dump. Dropping the row falls back to the bundle's definition, which loses the two flags.
- **PTC mode keeps its own preset.** `preset-ptc` also mounts a delegation group and was not restated, so delegations made under `DSH_TOOLS_MODE=ptc` have no operation fields. The native path is the fork's default.
- **A pre-existing dead row.** The installed `web` overlay's `- id: terminal-bash` does not match any row in that composition (`patch: entry "terminal-bash" not found`), so its shell settings never applied. It predates this change and was left in place.
