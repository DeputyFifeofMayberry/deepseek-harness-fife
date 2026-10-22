# Final Implementation Plan — Install the Mayberry pack

- Status: CONDITIONAL
- Review depth: Standard
- Based on: [implementation-plan.draft.md](implementation-plan.draft.md) (reconstructed draft; no prior plan existed)
- Evidence baseline: repository HEAD at review time (re-resolve it with `git rev-parse HEAD` in Task 0; the literal is omitted here because repository-reference validation rejects commit identifiers in maintained files) with a pre-existing dirty working tree; Mayberry source `16415bfb7548a442ad9dde9182493bc9e8b5fe51` (version 0.2.0, clean checkout)
- Required approvals: publication/commit decision for private Mayberry content before any commit or push

## 1. Objective and boundaries

Install the Mayberry operating pack into this checkout so DeepSeek Harness sessions can invoke its seven project skills, while preserving the repository's own instructions, documentation contract, and verification gates.

**In scope**

- The seven `mayberry*` skills under `.agents/skills/`.
- The `.mayberry/` pack: worksheets, prompts, reading, runtime helpers, voice asset, state, ledger, and lock.
- A repository-owned integration note and one standing rule that keep Mayberry-generated documents out of the bilingual `docs/` tree.
- Local verification of the installed pack and affected repository gates.

**Non-goals**

- No commit, push, pull request, or publication. That requires the approval in section 8.
- No Mayberry upgrade or removal implementation; 0.2.0 does not provide either command.
- No installation for Claude Code or OpenCode.
- No net change to `docs/`: the four scaffold files the install creates are removed in Task 2, and the two existing documents are preserved. No package manifests, `pnpm-lock.yaml`, build configuration, or product code change.
- No changes to the pre-existing dirty working tree beyond the files this plan names.

**Decisions already made**

| ID | Decision | Reason |
|---|---|---|
| D1 | Install with `--harness codex` only | `.agents/skills/` is the DeepSeek Harness project skill root and also Codex's root. Claude Code cannot be installed: `.claude/skills` is a tracked symlink to `../.agents/skills`, materialized as a regular file on this Windows checkout, so Mayberry's parent-chain check refuses it. |
| D2 | Mayberry-generated documents go to `.mayberry/instances/` | `docs/**` is bilingual-paired and budgeted; Mayberry's generated worksheets and handoffs are working records, not repository reference documentation. |
| D3 | Adopted canonical records point at existing repository documents | Avoid creating parallel `docs/PROJECT.md`, `docs/QUALITY.md`, `docs/DECISIONS.md`, and `docs/CHANGELOG.md` that duplicate canonical records and fail documentation rules. |
| D4 | Do not commit until publication is approved | The Mayberry repository is private and has no `LICENSE` file; committing its content into a public fork publishes it. |
| D5 | Normalize the install lock after removing scaffold documents | The lock must not claim files that no longer exist. |

## 2. Evidence and assumptions

**Verified repository facts**

