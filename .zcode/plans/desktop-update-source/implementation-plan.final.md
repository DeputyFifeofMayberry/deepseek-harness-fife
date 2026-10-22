# Final Implementation Plan — Desktop update source: permanent fix

- Status: READY (implemented and verified; D1/D2 resolved by the portable-backup option, D3 executed; the remaining items are operator actions, not blockers)
- Review depth: Standard, with Deep review of the decision-gated coexistence workstream
- Based on: this investigation; previous draft `.zcode/plans/plan-session_6ca51f7cedded095332c66e80d210117.md` (the fife update-feed plan whose accepted risk is the recurrence)
- Evidence baseline: the checkout's `master` worktree (dirty with unrelated client edits, recorded at review time); live processes PID 27824 (development Electron) and 22584 (its `dsh-desktop-host`, owner of the Web GUI `127.0.0.1:55213`); installed app `%LOCALAPPDATA%\Programs\DeepSeek Harness`; GitHub releases `.20261020.1` and `.20261020.2`
- Required approvals: none outstanding (D1, D2, and D3 were decided on 2026-10-21)

## 1. Objective and boundaries

**Objective.** The app the user launches every day is a packaged fork build that checks for and installs updates the way a normal desktop app does, and no build or launch path can silently reproduce "desktop update: this application has no packaged update source" as a user-visible failure.

**Requirements (from the user, in priority order).**

| ID | Requirement | Source |
| --- | --- | --- |
| R1 | The fork's packaged desktop app is the daily driver. | User answer, 2026-10-21 |
| R2 | Update checks and installs work like a normal app: scheduled checks, on focus, and on demand. | User: "checks for updates like normal" |
| R3 | The reported failure must not recur, and no future build or launch habit may reintroduce it. | User: "permanently fix", "again" |
| R4 | The solution is simple, repeatable, and easy to diagnose later. | User |
| R5 | The official (upstream) dsh app stays available as a standalone backup. | User answer |

**In scope.**

- Switching the daily launch surface to the installed packaged app, including a one-time, reversible data merge.
- A first-class "update source unavailable" product state for unpackaged/misconfigured builds, replacing the current raw error.
- Diagnostics that name the resolved update source (feed, channel, config path, packaged flag) on every failure, plus one read-only diagnostic command.
- A release gate that refuses to publish a fork build whose packaged application has no valid update source.
- Documentation of the daily-driver workflow in `FORK.md`.

**Out of scope (explicit non-goals).**

- Changing electron-updater's version, provider, or the upstream COS/macOS/signing paths.
- Making the unpackaged development build download and run installers (rejected in §4 with evidence).
- Changing the fork's application identity, branding, or Windows signing in Phase 1 (Phase 2, D1).
- Any change to session format, persistence types, or the durable update-journal schema.

## 2. Evidence and assumptions

### 2.1 Verified facts

| # | Fact | Evidence |
| --- | --- | --- |
| E1 | The message originates only in `DesktopUpdateCoordinator.doCheck` and its `enabled()` gate. | `apps/desktop/src/update-coordinator.ts:187`, `:55` |
| E2 | `enabled()` is `app.isPackaged && existsSync(<process.resourcesPath>/app-update.yml)`; an unpackaged run can never satisfy it. | same, `:55` |
| E3 | The app used when the error appeared is the **development** build: `electron.exe … --user-data-dir=…\.desktop-build\development\electron-user-data Y:\deepseek-harness_fife\apps\desktop`. Its host PID 22584 serves this conversation's Web GUI. | `Get-CimInstance Win32_Process`, `Get-NetTCPConnection -LocalPort 55213` |
| E4 | The installed packaged app **does** update: `resources\app-update.yml` = `provider: generic`, `url: https://github.com/DeputyFifeofMayberry/deepseek-harness-fife/releases/latest/download/`, `channel: nightly`; uninstall registry `DisplayVersion = 0.2.1-rc.2.20261020.2`; updater cache holds the `.2` installer downloaded 16:07. | filesystem + registry inspection |
| E5 | The feed is complete and current: latest regular release `v0.2.1-rc.2.20261020.2` carries the installer, its `.blockmap`, and `nightly.yml`. | `gh release view --json tagName,assets` |
| E6 | electron-updater 6.8.9 disables itself unless `app.isPackaged || forceDevUpdateConfig`, then reads `<app.getAppPath()>/dev-app-update.yml`; in dev `app.getVersion()` is the manifest product version. | `node_modules/.pnpm/electron-updater@6.8.9.../out/AppUpdater.js:277-284`, `:155-161` |
| E7 | The durable journal's qualifier accepts a closed set of fields, actions, and phases. | `apps/desktop/scripts/installed-update-qualification.ts:129-161` |
| E8 | A packaged build silently loses its update source when `DSH_DESKTOP_UNSIGNED=1` is used without the fife deployment: `publish` becomes `null` and no `app-update.yml` is written. | `apps/desktop/scripts/electron-builder-config.mjs:100`, `:266`; `apps/desktop/packaging/README.md` "Unsigned Windows test installer" |
| E9 | The packaged app's harness home is `~/.dsh`; the development launcher overrides it to `.desktop-build/development/home`. | `packages/util/home-paths/src/index.ts:12,71`; `apps/desktop/scripts/dev.ts:66-67` |
| E10 | Manual-check failures are rendered as an error box whose "technical details" are the raw internal message. | `apps/desktop/src/main.ts:531-542`; `apps/desktop/src/update-presentation.ts:24-38` |

