# Plan Change Log — Install the Mayberry pack

| Change ID | Original section | Change in final plan | Reason / finding ID | Requirement impact | Approval needed? |
|---|---|---|---|---|---|
| C1 | Draft step 1 — run `init` for every detected harness | Install with `--harness codex` only | F1: the Claude Code destination is blocked by `.claude/skills`, so an all-harness install aborts | Makes the install possible; narrows harness coverage to DeepSeek Harness/Codex | No |
| C2 | Draft step 2 — keep generated `docs/` templates | Delete the four new placeholders; keep `docs/AGENTS.md` and `docs/architecture.md` | F2: unpaired `docs/**` files fail the bilingual gate and duplicate canonical records | Preserves the repository documentation contract and existing canonical records | No |
| C3 | Draft step 3 — confirm skills exist | Add exact skill inventory, frontmatter validation, state, ledger, runtime, and lock checks | F7: the draft had no evidence that the pack was usable or internally consistent | Adds measurable acceptance evidence | No |
| C4 | Draft step 5 — commit everything | Keep the install uncommitted; add a publication approval gate | F3: private, unlicensed Mayberry content would be published by a commit to the public fork | Prevents an unauthorized publication | Yes — before commit or push |
| C5 | Not present | Map `adopted.records` to `README.md`, `docs/testing.md`, `docs/architecture.md`, and `.agents/notes/README.md` | F2 and F4: avoid parallel records and fix the recorded path casing | Keeps Mayberry's adopted context aligned with the repository | No |
| C6 | Not present | Filter `docs/` entries from `.mayberry/pack-lock.json` and verify 98 retained entries | F5: the lock must not record files removed by C2 | Keeps the install inventory truthful | No |
| C7 | Not present | Add `.mayberry/INTEGRATION.md` and one root `AGENTS.md` rule | F6: installed skills still name `docs/` for generated documents | Prevents the documentation-gate conflict from recurring | No |
| C8 | Draft risks — unspecified | Add preflight hashes, baseline gate results, scoped `git status`, and rollback steps | F7: the working tree is already dirty and `docs/architecture.md` is modified | Makes verification and recovery attributable | No |
| C9 | Not present | Normalize `adopted.at` to the local date | F8: Mayberry writes the UTC date, which is the next local day | Cosmetic consistency only | No |
| C10 | Not present | Document the shell-execution surface and seven-skill context cost as accepted risks | F9 and F10 | Makes residual risk visible without changing scope | No |
| C11 | Not present | Remove the literal repository HEAD from the deliverables; re-resolve it in preflight; add `verify-repository-references` to baseline and post-install checks | F11: quoting this repository's commit added two failures to a maintained-file reference gate | Keeps the plan artifacts gate-clean and distinguishes their effect from the one baseline failure | No |

## Preserved decisions and scope

- The user's intent to install Mayberry into this checkout is preserved.
- The installation remains a project-local install for the harness that this repository actually uses.
- The existing repository instructions, documentation standards, and verification gates remain authoritative.
- No product code, package manifest, lockfile, build configuration, or pre-existing dirty file is changed.
- The install remains reversible by deleting the added paths and reverting the one root `AGENTS.md` paragraph.

## Changes not made

- **Did not replace `.claude/skills`.** Turning the tracked file into a directory or symlink could enable the Claude Code install, but it changes an existing harness setup that this request does not need.
- **Did not add Mayberry's `docs/` files to translation exclusions.** That would create a permanent exemption for documents that duplicate canonical records and violate the documentation tier rules.
- **Did not edit the installed Mayberry skills.** Changing their hardcoded `docs/` paths would diverge from the pinned pack and complicate future replacement. A repository-level rule is the smaller, reviewable control.
- **Did not vendor Mayberry as a package dependency or add it to `pnpm-lock.yaml`.** Mayberry is unpublished; installation is file-based, not a package-manager dependency.
- **Did not run the full test suite, typecheck, or build.** No package source or TypeScript configuration changes.
- **Did not commit or push.** Publication is the open approval in F3.