- `AGENTS.md` says repository packages live under `packages/` and project skills under `.agents/skills/`.
- `packages/skill/skill-filesystem/src/index.ts` discovers project skills from `.dsh/skills` and `.agents/skills`; it has no `.claude/skills` root.
- `.claude/skills` is tracked by Git as a symlink (mode `120000`) to `../.agents/skills`; this Windows checkout materializes it as a 17-byte regular file because `core.symlinks=false`. Mayberry refuses either form as a destination parent.
- `.mayberry/` and `.agents/skills/mayberry*` are absent, and neither path is ignored by Git.
- `docs/AGENTS.md` and `docs/architecture.md` exist. `docs/PROJECT.md`, `docs/DECISIONS.md`, `docs/QUALITY.md`, and `docs/CHANGELOG.md` do not.
- `docs/i18n/README.md` requires every active document under `docs/**` to be a complete English/Chinese pair; `docs/AGENTS.md` is an explicit exclusion.
- `pnpm run verify-doc-budgets` and `pnpm run verify-md-links` pass at baseline.
- `pnpm run verify-repository-references` fails at baseline with one unrelated error: `python/sdk/uv.lock:113` contains a commit-shaped identifier.
- `pnpm run verify-translation-pairing` fails at baseline with three unrelated errors: `docs/capability-seams.i18n.yaml` out of sync, `packages/client/ui-price-phase` link divergence, and `packages/client/ui-schedule/README.i18n.yaml` out of sync.
- `docs/architecture.md` is already modified in the working tree; it is not clean, so a `git diff` check alone cannot prove the install left it alone.
- Root `AGENTS.md` is 2,015 words against a 2,080-word ceiling.
- `verify-md-links` scans `AGENTS.md` and `.agents/skills/**/*.md`; Mayberry's skill files contain no Markdown links.
- `verify-skill-invocation-metadata` only inspects skills that contain `agents/openai.yaml`; Mayberry's skills do not.
- oxlint ignores `**/*.js`, so `.mayberry/scripts/*.js` is outside lint scope.
- Node is `v26.8.1` and pnpm is `11.28.5`, satisfying Mayberry's Node `>=22` engine.
- A read-only planning probe of `planProjectInstall` on this checkout produced 102 steps, 7 skills, 77 staged templates, 6 runtime helpers, 4 reading documents, and 1 asset.

**Verified Mayberry facts**

- `mayberry init --harness codex` is the supported project install path; the package is unpublished, so the local checkout is the only source.
- Project install is transactional. A failed execution rolls back writes and reports that a retry is safe.
- Non-interactive runs keep existing `docs/` files rather than overwriting them. An interactive TTY would prompt for `keep`/`overwrite`.
- `state.yaml` initially records `adopted.records.architecture` as `docs/ARCHITECTURE.md` on this Windows checkout, even though the existing file is `docs/architecture.md`.
- `state write` accepts a full JSON document on stdin and validates it; `state validate` and `state get` are read-only.
- The project lock records every file the install wrote. It does not record the two scaffold documents that were kept.
- The pack's `mayberry`, `mayberry-onboard`, and `mayberry-handoff` skills hardcode `docs/` for generated worksheets, the X-Ray brief, and the handoff.
- `.mayberry/scripts/verify.js` runs requested checks with `spawnSync(command, { shell: true })`.

**Assumptions**

- The user wants Mayberry available to DeepSeek Harness sessions in this checkout, not to configure Claude Code or OpenCode.
- A local install without a commit satisfies the immediate request. Publication is a separate decision.
- Installation runs on the current Windows checkout. A case-sensitive checkout would treat `docs/ARCHITECTURE.md` as a new document and needs a separate review before running the same command.
- The Mayberry checkout remains at `16415bfb7548a442ad9dde9182493bc9e8b5fe51` during installation.

## 3. Technical approach

The pack is copied, not linked. Mayberry installs skill files into the harness skill root and stages its own runtime under `.mayberry/`; the installed skills then read `.mayberry/` rather than the development checkout.

Codex is the only harness selected because its skill root is `.agents/skills/`, which is also the DeepSeek Harness project root. Selecting all detected harnesses would fail on `.claude/skills`, a tracked symlink to `../.agents/skills` that Mayberry refuses as a destination parent. Replacing it is out of scope because it would change the Claude Code setup and is not needed for DeepSeek Harness.

The six scaffold documents Mayberry wants to place in `docs/` are not part of the usable pack. Four are new placeholders that duplicate existing canonical records and would violate the bilingual pairing contract; two already exist (`docs/AGENTS.md` and `docs/architecture.md`) and must be preserved. After installation, remove the four new placeholders and point `adopted.records` at the repository's real records:

| Mayberry record | Repository record |
|---|---|
| project | `README.md` |
| quality | `docs/testing.md` |
| architecture | `docs/architecture.md` |
| decisions | `.agents/notes/README.md` |

