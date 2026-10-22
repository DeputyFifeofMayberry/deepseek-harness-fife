# Plan Review Report — Desktop update source: permanent fix

## Verdict

**CONDITIONAL.** Phase 1 (T1–T5) is ready to execute: the root cause is verified, the product change is bounded, and the verification steps are observable. Phase 2 (T6, official-app backup) is deliberately gated on decisions D1/D2; D3 gates the one-time data merge.

## Review scope and evidence

- Review tier: **Standard** for Phase 1, **Deep** lens on Phase 2 (installer identity, user data, protocol handler, migration).
- Baseline inspected: the `master` worktree (dirty with unrelated `packages/client/**` edits, not part of this plan).
- Evidence sources: source at the cited lines; running processes (`Get-CimInstance Win32_Process`), the listening socket on `127.0.0.1:55213`, the installed application directory and `resources\app-update.yml`, the HKCU uninstall entry, the updater cache, GitHub releases via `gh`, and the pinned electron-updater 6.8.9 build in `node_modules/.pnpm`.
- Not inspected: the production macOS signing path; CI workflows; the upstream COS feed; any Windows signature qualification record.
- Independent verification: a fresh-context reviewer re-checked the plan's file:line claims and consumer inventory (result recorded in "Independent review result").

## Findings

| ID | Severity | Evidence status | Finding | Evidence/reference | Resolution | State |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Blocker | Verified | The plan's subject was ambiguous: the error is produced by the unpackaged development build, while the packaged installed app works. A plan that "fixed the updater" without naming the surface would fail its objective. | `apps/desktop/src/update-coordinator.ts:55`; PID 27824/22584 command lines; installed `app-update.yml`; registry `DisplayVersion 0.2.1-rc.2.20261020.2` | Plan §3 separates C1 (launch surface) from C2 (packaging configuration); §4 fixes each at its owner. | Resolved |
| F2 | High | Verified | The previous plan accepted the development-build dead end as a risk, which is exactly what recurred. The plan must treat the misleading failure as a product defect, not documentation debt. | `.zcode/plans/plan-session_6ca51f7cedded095332c66e80d210117.md` "Risks and notes" item 1 | T2 introduces a non-error `unavailable` state with localized copy and tests. | Resolved (in plan) |
| F3 | High | Verified | A packaged build can still lack an update source (`DSH_DESKTOP_UNSIGNED=1` outside the fife deployment → `publish: null`), reproducing the same message with no build-time signal. | `apps/desktop/scripts/electron-builder-config.mjs:100,266`; `apps/desktop/packaging/README.md` unsigned-build section | T4 adds a release gate that verifies packaged `resources/app-update.yml` and emitted `nightly.yml` before `gh release create`, with unit tests. | Resolved (in plan) |
| F4 | High | Verified | Adding `phase: 'unavailable'` to `DesktopUpdateState` would be written into the durable update journal, whose qualifier rejects unknown phases. Silent corruption of installed-update qualification evidence. | `apps/desktop/scripts/installed-update-qualification.ts:129-161` | T2 step (a) excludes `unavailable` states from journal writes; plan §4.5 makes this a stated invariant. | Resolved (in plan) |
| F5 | Medium | Verified | The manual-check failure path surfaces only the raw internal message as "technical details", giving no feed, channel, config path, or version to act on. | `apps/desktop/src/main.ts:531-542`; `apps/desktop/src/update-presentation.ts:24-38` | T3 attaches a single source diagnostic line to every failure and logs it at startup; adds `fife-doctor.mjs`. | Resolved (in plan) |
| F6 | Medium | Verified | The coordinator's own tests never exercise the unsupported-source path: the fixture injects `enabled: () => true` while the module mock sets `isPackaged: false`. | `apps/desktop/tests/update-coordinator.spec.ts:9-11,67-70` | T2 test scope requires new coordinator cases asserting `unavailable` and no `failedOperation`. | Resolved (in plan) |
| F7 | Medium | Likely | The development build's repeated failing check raises the schedule backoff and leaves an error state in the status indicator as if the feed were broken; the user cannot distinguish a structural limitation from an outage. | `apps/desktop/src/update-schedule.ts:93-104`; `apps/desktop/src/update-coordinator.ts:184-198` | T2 returns before any failure state, so no backoff and no error indicator. | Resolved (in plan) |
| F8 | Medium | Verified | The user's active work is in the development home; switching launch surfaces without a migration loses continuity. Copying `profiles/` would repoint the installed app at the checkout runtime. | `apps/desktop/scripts/dev.ts:66-67`; home directories inspected | T1 step 4 copies only sessions/storages/attachments/credentials/anonymous id, never `profiles/` or `dsh-runtimes/`, with a timestamped backup and a recorded revert. | Resolved (in plan) |
| F9 | Medium | Verified | Requirement R5 (official app as a standalone backup) cannot be met while the fork keeps the upstream app id: both apps share install directory, uninstall identity, Electron user data, and the `dsh://` handler. | `apps/desktop/.env.windows`; `apps/desktop/scripts/electron-builder-config.mjs:108-119`; `apps/desktop/src/single-instance.ts:20` | T6 presents Option B (frozen portable copy with its own `--user-data-dir`, recommended) and Option A (identity split) with D1/D2 approval. | Open (decision D1/D2) |
| F10 | Low | Verified | The updater cache retains the `.2` installer and `pending/` after a completed install (~288 MB per release cycle). | `%LOCALAPPDATA%\@deepseek-aidsh-desktop-updater` | Not a correctness defect; accepted, and `fife-doctor` reports the cache so it is visible. | Risk accepted |
| F11 | Low | Verified | A development run writes no update journal (journal requires `DSH_DESKTOP_UPDATE_JOURNAL_DIR`), so the plan must not claim dev runs pollute qualification evidence. | `apps/desktop/src/main.ts:331-332` | Plan states only that `unavailable` states are excluded from journaling; no claim of dev-run pollution. | Resolved (in plan) |
| F12 | Medium | Verified | Adding a client-visible "unavailable" surface changes product-visible copy, which is locale-owned and gate-checked; a hardcoded string or a missing zh key fails the build. | `packages/client/ui-settings-general/src/client/locales.ts`; client AGENTS localization rule | T2 lists both dictionaries and the `verify-client-ui-i18n` gate in §6. | Resolved (in plan) |

