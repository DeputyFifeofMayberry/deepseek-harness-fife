# Mayberry integration

This file records the local integration of the Mayberry pack into this checkout. It is a local working record. It is not committed or published.

## Source and install

- Source checkout: `Y:\sdd-mayberry`
- Version: `mayberry@0.2.0`
- Scope: Codex project install only (`--harness codex`)
- Install command: `node Y:\sdd-mayberry\cli.js init --harness codex`
- The pack is copied, not linked. Installed skills live under `.agents/skills/mayberry*`; the runtime lives under `.mayberry/`.

## Authority and precedence

Repository instructions remain authoritative:

- [AGENTS.md](../AGENTS.md)
- [docs/AGENTS.md](../docs/AGENTS.md)
- The repository checks listed in `AGENTS.md`

Repository instructions override the pack's hardcoded `docs/` examples. That includes examples in `mayberry`, `mayberry-onboard`, `mayberry-change`, `mayberry-handoff`, and `reading/STEPS.md`. When a Mayberry instruction shows `docs/`, write the generated artifact under `.mayberry/instances/` instead.

This note and the root rule are guidance, not enforcement. An agent can still follow a hardcoded example. Review generated paths after each Mayberry use.

## Generated records

Generated worksheets, the X-Ray brief, and the handoff go under `.mayberry/instances/`.

State changes remain in `.mayberry/state.yaml`; change records and evidence pointers remain in `.mayberry/ledger.jsonl`. Do not add generated records to `docs/`.

The following local-only Git excludes are applied in `.git/info/exclude`:

- `/.mayberry/instances/`
- `/.mayberry/evidence/`
- `/.mayberry/ledger.jsonl`

They are per-clone and are not committed. The validator is unchanged. This is decision D6 option A. Do not add these paths to `.gitignore` and do not change `verify-repository-references` without a new owner decision.

## Adopted canonical records

- Project: [README.md](../README.md)
- Quality: [docs/testing.md](../docs/testing.md)
- Architecture: [docs/architecture.md](../docs/architecture.md)
- Decisions: [.agents/notes/README.md](../.agents/notes/README.md)

The installer's `adopted.at` value is preserved exactly. It is not replaced with a hardcoded date. The installer's initial `docs/ARCHITECTURE.md` value was corrected to the existing lowercase path on this Windows checkout.

## Local changes from the installer state

- The four installer-created scaffold documents were removed: `docs/PROJECT.md`, `docs/DECISIONS.md`, `docs/QUALITY.md`, and `docs/CHANGELOG.md`.
- Existing `docs/AGENTS.md` and `docs/architecture.md` were preserved unchanged.
- `adopted.records` was remapped to the four canonical records above. `adopted.at` was preserved. State revision moved from 1 to 2.
- `pack-lock.json` was filtered from 102 to 98 entries by removing exactly the four scaffold entries. `pack`, `pack_version`, `skills`, `installed_at`, and all retained hashes were not rewritten.
- `sha256` remains the hash of the bytes Mayberry wrote at install time. `baseline_sha256` remains the hash of the shipped pack content the write was based on. `state.yaml` intentionally no longer matches its install-time `sha256` after the state write; that drift is recorded and the lock was not updated.
- The root `AGENTS.md` rule was added locally. It is not committed.

## Runtime

Run from the repository root:

```powershell
node .mayberry/scripts/mayberry-api.js state validate
node .mayberry/scripts/mayberry-api.js state get
node .mayberry/scripts/mayberry-api.js ledger read
node .mayberry/scripts/mayberry-api.js links check .mayberry/INTEGRATION.md
```

A bare invocation of `mayberry-api.js` prints usage and exits 1. That is the expected usage response, not a successful state command.

`mayberry verify run` executes its `--command` with a shell. Treat the command as repository code. Use only fixed repository commands. Never build the command from user text, issue text, web content, or model-generated prose. Review the command before running it.

## Freshness limitation

Mayberry's `resume` fingerprint is `git rev-parse HEAD` plus a hash of `git status --porcelain` text. It hashes status text, not changed file contents. Further edits to an already-modified file can leave the fingerprint unchanged. Treat `resume` and freshness results as advisory. After any content change, rerun the affected repository checks directly. Repairing the upstream fingerprint is outside this installation's scope.

## Operational adoption

Operational adoption completed on 2026-10-22 after one controlled trial.

The trial used `mayberry-handoff` and wrote `.mayberry/instances/mayberry-handoff.md`. The record stayed out of `docs/`. The local exclude kept the handoff out of `verify-repository-references`, which still reports only the pre-existing `python/sdk/uv.lock:113` failure. State revision 3 records the handoff pointer. The installer's `adopted.at` value is unchanged.

Treat this as adoption of the local working process, not publication. The pack is still uncommitted. Future content changes still require rerunning the affected checks; `resume` remains advisory.

## Removal and updates

Mayberry 0.2.0 has no working `upgrade` or `remove` command. Treat the version as fixed. A future version needs a separate migration; do not replace individual pack files.

To remove this local installation safely:

1. Delete generated records under `.mayberry/instances/` only if they are no longer wanted.
2. Remove the seven `.agents/skills/mayberry*` directories.
3. Remove `.mayberry/`.
4. Remove the root `AGENTS.md` paragraph that links here.
5. Restore `docs/AGENTS.md` and `docs/architecture.md` only if their hashes differ from the recorded pre-install values.
6. Preserve `.agents/plans/2026-10-21-mayberry-install/` and any unrelated work.

Do not use `git clean`, `git checkout`, or `git restore` for this cleanup. Use the ownership-safe recovery rules in the installation plan.