Generated Mayberry documents belong in `.mayberry/instances/`, beside the staged worksheets. This keeps relative links short (`../worksheets/...`) and keeps repository `docs/` under its own contract. A root `AGENTS.md` rule makes that location authoritative when a Mayberry skill is active, because the installed skills themselves still say `docs/`.

The install lock is filtered to the 98 retained entries after the four scaffold documents are removed, then validated by parsing and by checking that every recorded path exists.

## 4. Implementation sequence

### Task 0 — Record the preflight baseline

**Prerequisite:** working directory is `Y:\deepseek-harness_fife`.

- Record `git rev-parse HEAD`, `git status --short`, `node -v`, and `pnpm -v`.
- Confirm `.mayberry` and `.agents/skills/mayberry` are absent.
- Record SHA-256 hashes of `docs/AGENTS.md` and `docs/architecture.md`.
- Confirm the Mayberry checkout is clean at `16415bfb7548a442ad9dde9182493bc9e8b5fe51`.
- Run `pnpm run verify-doc-budgets` and `pnpm run verify-md-links`; save both pass results.
- Run `pnpm run verify-repository-references`; save the baseline failure (`python/sdk/uv.lock:113`).
- Run `pnpm run verify-translation-pairing` and save the exact baseline failure set. Do not repair those unrelated failures.

**Expected result:** a baseline record that distinguishes this install's effects from pre-existing work.

### Task 1 — Install the pack for the Codex skill root

Run from the repository root:

```powershell
node Y:\sdd-mayberry\cli.js init --harness codex
```

Do not add `--global`, do not select another harness, and do not answer a prompt. The command must run non-interactively so existing `docs/AGENTS.md` and `docs/architecture.md` are kept.

**Expected report:** seven Codex skills installed; 77 walk templates, 6 runtime helpers, 4 reading documents, and 1 asset staged; `PROJECT.md`, `DECISIONS.md`, `QUALITY.md`, and `CHANGELOG.md` written; `AGENTS.md` and `ARCHITECTURE.md` kept; `adopted: docs/ARCHITECTURE.md`; no enforcement hooks.

**Failure handling:** stop. Mayberry rolls back its own writes. Record the one-line error and do not retry with a different harness or an interactive session.

### Task 2 — Remove the four scaffold documents

Delete only these new files:

- `docs/PROJECT.md`
- `docs/DECISIONS.md`
- `docs/QUALITY.md`
- `docs/CHANGELOG.md`

Do not delete `docs/AGENTS.md` or `docs/architecture.md`. Confirm both hashes match the preflight values.

**Expected result:** `docs/` returns to its pre-install file set.

### Task 3 — Point adopted records at the repository's canonical documents

Read the current state, replace `adopted.at` with `2026-10-21`, set the four record paths, and write the full document through the supported command:

```powershell
$state = node .mayberry/scripts/mayberry-api.js state get | ConvertFrom-Json
$state.adopted.at = '2026-10-21'
$state.adopted.records = [pscustomobject]@{
  project      = 'README.md'
  quality      = 'docs/testing.md'
  architecture = 'docs/architecture.md'
  decisions    = '.agents/notes/README.md'
}
$state | ConvertTo-Json -Depth 20 | node .mayberry/scripts/mayberry-api.js state write
```

Then run `node .mayberry/scripts/mayberry-api.js state validate` and `state get`.

**Expected result:** state validates, revision increases, and every adopted path exists.

### Task 4 — Filter the install lock

Remove lock entries whose `path` is one of the four deleted documents:

- `docs/PROJECT.md`
- `docs/DECISIONS.md`
- `docs/QUALITY.md`
- `docs/CHANGELOG.md`

Write the result as two-space JSON with one trailing LF. For example:

```powershell
node -e "const fs=require('fs');const p='.mayberry/pack-lock.json';const drop=new Set(['docs/PROJECT.md','docs/DECISIONS.md','docs/QUALITY.md','docs/CHANGELOG.md']);const lock=JSON.parse(fs.readFileSync(p,'utf8'));lock.files=lock.files.filter(f=>!drop.has(f.path));fs.writeFileSync(p,JSON.stringify(lock,null,2)+'\n')"
```