### 2.2 Assumptions (must be re-verified at the named task)

| ID | Assumption | Verified at |
| --- | --- | --- |
| A1 | The installed app's recent sessions live under `~/.dsh` (E9 plus `~/.dsh/storages` modified 16:12, minutes after the `.2` install). | T1 step 1 |
| A2 | The user's current work lives in the development home (sessions directory `--Y-deepseek-harness_fife--` modified 06:17 today). | T1 step 2 |
| A3 | GitHub `releases/latest/download` keeps resolving because the release driver never publishes drafts or prereleases. | T4 gate + T5 doc |
| A4 | The desktop tests already mock `app.isPackaged:false`, and the coordinator fixture injects `enabled: () => true`, so the unsupported path has no coordinator-level coverage today. | T2 tests |

## 3. Root cause

The reported message has two independent causes; only the first is visible today.

- **C1 (reported).** The daily launch surface is the unpackaged development build. `app.isPackaged` is false, so the updater is structurally unavailable (E1–E3). No feed work can fix this, and no code change should pretend a source-run app can replace itself.
- **C2 (latent, same message).** A packaged build produced outside the fife deployment has `publish: null` and therefore no `app-update.yml` (E8). Any future manual unsigned build installed by hand reproduces the identical error.

The previous plan knowingly accepted C1 as a risk ("Dev-mode runs keep showing this exact message … by design"), and the user then continued to work in the development build. The recurrence is therefore a workflow and product-state defect, not a regression of the feed.

## 4. Technical approach

1. **One updatable surface.** The installed packaged fork app is the daily driver (R1, R2). The development build keeps working for development but reports an explicit, non-error `unavailable` state (R3, R4).
2. **Update source as resolved data.** Replace the boolean gate with a pure resolver returning one of `packaged` (with config path and channel), `development`, or `missing-configuration`. The coordinator publishes `phase: 'unavailable'` for the latter two: no `failedOperation`, no error dialog, no failure backoff.
3. **Diagnose once, in one place.** Every real update failure carries `technicalDetails` naming the resolved source (`packaged=…`, `channel=…`, `config=…`, `feed=…`, `appVersion=…`); startup logs the same line once; a read-only command reports installed app version, packaged feed, latest published release, feed metadata version, and cached pending update.
4. **Gate the release, not the runtime.** Before `gh release create`, verify the packaged `resources/app-update.yml` and the emitted `nightly.yml` name the expected feed, channel, version, and installer. A build that cannot update can never be published.
5. **Keep durable evidence stable.** `unavailable` states are not written to the update journal, so the qualifier's closed schema (E7) stays valid and existing qualification evidence remains readable.

**Rejected alternatives.**