## Traceability and verification

| Requirement | Planned work | Measurable acceptance |
| --- | --- | --- |
| R1 daily driver = packaged fork app | T1 | AC1: Start-menu app opens the packaged build; version from the uninstall entry |
| R2 normal update checks/installs | T1, T6 (backup unaffected) | AC1: manual check reaches the feed; scheduled/focus checks use the existing schedule |
| R3 no recurrence | T2, T4 | AC2 (dev is informational), AC3 (misconfiguration names the cause), AC4 (release gate refuses) |
| R4 simple/repeatable/diagnosable | T2, T3, T5 | AC5 (`fife-doctor` names the failing step); T5 documents the workflow |
| R5 official app backup | T6 (D1/D2) | AC6 under the approved option |

Test plan coverage: coordinator state semantics (T2), presentation/localization (T2 client + locale), main-process manual-check branch (T2 `main-startup`), release-gate pure functions (T4), doctor helpers (T3). End-to-end qualification reuses the fork's existing release → check → download → install path and the installed-update qualification record where applicable.

Negative-path coverage: missing `app-update.yml`, wrong feed URL, wrong channel, metadata version mismatch, unreachable feed. Each has a named failing step in T4/T3.

## Open decisions and residual risks

Updated after execution on 2026-10-21: the three decisions were answered by the user's "do D3 and D1 and D2", and the outcomes are recorded in the change log's "Decisions and operator actions executed".

| Item | Owner | Impact | Next action |
| --- | --- | --- | --- |
| D1 coexistence option | User (decided) | Option B: portable frozen official copy at `%USERPROFILE%\DSH-Backup\official-0.2.1-rc.2`, isolated home and user data, updater disabled, Start-menu shortcut | None; launch it when needed |
| D2 product name/app id/protocol ownership | User (decided) | No identity change; the fork keeps `com.deepseek.harness`, the upstream name, and `dsh://` | None |
| D3 merge development data into `~/.dsh` | User (decided) | Merge executed with backup `~/.dsh.backup-20261021-071533`; 36 files added, credentials kept, all sessions present | None |
| RK1 merge collisions | Implementer (verified) | Additive copy skipped one existing file; every development session directory is present in the target | None |
| RK3 SmartScreen warning | Accepted | One prompt per new unsigned installer | Document only |
| RK4 unauthenticated feed | Accepted | Checksum-only trust | Document only |

## Review limitations

- No independent execution of the plan's commands was performed (no build, no tests, no installer run); verification is static plus live-state inspection.
- Phase 2 Option A was reviewed structurally; its installer/registry behavior on Windows was not exercised.
- The plan's end-to-end acceptance requires publishing real releases, which the reviewer did not perform.
- The fresh-context reviewer was stopped before returning a report; its independent result is unavailable and no independence is claimed (see "Independent review result").
- No claim is made that the launch surface, migration, or release gate were exercised; those are the plan's execution steps, not review evidence.

## Independent review result

A fresh-context reviewer was launched with the plan and the exact claims to re-check (gate lines, phase consumers, journal qualifier, release driver, command names, client locale surfaces). It did not return a report within this review window, so its findings are not incorporated and no independence claim is made. Instead the author performed a distinct final verification pass against the checkout: every §2.1 fact was re-read at its cited line, the phase-consumer inventory was re-derived (`apps/desktop/src/main.ts:601,543,851`; `packages/client/ui-settings-general/src/types.ts:17`; `DesktopUpdateIndicator.tsx:15`; `desktop-update-source.ts:32`), the command names were confirmed in the root `package.json`, and the plan's own consistency checklist was re-run (requirements → tasks → acceptance, preserved decisions, no new unresolved blocker). That limitation is recorded under "Review limitations".
