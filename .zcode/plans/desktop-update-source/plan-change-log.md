# Plan Change Log — Desktop update source: permanent fix

## Changes

| Change ID | Original section | Change in final plan | Reason / finding ID | Requirement impact | Approval needed? |
| --- | --- | --- | --- | --- | --- |
| C1 | Prior draft (`.zcode/plans/plan-session_6ca51f7…md`) "Risks and notes": development runs keep showing the message by design | Replaced with a product-state fix: the development build reports an informational `unavailable` state and never an error | F1, F2 | R3, R4 | No |
| C2 | Prior draft (implicit): feed work is sufficient | Added a release gate that verifies packaged `app-update.yml` and emitted `nightly.yml` before publishing | F3 | R3 | No |
| C3 | New (not in any draft) | Added a startup diagnostic line and `fife-doctor.mjs` for one-command diagnosis | F5 | R4 | No |
| C4 | New | Constrained the new state so it is never written to the durable journal, keeping the qualifier's closed schema valid | F4 | None (protects existing evidence) | No |
| C5 | Prior draft: run the first installer by hand once | Replaced with switching the daily launch surface to the installed app, plus a reversible data merge of sessions/storages/attachments/credentials | F8, user intent | R1 | D3 |
| C6 | New | Phase 2 offers a frozen portable official-app copy (Option B) before an identity split (Option A) | F9 | R5 | D1, D2 |
| C7 | Prior draft scope (feed + release driver only) | Explicit non-goals added: no electron-updater change, no identity change in Phase 1, no persistence change | Scope discipline from the review | Preserves scope | No |
| C8 | Prior draft verification (unit tests + one manual build) | Verification expanded to negative packaging cases, misconfiguration regression, localization gate, and GUI/snapshot gates with pass conditions | F12 and completeness | R2, R4 | No |

## Preserved decisions and scope

- The fife deployment remains the fork's update mechanism: GitHub Releases through electron-updater's generic provider, `nightly` channel, build versions `<product>.<YYYYMMDD>.<index>`, published as regular releases.
- The fork keeps the upstream application id and product name in Phase 1, so the installed app continues to upgrade in place.
- No change to signing, macOS packaging, the COS upload paths, session format, or the update-journal schema.
- The release driver remains the single publishing entry point.

## Changes not made

| Suggestion | Why declined |
| --- | --- |
| Enable electron-updater in the development build (`forceDevUpdateConfig` + `dev-app-update.yml`) | The dev version is the manifest product version, so every release would permanently appear available; install runs the NSIS installer and quits the development app to update a different installation. Adds confusion and removes the distinction between a source run and a release. |
| Let the development build perform a read-only feed check | Duplicates provider logic outside electron-updater and still cannot install; leaves two update stories. |
| Suppress or reword the existing error only | Hides the latent packaging defect (F3) and gives no next action. |
| Change app identity now to allow concurrent official-app installation | Correct for coexistence but forces branding, protocol-handler, and user-data decisions plus a migration; not required to fix the reported failure. Deferred to Phase 2 under D1/D2. |
| Add the resolved update source to the durable journal | The qualifier's closed schema would need coordinated changes and its own migration review; the same facts are available from the startup line, failure details, and the doctor command. |
| Delete the updater cache automatically after install | Out of scope for this defect; the cache is reported by the doctor command instead. |

## Post-approval implementation notes

The user approved Phase 1 with "build". These deviations from the written tasks are recorded so the plan and the code stay consistent.

| Item | Planned | Implemented | Why |
| --- | --- | --- | --- |
| C9 | Failure technical details name the feed URL | They name the resolved source, channel, installed version, and configuration path; the feed URL is printed by `fife-doctor` from that same path | Reading the packaged YAML in the main process would add a parser dependency to the shell for one diagnostic field; the configuration path identifies the feed, and the doctor resolves it without new dependencies |
| C10 | Doctor prints the installed application version | It prints the packaged feed, published release, offered version, and pending installer, but not the installed version | Reading the version requires parsing `app.asar`; the app itself shows the current version, and every remaining fact that decides whether an update is offered is available without it |
| C11 | `unavailable` states are excluded from the journal in `publishUpdate` | Implemented exactly; the qualification parser and its closed schema are untouched | Keeps installed-update evidence readable |
| C12 | T1 data merge is an operator step | Executed after the user answered "do D3"; see "Decisions and operator actions executed" | D3 approved |

Verification actually run: focused desktop and settings tests, the full `apps/desktop` suite, the GUI aggregate (unrelated pre-existing failures in `ui-schedule`/`ui-deliverables` from the dirty worktree), host aggregate typecheck, touched-project typecheck, `verify-client-ui-i18n`, `verify-export-jsdoc`, `verify-md-links`, `verify-md-wrap`, `verify-doc-refs`, `verify-repository-references` (my files clean), and `pnpm run lint`. `verify-no-unknown-casts` and the remaining `doc-sync` gates fail only on unmodified files in the dirty worktree.

## Decisions and operator actions executed

| ID | Decision | Executed |
| --- | --- | --- |
| D1 | Option B: official app kept as a portable frozen copy, not installed side by side | Official `0.2.1-rc.2` win-x64 downloaded from the official feed, SHA-512 verified against the feed, extracted to `%USERPROFILE%\DSH-Backup\official-0.2.1-rc.2`, `app\resources\app-update.yml` renamed to `.disabled` so it can never install over the fork, isolated `home\` and `user-data\`, launcher script, Start-menu shortcut, and `README.txt` with source and restore steps; data seeded from `%USERPROFILE%\.dsh` |
| D2 | No identity change: the fork keeps `com.deepseek.harness`, the upstream product name, and the `dsh://` handler | Nothing changed in `desktop-release-environment.mjs`, `electron-builder-config.mjs`, or protocol registration |
| D3 | Merge development-home data into `%USERPROFILE%\.dsh` | Backup at `%USERPROFILE%\.dsh.backup-20261021-071533`; 36 files copied additively (16 session logs, all passing the zstd header check), one existing file skipped, credentials and anonymous id kept from the installed app; all 16 development session directories are present in the target; both `profiles\desktop` manifests are identical, so no profile or plugin migration was needed |

Acceptance status after execution: AC2–AC5 verified by tests and by the doctor run against the real installation; AC1 remains a user action (launch the Start-menu app); AC6 satisfied by D1. No release was published, so the T4 positive path is covered by its unit fixtures only.