| Alternative | Why rejected |
| --- | --- |
| Enable electron-updater in development (`forceDevUpdateConfig` + `dev-app-update.yml`) | In dev the running version is the manifest product version (E6), so every published build is "newer" forever; install runs the NSIS installer and quits the development app, updating a different installation; it also removes the only signal that distinguishes a source run from a release. Complexity and confusion exceed the benefit. |
| Development build performs a read-only check against the feed | Duplicates provider logic outside electron-updater, still cannot install, and leaves two update stories to maintain. |
| Change the fork's app identity now | The installer would no longer upgrade in place, and it forces branding, protocol-handler, user-data, and migration decisions (Phase 2, D1). Not required to fix C1/C2. |
| Suppress the error message only | Hides C2 and leaves the user without a next action; fails R4. |

## 5. Implementation sequence

### T1 — Make the installed fork app the daily driver (operational; prerequisite: D3 approval)

Files: none (host state only).

1. Verify the target app: read `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app-update.yml`; expect the fife URL, `channel: nightly`. Read the uninstall entry's `DisplayVersion`; record it.
2. Record the current development home (`apps/desktop/.desktop-build/development/home`): session count, `storages`, `attachments`, `.credentials.yaml`, and confirm `~/.dsh`'s current content (A1).
3. Back up: copy `~/.dsh` to `~/.dsh.backup-<UTC timestamp>`; leave the development home untouched.
4. Merge **only** `sessions/`, `storages/`, and `attachments/` from the development home into `~/.dsh`, additively by file/id and without overwriting existing entries. Copy `.credentials.yaml` and `.anonymous-user-id` **only when `~/.dsh` has none**; otherwise keep the installed app's own files and re-enter the API key in the installed app if it is missing. Do **not** copy `profiles/` (the installed app's profile points at its own runtime) or `dsh-runtimes/` (build output).
5. Launch the Start-menu "DeepSeek Harness" app; verify the session list, API key, and settings; verify "Check for Updates…" reaches the feed (either "You're up to date!" or an offered update).
6. Record the revert: restore `~/.dsh` from the backup and relaunch the development build.

Expected result: the packaged fork app opens with the user's work and a working update check; the development home is unchanged for development runs.

### T2 — Update source unavailable is a product state (code)

Prerequisite: none. Targets:

- New `apps/desktop/src/update-source.ts`: `resolveDesktopUpdateSource({ isPackaged, configPath, exists })` returning `{ kind: 'packaged', configPath } | { kind: 'development' } | { kind: 'missing-configuration', configPath }`. Pure; no Electron import.
- `apps/desktop/src/update-coordinator.ts`: replace `enabled: () => boolean` with `source: () => DesktopUpdateSource` (default wired to `app.isPackaged` and `process.resourcesPath`). In `doCheck`, resolve first; for non-`packaged` kinds return `setState({ phase: 'unavailable', reason, technicalDetails })` without throwing, without `failedOperation`, and without setting `candidate`.
- `apps/desktop/src/ipc.ts`: add `'unavailable'` to `DesktopUpdateState['phase']`, add `reason?: 'development' | 'missing-configuration'`, and mirror it on `DesktopUpdatePresentation`.
- `apps/desktop/src/locale.ts` (en + zh): add `updateUnavailableTitle`, `updateUnavailableDevelopment`, `updateUnavailableConfiguration`.
- `apps/desktop/src/update-presentation.ts`: pass `reason` through; keep failure-kind mapping unchanged.
- `apps/desktop/src/main.ts`: (a) skip journaling `unavailable` states in `publishUpdate` (`:543`) so E7's closed schema stays valid; (b) in `openUpdatePrompt`, handle `unavailable` immediately after `updateSchedule.check(true)` at `:851` and before the error branch at `:854`, showing `ordinaryMessageBox({ type: 'info', … , technicalDetails: state.technicalDetails })` with the reason copy and returning; (c) leave scheduled checks silent for this state.
- Client: `packages/client/ui-settings-general/src/types.ts` (its own copy of the phase union at `:17` and the presentation interface), `src/client/DesktopUpdateIndicator.tsx` (new phase entry in its exhaustive phase map; render nothing for `unavailable` so a development build carries no persistent badge, no error dot), `src/client/desktop-update-source.ts` (busy-phase list), and `src/client/locales.ts` (en + zh keys). The application menu's "Check for Updates…" action and its informational dialog carry the explanation.

Construction and consumer sites that must change together: `apps/desktop/src/main.ts:601` (coordinator construction), `:543` (journal publish), `:824` (manual prompt); `apps/desktop/tests/update-coordinator.spec.ts`, `tests/update-schedule.spec.ts`, `tests/main-startup.spec.ts`, `tests/update-presentation.spec.ts`; `packages/client/ui-settings-general/tests/*`.