Then parse it and confirm:

- exactly 98 `files` entries remain;
- no removed path appears;
- every remaining `files[].path` exists;
- `skills`, `pack_version`, and `installed_at` are unchanged.

**Expected result:** the lock matches the retained install.

### Task 5 — Add the repository integration note

Create `.mayberry/INTEGRATION.md` with:

- source repository, commit, version, and install command;
- a statement that repository `AGENTS.md`, `docs/AGENTS.md`, and their gates remain authoritative;
- the `.mayberry/instances/` location for generated worksheets, the X-Ray brief, and the handoff; change records remain in state and the ledger;
- the four adopted canonical record paths, as relative links;
- the runtime command and the shell-execution warning for `verify run`;
- manual removal steps and the absence of `upgrade`/`remove` in 0.2.0.

Create `.mayberry/instances/.gitkeep` so the directory survives a clone, then run `node .mayberry/scripts/mayberry-api.js links check .mayberry/INTEGRATION.md` and repair any broken relative link.

**Expected result:** the file's links resolve and no `docs/` path is proposed for generated Mayberry records.

### Task 6 — Add the standing integration rule

Append one paragraph to the Conventions section of root `AGENTS.md`:

```markdown
**Mayberry pack:** its generated worksheets, X-Ray, and handoff go under `.mayberry/instances/`; repo `docs/` stays canonical and additions there need bilingual pairs ([integration](.mayberry/INTEGRATION.md)).
```

Confirm the file still ends with exactly one newline and remains at or below the 2,080-word budget (projected 2,037).

**Expected result:** every future session sees the redirect before invoking a Mayberry skill.

### Task 7 — Verify the installed pack and repository gates

Run the checks in section 5. Record exact commands, outputs, failures, and any check not run.

### Task 8 — Report the installed state

Report the Mayberry version and source commit, every path added or modified, the verification results against the baseline, and the approval still required before commit or push. Do not commit.

## 5. Verification

| Check | Command or inspection | Pass condition |
|---|---|---|
| Install report | Task 1 output | Seven skills, expected scaffold counts, both existing docs kept, no hook declarations |
| Skill count and names | List `.agents/skills/mayberry*` | Exactly seven directories: `mayberry`, `mayberry-onboard`, `mayberry-change`, `mayberry-implement`, `mayberry-verify`, `mayberry-status`, `mayberry-handoff` |
| Skill frontmatter | Parse each `SKILL.md` | Frontmatter starts and closes with `---`; `name` equals the directory; `description` is non-empty |
| State | `node .mayberry/scripts/mayberry-api.js state validate` | Prints `state ok`; exit 0 |
| State contents | `state get` | `adopted.records` has the four canonical paths; every target exists; `adopted.at` is `2026-10-21` |
| Ledger | `node .mayberry/scripts/mayberry-api.js ledger read` | One `init` entry with `result: ok` and pack `mayberry@0.2.0` |
| Runtime usage | `node .mayberry/scripts/mayberry-api.js` | Prints the command usage; exit 0 |
| Harness config | Read `.mayberry/config.yaml` | `harness: codex` and no other harness id |
| Lock integrity | Parse `.mayberry/pack-lock.json` | 98 entries; no removed docs; every recorded path exists |
| Scaffold removal | `Test-Path` for the four files | All false; `docs/AGENTS.md` and `docs/architecture.md` remain |
| Existing docs preserved | Compare SHA-256 to preflight | Both hashes unchanged |
| Integration links | `node .mayberry/scripts/mayberry-api.js links check .mayberry/INTEGRATION.md` | No unresolved relative link |
| Doc budgets | `pnpm run verify-doc-budgets` | Passes, as at baseline |
| Markdown links | `pnpm run verify-md-links` | Passes; the installed skills contain no relative links and the new `AGENTS.md` target exists |
| Translation pairing | `pnpm run verify-translation-pairing` | Exactly the three baseline errors, no new `docs/PROJECT.md`, `docs/QUALITY.md`, `docs/DECISIONS.md`, or `docs/CHANGELOG.md` errors |
| Repository references | `pnpm run verify-repository-references` | Exactly the baseline `python/sdk/uv.lock:113` error; no `.mayberry` or plan-artifact error |
| Working tree scope | `git status --short` compared with the preflight snapshot | Only `.mayberry/`, the seven skill directories, `AGENTS.md`, and `.agents/plans/2026-10-21-mayberry-install/` are new or modified by this work |
| Whitespace | `git diff --check -- AGENTS.md` | Exit 0 |

