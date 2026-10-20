# Agent Note: Desktop background activity notifications

Status: implemented

English | [中文](2026-10-20-desktop-activity-notifications.zh.md)

## Problem

Users who close the Desktop window to the tray while a task runs have no way to learn that the task finished or that an approval waits for a decision, short of reopening the window and looking. Community feedback repeatedly requests native completion and approval notifications. The only native notification the shell raised was the silent mandatory-update prompt.

## Decision

Detection lives in the web client; presentation lives in the Electron shell. A client plugin observes the session catalog's `running` transitions for Host-listed sessions and wraps the approval Remote Event waterfall, reporting `task-complete`, `approval-request`, and `approval-resolved` over a new private IPC channel to the main process. The main process raises native notifications only while the product window is hidden, minimized, or unfocused, owns their lifetime (replace on newer approval, close on resolution, clear on focus, click restores and focuses), and gates everything behind `userData/desktop/settings.json` `notifications` flags that default to on for both kinds, with silent completions and audible approvals.

Session-level `running` convergence — not per-turn `turn/end` events — is the completion signal: a session that continues through queued or chained turns notifies once when its driver converges, and the first observation of any session is a baseline so boot, reconnection, and catalog replacement never fabricate a completion. Reports are presentation only: the shell validates the sender with the send-channel early-return convention, drops malformed payloads, and no report can authorize any action. Notification copy uses the shell locale, names at most the pending tool, and never includes tool arguments or transcript content. The [Desktop reference](../../../../apps/desktop/README.md#activity-notifications) owns user-facing behavior and the [shell configuration decision](2026-10-08-desktop-shell-configuration.md) remains the ownership precedent for the settings file.

## Alternatives considered

**Host push over the private control channel.** The Host already computes active-task facts, but the channel is request/response and a push protocol would bump `DESKTOP_HOST_PROTOCOL_VERSION`, touch the bundled runtime, and duplicate facts the renderer already observes. The renderer stays alive while the window is hidden, so the hidden-window case does not need Host involvement.

**Per-turn `turn/end` observation in the client.** Chat bindings exist only for opened session views, so background sessions were missed; per-turn reporting also spams chained runs and needs debounce machinery. Session-level convergence is the same axis the quit-inspection uses.

**Web Notification API in the renderer.** It bypasses the shell's suppression rules and locale copy, and the renderer cannot own native notification identity on Windows.

## Consequences

Finished tasks and pending approvals are visible without reopening the window, at the cost of one small client plugin, one send-channel, and one attention module mirroring the update attention's conventions. Wrong composition ordering of the approval wrapper would silently disable approval notifications; the plugin is composed before the approval presenter and an ordering test pins the wrapper's settlement. Hidden-window renderer throttling remains a runtime concern covered by manual acceptance, and system focus modes can suppress notifications regardless of this feature. Installed Windows and macOS notification attribution and qualification stay release requirements; `DSH_DESKTOP_APP_ID`, when present, is applied as the Windows AppUserModelId at startup.