Tests: extend `apps/desktop/tests/update-coordinator.spec.ts` (no-source returns `unavailable`, never `error`; `download`/`install` still reject), `tests/update-presentation.spec.ts`, `tests/main-startup.spec.ts` (manual check in an unpackaged app shows the informational box and calls no updater), and the client indicator spec for the new phase.

Expected result: the development build never shows "Could not check for updates" for a structural reason; the packaged build without a feed explains what to reinstall.

### T3 — Diagnose in one place (code)

- `apps/desktop/src/update-source.ts`: add `describeDesktopUpdateSource(source, { version, channel })` producing the single diagnostic line.
- `apps/desktop/src/main.ts`: log it once at startup; attach it to `technicalDetails` for every check/download/install failure.
- New `apps/desktop/scripts/fife-doctor.mjs` (read-only, no build): print (1) installed app path and uninstall-registry version, (2) its `app-update.yml` fields, (3) latest published release tag and `nightly.yml` version via `gh`, (4) the feed's `nightly.yml` fetched over HTTPS with the named version and file, (5) the updater cache's pending `update-info.json`. Exit non-zero when the installed app has no feed or the feed is unreachable; print the exact failing step.
- Test: extract the pure formatting/validation helpers into `apps/desktop/scripts/fife-doctor-lib.mjs` and cover them in `apps/desktop/tests/fife-doctor.spec.ts` (fixtures for matching, mismatched, and absent metadata).

Expected result: one command answers "why am I not being offered an update".

### T4 — Release gate (code + tests)

- New `apps/desktop/scripts/windows-app-update-config.mjs` (reuse the `js-yaml` dependency already imported by `apps/desktop/scripts/macos-app-update-config.mjs`):
  - `verifyWindowsAppUpdateConfig(appOutDir, { publicUrl, channel })` — reads `resources/app-update.yml`, requires `provider: generic`, the exact URL (trailing-slash normalized), the exact channel, and a non-empty `updaterCacheDirName`.
  - `verifyWindowsUpdateMetadata(metadataPath, { version, installerName })` — parses `nightly.yml`, requires `version` equal to the built version, `files[0].url` equal to the installer name, `files[0].sha512` non-empty, and `path` equal to the installer name.
- `apps/desktop/scripts/fife-release.mjs`: call both after packaging and before `gh release create`; fail with the offending path and expectation.
- Tests: `apps/desktop/tests/windows-app-update-config.spec.ts` with real YAML fixtures, including a missing file, a wrong feed URL, a wrong channel, and a metadata version mismatch.

Expected result: publishing a build without a working update source is impossible; the failure is a build error, not a user-visible runtime error.

### T5 — Documentation (FORK.md)

- Which app updates (installed packaged app) and which app does not (development build), with the exact launch paths.
- Publishing a release, what the gate verifies, and what the installed app does on its next check.
- Diagnosing: the doctor command, the startup diagnostic line, technical details, and updater cache location.
- The accepted trade for R5 if D1 is deferred.

### T6 — Coexistence / backup (decision-gated; prerequisite D1, D2)

- **Option B (recommended, cheap):** keep the official app as a frozen portable copy outside `%LOCALAPPDATA%\Programs`, launched with its own `--user-data-dir` because the desktop shell takes a single-instance lock (`apps/desktop/src/single-instance.ts:20`) and the user-data directory is shared by identity. Document recovery.
- **Option A (full coexistence):** distinct `DSH_DESKTOP_APP_ID` and product name, distinct Electron user data and updater cache directories, protocol-handler ownership decision, one-time uninstall of the current same-id install, and documentation. Requires D2 plus branding approval; touches `desktop-release-environment.mjs`, `electron-builder-config.mjs`, `main.ts`, and `FORK.md`.

## 6. Verification