Do not run the full test suite, typecheck, or build: no package source, manifest, or TypeScript configuration changes. State that they were not run and why.

## 6. Release and recovery

This change has no deployment step. It changes repository content only.

**Rollback**

1. Delete `.mayberry/`.
2. Delete the seven `.agents/skills/mayberry*` directories.
3. Remove the Mayberry paragraph from `AGENTS.md`.
4. Delete `.agents/plans/2026-10-21-mayberry-install/` if the plan artifacts are not wanted.
5. Confirm `git status --short` matches the preflight baseline plus no Mayberry paths.
6. Re-check the two docs hashes.

If the install fails during Task 1, Mayberry's transaction should leave no `.mayberry/` and no skill files. Verify that before retrying. If rollback also failed, the command reports a partial install; inspect the named paths before any retry.

**Commit and publication**

Not part of this plan. Before committing, the owner must approve publishing the private Mayberry pack into the public fork and decide whether to add a license or source record to the Mayberry source repository.

## 7. Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| A1 | DeepSeek Harness discovers the seven Mayberry skills from `.agents/skills/` | Seven directories with valid frontmatter; loader root confirmed in source |
| A2 | The pack is complete and self-contained | Counts for 36 worksheets, 41 prompts (77 staged templates), 6 runtime helpers, 4 reading documents, 1 voice asset; runtime usage command succeeds |
| A3 | State and ledger are valid and reflect the install | `state validate`, `state get`, `ledger read` |
| A4 | The repository's canonical documents are unchanged | Pre/post SHA-256 equality for `docs/AGENTS.md` and `docs/architecture.md` |
| A5 | No Mayberry scaffold enters the bilingual `docs/` tree | Four files absent; translation-pairing failure set unchanged |
| A6 | The lock matches the retained install | 98 entries, all existing, no removed docs |
| A7 | Future Mayberry-generated documents stay outside `docs/` | `AGENTS.md` rule and `.mayberry/INTEGRATION.md`; link check passes |
| A8 | Repository gates are not made worse | Doc budgets pass; Markdown links pass; translation pairing and repository references match their baseline failure sets |

## 8. Remaining risks and decisions

| Item | Owner | Consequence | Required action |
|---|---|---|---|
| Publication and license | Repository owner | Mayberry is a private repository with no `LICENSE`; committing into the public fork publishes it | Approve publication and record the source and license, or keep the install uncommitted |
| No upgrade or remove command | Mayberry maintainer | Future pack changes require manual replacement; `mayberry upgrade` and `remove` refuse | Accept for 0.2.0; revisit when the commands ship |
| Skills still name `docs/` | Repository owner | An agent that ignores the root rule could write unpaired documents into `docs/` | The standing rule and integration note are the control; review any Mayberry-generated path |
| Shell execution in `verify run` | User invoking `mayberry-verify` | The runner executes the supplied command with a shell | Treat commands as repository code; the pack source is pinned by commit |
| Windows case collision | Implementer | `docs/ARCHITECTURE.md` resolves to `docs/architecture.md` here but is a distinct path on case-sensitive systems | State records the actual lowercase path; never create a second casing |
| Seven new skill descriptions | Repository owner | Small, permanent increase in the session skill catalog | Accept; remove the pack if it is not used |
