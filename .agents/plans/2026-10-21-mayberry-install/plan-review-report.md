# Plan Review Report — Install the Mayberry pack

## Verdict

**CONDITIONAL.** The local installation path is implementable and verified against the repository. The plan is not ready to commit or publish because the Mayberry source is a private repository with no license, and the plan intentionally defers that approval.

## Review scope and evidence

- Review tier: **Standard**. The change is reversible local tooling, but it adds third-party content, affects documentation gates, and introduces an external workflow.
- Repository: `Y:\deepseek-harness_fife`, HEAD at review time (the exact value is re-resolved in the plan's preflight; it is not repeated here because repository-reference validation rejects commit identifiers in maintained files), with a pre-existing dirty working tree.
- Mayberry source: `Y:\sdd-mayberry`, revision `16415bfb7548a442ad9dde9182493bc9e8b5fe51`, version 0.2.0, clean.
- Inspected: root `AGENTS.md`, `docs/AGENTS.md`, `docs/i18n/README.md`, `packages/skill/skill-filesystem/src/index.ts`, `scripts/verify-md-links.ts`, `scripts/verify-md-wrap.ts`, `scripts/verify-translation-pairing.ts`, `scripts/verify-doc-budgets.ts`, `scripts/doc-budgets.manifest.json`, `.oxlintrc.json`, Mayberry `cli.js`, `lib/init.js`, `lib/harnesses.js`, `lib/install-engine.js`, `pack/manifest.json`, all installed skill entry files, `pack/scripts/util-state.js`, `pack/scripts/util-lock.js`, and the repository templates.
- Executed: a read-only `planProjectInstall` probe against the real checkout; a full install probe in a temporary directory; state write, ledger read, and lock filtering in that temporary directory; `pnpm run verify-doc-budgets`; `pnpm run verify-md-links`; `pnpm run verify-repository-references`; `pnpm run verify-translation-pairing`; Git and file-hash inspections.
- Not available: the Mayberry test suite was not run; no network/npm publication exists; no independent legal review of the pack license.

## Findings

| ID | Severity | Evidence status | Finding | Evidence/reference | Resolution | State |
|---|---|---|---|---|---|---|
| F1 | High | Verified | The draft ran `mayberry init` for every detected harness. This checkout detects both `claude-code` and `codex`, but `.claude/skills` is a symlink to `../.agents/skills` (materialized as a regular file on this Windows checkout), so Mayberry's parent-chain check refuses the Claude Code destination and the whole install aborts. | Git records `.claude/skills` as mode `120000`; `core.symlinks=false` materializes it as a 17-byte file; `lib/install-engine.js` `assertParentChain` refuses both symlinks and non-directories; `lib/harnesses.js` detects `claude-code` from `.claude/`. | Install with `--harness codex`; do not modify `.claude/skills`. | Resolved |
| F2 | High | Verified | Keeping Mayberry's six `docs/` templates would add four new Markdown files with no Chinese counterpart, failing `verify-translation-pairing`, and would create parallel `PROJECT`/`QUALITY`/`DECISIONS` records that duplicate canonical repository documents. | `docs/i18n/README.md` scope includes every active `docs/**` document; the four generated files have no `.zh.md`; `docs/QUALITY.md` restates `docs/testing.md` policy. | Delete the four generated placeholders; keep `docs/AGENTS.md` and `docs/architecture.md`; map adopted records to existing canonical files. | Resolved |
| F3 | High | Verified | Committing the pack publishes content from a private repository that has no `LICENSE` file into the public fork. The draft treated commit as a normal step. | `gh repo view` reports the Mayberry repository as private; no `LICENSE` or `LICENSE.md` exists in the checkout; `deepseek-harness-fife` is public. | Keep the install local; require an explicit publication/license decision before any commit or push. | Open |
| F4 | Medium | Verified | Mayberry records `adopted.records.architecture` as `docs/ARCHITECTURE.md`. On this Windows checkout it resolves to the existing `docs/architecture.md`, but that path does not exist on a case-sensitive checkout, so Mayberry would later report the canonical architecture record missing. | Temporary install probe produced `"architecture": "docs/ARCHITECTURE.md"`; the actual file is `docs/architecture.md`. | Rewrite the adopted record to the actual lowercase path and validate state. | Resolved |
| F5 | Medium | Verified | Removing the four scaffold documents after install leaves four stale entries in `.mayberry/pack-lock.json`; the lock would claim files that do not exist. | Probe lock had 102 entries including the four docs; filtering produced 98 entries with zero missing paths. | Filter those four entries; require 98 entries and existence checks. | Resolved |
| F6 | Medium | Verified | The installed skills hardcode `docs/` for the X-Ray, handoff, and worksheet instances. Without a repository rule, a future Mayberry session would recreate the documentation-gate conflict that F2 removes. | `mayberry/SKILL.md` line 109, `mayberry-onboard/SKILL.md` line 16, `mayberry-handoff/SKILL.md` line 13; `docs/**` pairing contract. | Add `.mayberry/INTEGRATION.md` and one root `AGENTS.md` rule directing generated documents to `.mayberry/instances/`. | Resolved |
| F7 | Medium | Verified | The draft had no rollback, no baseline comparison, and no check that pre-existing docs were preserved; `docs/architecture.md` is already dirty, so a Git-only check cannot prove it was untouched. | Preflight shows `docs/architecture.md` modified; baseline doc-budget and markdown-link passes; baseline translation-pairing and repository-reference failures. | Add pre/post hashes, exact rollback steps, baseline failure comparison, and scoped working-tree checks. | Resolved |
| F8 | Low | Verified | Mayberry writes `adopted.at` from the UTC date, which is `2026-10-22` while the local session date is `2026-10-21`. | Probe output `adopted.at: 2026-10-22` at 21:28 PDT. | Normalize to `2026-10-21` during the state rewrite. | Resolved |
| F9 | Low | Verified | The pack's `verify run` executes a caller-supplied command with `shell: true`, which is a code-execution surface. | `pack/scripts/verify.js` line 84. | Accept as repository-code execution; state the trust assumption and pin the source commit. | Risk accepted |
| F10 | Low | Unverified | Seven new skill descriptions enter the session skill catalog and consume context. | The installed skill frontmatter has seven `description` fields; exact token cost was not measured. | Accept the small permanent cost; remove the pack if unused. | Risk accepted |
| F11 | Medium | Verified | The first version of these deliverables quoted this repository's HEAD commit. `verify-repository-references` rejects commit identifiers in maintained files and failed on both plan artifacts, adding two new errors to a gate that already has one unrelated failure. | `pnpm run verify-repository-references` output named `implementation-plan.final.md:6` and `plan-review-report.md:10`; baseline failure is `python/sdk/uv.lock:113`. | Replace the literal HEAD with a preflight re-resolution; add the gate to the plan's baseline and post-install checks; require no new error. | Resolved |

## Traceability and verification

| Requirement | Planned work | Acceptance check |
|---|---|---|
| Mayberry available to DeepSeek Harness | Task 1; D1 | A1: seven skills under `.agents/skills/` with valid frontmatter |
| Complete, self-contained pack | Task 1 | A2: expected file counts and runtime usage |
| Durable state and evidence | Tasks 1 and 3 | A3: `state validate`, `state get`, `ledger read` |
| Existing repository records preserved | Tasks 2 and preflight | A4: pre/post hashes of `docs/AGENTS.md` and `docs/architecture.md` |
| No bilingual-docs regression | Tasks 2 and 7 | A5: four files absent; pairing failure set unchanged |
| Lock matches retained install | Task 4 | A6: 98 entries, all existing |
| Future Mayberry documents stay out of `docs/` | Tasks 5 and 6 | A7: rule present; link check passes |
| Repository gates not worsened | Task 7 | A8: doc budgets pass; Markdown links pass; pairing and repository references match baseline |

**Independent review:** two fresh-context reviewers were started, but neither returned a result within the review window; both were stopped. The final pass below was performed by the primary reviewer, so it is not independent.

## Independent verification

The final pass checked the three artifacts against the review findings and ran the affected repository-reference gate.

- Every Resolved finding has a matching task or verification row in the final plan.
- Every acceptance criterion A1–A8 maps to a task and a verification check.
- The one Open finding is the publication/license decision; no other Blocker or High finding is open.
- The artifacts no longer contain this repository's commit identifier, and `verify-repository-references` reports only the pre-existing `python/sdk/uv.lock:113` failure.
- The banned origin-label term defined in root `AGENTS.md` is absent from the artifacts.
- The plan's rollback steps remove every path the plan adds.

Limitation: this is a self-check, not an independent review. No human review has occurred.

## Open decisions and residual risks

| Item | Decision-maker | Impact | Required next action |
|---|---|---|---|
| Publish private Mayberry content into the public fork | Repository owner | Without approval, the install must remain uncommitted | Approve publication and record the source and license, or keep the working tree local |
| Future Mayberry upgrade/removal | Mayberry maintainer | 0.2.0 cannot upgrade or remove itself; manual replacement is required | Accept for this install; revisit when those commands ship |
| Generated-document redirect enforcement | Repository owner | The root rule is instruction-level, not a mechanical gate | Review any path a Mayberry session proposes under `docs/` |

## Review limitations

- The Mayberry repository's own 296-test suite was not run; this review validates the installation path and the specific pack behavior used by the plan.
- Token cost of the seven skill descriptions was not measured.
- No legal review of the missing Mayberry license was performed.
- The temporary install probe ran on Windows; case-sensitive behavior was reasoned from the recorded path, not executed on Linux.
- `verify-translation-pairing` already fails at baseline for unrelated in-progress changes; the plan can only require that its failure set does not grow. `verify-repository-references` has one unrelated baseline failure.