| Layer | Check | Pass condition |
| --- | --- | --- |
| Unit | `pnpm vitest run apps/desktop/tests/update-coordinator.spec.ts apps/desktop/tests/update-presentation.spec.ts apps/desktop/tests/update-journal.spec.ts apps/desktop/tests/main-startup.spec.ts apps/desktop/tests/windows-app-update-config.spec.ts apps/desktop/tests/fife-doctor.spec.ts` | Green; new coordinator cases assert `unavailable` and no `failedOperation` |
| Types | `pnpm run typecheck` | Green; exhaustive phase maps force the new key |
| Lint/i18n | `pnpm run lint` and `pnpm run verify-client-ui-i18n` | Green; no hardcoded copy |
| GUI | `pnpm run test:gui` | Green |
| GUI visible output | `DSH_SNAPSHOT=replay pnpm run test:web` if the indicator changes assembled output | Green or refreshed intentionally |
| Packaging (negative) | Authoritative coverage is the unit suite over real YAML fixtures. For an integration check, copy `win-unpacked` to a scratch directory, delete or corrupt `resources/app-update.yml`, then run the exported verifier (or a `--verify-only` flag added to the driver) | Verification fails before any publish and names the offending path and expectation |
| Packaging (positive) | `node apps/desktop/scripts/fife-release.mjs --notes "…"` | Verifies config + metadata, publishes installer, `.blockmap`, `nightly.yml` |
| End-to-end | Installed app: manual "Check for Updates…" → download → install and restart | New version in the uninstall entry and in the app's own version; journal/technical details show the source line |
| Regression | Copy `win-unpacked`, delete its `app-update.yml`, run it | Shows the configuration copy (not the development copy) and no error box |
| Diagnostics | `node apps/desktop/scripts/fife-doctor.mjs` on a healthy install, then with the feed URL blocked | Healthy exits 0; blocked exits non-zero naming the failing step |

## 7. Release and recovery

- Phase 1 lands as ordinary commits on `master`; no persistence, session-format, or wire change.
- Ship the product change before the next release so the release driver's gate (T4) is present when it publishes; if the gate lands later, publish nothing until it does.
- Recovery: revert the commits and rebuild; published releases remain valid because the feed and version scheme are unchanged.
- The T1 data merge is reversible from `~/.dsh.backup-<timestamp>`; the development home is never modified.
- An installed app already at `.2` needs no migration; it will pick up the next release on its normal schedule (10-minute interval, focus, resume, or manual check).

## 8. Acceptance criteria

| ID | Observable outcome | Verifies |
| --- | --- | --- |
| AC1 | Launching the daily app opens the packaged fork build; its manual check reaches the GitHub feed and reports up to date or offers the newest release. | R1, R2 |
| AC2 | The development build shows an informational, localized "development build" state; it writes no error state, no failure backoff, and no error dialog. | R3, R4 |
| AC3 | A packaged build without a feed shows the configuration-specific message and technical details naming the missing config path. | R3, R4 |
| AC4 | `fife-release.mjs` refuses to publish a build whose packaged app lacks a valid feed or whose metadata disagrees with the built version. | R3 |
| AC5 | `fife-doctor.mjs` names the failing step for an absent feed, an unreachable feed, and a version mismatch. | R4 |
| AC6 | The official app remains usable as a backup under the approved mechanism (D1/D2). | R5 |

## 9. Remaining risks and decisions

| ID | Decision / risk | Owner | Consequence if unresolved |
| --- | --- | --- | --- |
| D1 | Coexistence scope for the official app: Option B (frozen portable copy, recommended) or Option A (identity split, Phase 2). | User | R5 stays unmet; Phase 2 not started. |
| D2 | If Option A: the fork's product name, app id, and `dsh://` protocol ownership. | User | Branding and deep-link behavior undecided; do not start Option A. |
| D3 | Data merge of development sessions/credentials into `~/.dsh` vs a fresh home. | User | T1 step 4 skipped; the user starts clean in the installed app. |
| RK1 | The installed app's `~/.dsh` may already contain sessions that collide with merged ones. | Implementer | Merge is additive by session id; verify the list and keep the backup. |
| RK2 | Adding a phase touches exhaustive maps and qualification fixtures. | Implementer | Typecheck and the focused suite catch it; the journal is deliberately not extended. |
| RK3 | Unsigned installers still trigger SmartScreen once per new installer. | Accepted | Unchanged behavior; documented. |
| RK4 | The feed is anonymous and unauthenticated by design (checksum verification only). | Accepted | Unchanged; the fork is a personal deployment. |
