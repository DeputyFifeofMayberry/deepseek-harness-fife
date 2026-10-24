# Research: session-scoped input recall (Up/Down arrow history) in the chat composer

Date: 2026-10-23. Read-only research for the feature request "pressing Up/Down in an agent chat cycles through previously submitted user inputs for that chat". Every claim carries a `path:line` citation; inferences are labeled; open questions are collected at the end.

## Summary

There is exactly one product chat composer: the `InputBar` component behind the `conversation.composer.bar` slot in `@deepseek-ai/dsh-client-ui-conversation`, rendered by the Web client (apps/web, and apps/desktop which hosts the same client). It is a Lexical `ContentEditable` whose arrow keys already route through a two-layer arbitration pipeline (`registerComposerKeymap` -> `SessionInputShell.arbitrate` -> `InputTriggerController.arbitrate`); today Up/Down only move the slash-command menu highlight when that menu is open and otherwise fall through to native multiline caret movement. No input-history mechanism exists anywhere in the repo.

The recommended design adds history capture and recall inside the existing per-session `SessionInputShell` (which already owns draft state, submit transactions, and per-session draft persistence to `localStorage['dsh.conversation.<sessionId>']`), extends the package-internal `ComposerKeyboard` face with a `recall(direction)` verb wired through the existing keymap arbitration, and persists a bounded per-session history list in its own localStorage-backed `defineStore` following the conversation-store pattern. Behavior spec: Up/Down recall only when the caret sits on the first/last line of the draft; Escape or any edit leaves recall; recalled text goes through `setDraft` so chips/claims keep working; command (`/`) and attachment-only submissions need a product decision on capture.

## 1. Surfaces inventory

Fact: the Web GUI client is a Vite build over the `@deepseek-ai/dsh-client-web` shell library; apps/web is the entry ("Web application entry: vite build over the @deepseek-ai/dsh-client-web shell library; dist/ served by apps/cli's dsh web", `apps/web/package.json:2-5`). The client's chat surfaces are `packages/client/ui-*` plugins.

Fact: the composer users type into is one component: `InputBar` (`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:46`), the default entry of the single slot `conversation.composer.bar` (`packages/client/ui-conversation/src/client/contract/slots.ts:282`, registered at `packages/client/ui-conversation/src/client/apply.ts:449`). The repo-wide slot wiring test asserts exactly one entry (`packages/client/ui-conversation/tests/apply-wiring.client.spec.tsx:81`). No other package fills that slot (searched `-F "conversation.composer.bar"` across `packages/client/*/src` and `apps/web/src`; only ui-conversation matches).

Fact: one `InputBar` serves both postures via the `variant: 'hero' | 'composer'` owner prop (`packages/client/ui-conversation/src/client/contract/slots.ts:438`; `packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx:148`). The hero (new-session landing) has no Session id (`sessionId === undefined` renders the inert Workspace-picker trigger, `InputBar.tsx:152-153,306-312`), so session-scoped history is naturally out of scope there.

Fact: continuable subagent children reuse the same composer through the standard `useInput`/`inputActions` channel; a read-only composer replacement exists only for addressed children that cannot accept input (`packages/client/ui-subagent/src/client/SubagentReadOnlyComposer.tsx:15-17`).

Fact: there is no terminal/REPL chat surface. apps/cli is a launcher (its `src/` holds args/bin/profile-boot/launcher files only, no readline/TUI chat loop), and headless `dsh --profile` runs one-shot (searched `readline|ink@|prompts|@clack|enquirer` across apps/cli, packages/core, packages/boot; the only matches are the word "prompts" in unrelated code). The ACP surface is automation-only (root AGENTS.md "acp/ automation-only ACP").

Fact: apps/desktop is the "Electron desktop shell for a bundled dsh runtime and external plugins" (`apps/desktop/package.json:2-3`) — it hosts the same Web client bundle, so any composer change reaches both automatically.

Conclusion (inference): the entire feature is contained in `packages/client/ui-conversation` plus its tests and docs. No host (packages/host) or BFF (packages/api) change is required.

## 2. Current keyboard handling in the composer

The text surface is a Lexical editor owned by the per-session input shell and bound into the bar (`InputBar.tsx:8-13,74-76`). Key routing is a registered Lexical command keymap plus an arbitration chain:

- Keymap registration: `registerComposerKeymap(editor, handlers)` in `packages/client/ui-conversation/src/client/input/editor/keymap.ts:60-187`, installed by the bar's effect `installDraftKeymap(editor, keyboard, gate)` (`InputBar.tsx:267-270`, implemented at `packages/client/ui-conversation/src/client/input/editor/view-binding.ts:106-145`).
- ArrowUp/ArrowDown: registered at `COMMAND_PRIORITY_CRITICAL` (`keymap.ts:105-106`), delegating to `handlers.arbitrate('up'|'down', composing)` (`keymap.ts:83-90`). If arbitration returns anything other than `'pass'` the key is consumed (`preventDefault`); `'pass'` falls through to `@lexical/plain-text` defaults, i.e. native caret movement in the multiline editor (module doc `keymap.ts:1-7`).
- Arbitration chain: `view-binding.ts:112` -> `SessionInputShell.arbitrate` (`packages/client/ui-conversation/src/client/input/facade.ts:440-442`, returns `'pass'` when no trigger pipeline is mounted) -> `InputTriggerController.arbitrate` (`packages/client/ui-input-trigger/src/client/controller.ts:265-313`). When the slash-command menu is closed it returns `'pass'` unconditionally (`controller.ts:268`); when open, `up`/`down` move the highlight and are consumed (`controller.ts:270-277`).
- Enter: `keymap.ts:135-158`. Alt/AltGraph and Ctrl+Meta combos return early; plain Shift+Enter keeps the native line break (`keymap.ts:141`); IME-composition Enter is handed to the IME (`keymap.ts:142-146`); menu-open Enter picks the highlighted candidate (`keymap.ts:149-152`); otherwise plain Enter submits through `handlers.submit(accelerated)` (`keymap.ts:153-157`), which resolves the queue/steer mode and calls `keyboard.submit(...)` (`view-binding.ts:119-138`, `resolveSubmitMode` from `packages/client/ui-conversation/src/client/input/submission-policy.ts`). Held-down Enter cannot machine-gun sends (`keymap.ts:154`).
- IME/composition guard: `isComposingEvent` covers `isComposing`, keyCode 229, and a 10 ms post-`compositionend` window for Safari (`keymap.ts:47-52,60-81`). Any history recall binding must reuse this guard exactly as arrows already do.
- Live-state pattern: the bar's keymap handlers read changing state through a `gate` ref refreshed each render (`InputBar.tsx:251-260`), so a history-recall handler can follow the same pattern without re-registering the keymap.
- Keybinding infrastructure distinction: application-level shortcuts live in the separate `dsh-client-shortcuts` registry (editable bindings, stop shortcut, Mod+/. reference UI — `packages/client/ui-shortcuts/README.md:5-7`). That registry reserves bare arrows and unmodified Enter so applications cannot claim them (`packages/client/shortcuts/src/configuration.ts:104-111`); composer editing keys are intentionally Lexical commands, not registry entries. History recall belongs in the Lexical keymap, not the shortcuts registry.

Negative result: ArrowUp/ArrowDown currently do nothing composer-specific when no menu is open (native caret movement), and there is no draft-history, "recent inputs", or recall feature anywhere in packages/client or apps/web (searched `input history|prompt history|recent input|recall` — the only "recall" hits are the unrelated window-drag region recall in `packages/client/web/src/window-drag/`).

## 3. Prior art to model after

All in `packages/client/ui-conversation` unless noted:

1. Per-session draft persistence (the closest analog). The `SessionInputShell` mirrors every published draft change into a Conversation store and seeds it back on session bind: `bindDraftPersistence` (`facade.ts:635-640`), publish-time write (`facade.ts:937-945`), and the seed `shell.setDraft(readConversationDraft(binding.sessionId))` at shell construction (`packages/client/ui-conversation/src/client/input/hub.ts:170`). Storage is localStorage under `dsh.conversation.<sessionId>` (`packages/client/ui-conversation/src/client/stores.ts:8,43-56`), decoded through a zod schema accepting the legacy plain-string form (`packages/client/ui-conversation/src/client/draft.ts:55-68`). This proves both the per-session scoping key convention (`SessionId`-suffixed localStorage keys) and the read-before-publish bootstrap ordering.
2. Failed-send draft restoration: failed default sends are retained and rebuilt into the editor in submission order, with undo history cut (`facade.ts:809-844`). This is the in-shell precedent for "put remembered text back into the editor programmatically".
3. Programmatic draft write: `setDraft(text)` replaces the whole draft, placeholder-sanitizes, lands the caret at the end, and supports semantic documents with reference chips and a command token (`facade.ts:221-229`, `facade.ts:124-131` via `InputActions.setDraft`). A recall implementation should reuse it rather than splice the editor directly, so `/command` chips and `@references` in recalled text re-claim correctly (`pendingCommand` restore path, `facade.ts:247-263`).
4. Queued-message editing (not submitted-message editing): `QueueDock` supports editing a not-yet-sent queued message (`packages/client/ui-conversation/src/client/queue/QueueDock.tsx:126`, copy `locales.ts:747,755`). There is no edit-last-submitted-message feature; none is needed for this request.
5. Composer preference surface: the busy-Enter (queue vs steer) preference is a typed schema field stored in the Host user-settings document (`packages/client/ui-conversation/src/submission-settings.ts:1-33`, settings row at `packages/client/ui-conversation/src/client/settings/EnterBehaviorRow.tsx`). If history needs a user-level toggle or depth setting, this is the pattern.
6. Editor undo-history discipline: sends cut the editor's undo history so sent content cannot resurrect (`facade.ts:715-723`). Recall intentionally re-introduces past content, so its design must state how it interacts with this discipline (see design).

## 4. Data sources for per-chat history

What the client already has:

- Fact: the client receives every durable session event, including `user/message`, through the Session Controller: cold history is paginated host-side by `SessionHistoryController` with `MESSAGE_TYPES = Set(['user/message', 'assistant/message'])` and `DEFAULT_MAX_MESSAGES = 50` (`packages/api/session-controller/src/history.ts:35-37`), and live events follow through the session follow stream (same file; client-side window held by `MutableSessionEventSource`, `packages/api/session-controller/src/client/sessions/session.ts:166-167`).
- Fact: the Chat node model classifies `user/message` events into `user` (turn-opening human input), `steering`, and `context` nodes, carrying `event.data.content` and `event.data.source.kind` (`packages/client/ui-chat/src/client/conversation-nodes/message.ts:62-131`; human classification at `:76,104-110`). These nodes are readable from the keyed `ChatNodeStore` (`packages/client/ui-chat/src/client/contract/snapshot.ts:35-56`).
- Inference: past user prompts for the current session can be enumerated from data the client already fetches, but only the loaded window (history pages load lazily from the tail, `docs/subsystems/conversation.md:276`). A session whose early turns are not yet paged in would present an incomplete history if sourced from the node store. Deriving from the transcript also goes blank before a re-opened session's first history page arrives.
- Fact: host-side stores exist but are not client browsers stores: `packages/storage` is "optional and host-side: they do not expose tools, prompt content, or session events to the model" (`packages/storage/README.md:11`), and `packages/settings` owns schema-derived plugin configuration forms, not browser state (`packages/settings/README.md:1-11`).
- Fact: the only client-side persistent store is `@deepseek-ai/dsh-client-store`: zustand-vanilla + immer snapshot stores with opt-in whole-value JSON localStorage persistence (`packages/client/store/src/index.ts:1-8,139-161`), keyed per session via `handle.create(scopeKey)` where the scope key is the session id (`packages/client/store/src/index.ts:186-192`).

Negative result: no existing feature stores submitted user input client-side; only the un-submitted draft is persisted (see prior art 1).

Conclusion: two viable sources exist — (A) capture each successful submission client-side at commit time into a per-session localStorage list (complete across restarts, independent of transcript paging), optionally seeded from already-loaded transcript nodes; or (B) derive purely from loaded `user` transcript nodes (zero new storage, but incomplete and binding-lifetime-bound). The design below picks A; B is the fallback alternative.

## 5. Client state management and where history state lives

Fact: state management is the `@deepseek-ai/dsh-client-store` engine (zustand vanilla + immer + subscribeWithSelector; React selector hooks are synthesized by ui-renderer) (`packages/client/store/src/index.ts:1-8`). The composer subscribes via the standard provide channel: `useInput(s => s)` publishes `InputState` and `inputActions` expose verbs (`InputBar.tsx:55,124-137` in facade); `InputState` is `{ draft, attachmentIds, draftRev, phase, claim?, occurrences, queue }` (`packages/client/ui-conversation/src/client/contract/input.ts:282-296`).

Fact: the natural owner of history state is `SessionInputShell` (package-private, one per retained `SessionBinding`, `hub.ts:55-56,96-172`): it already owns the editor, the submit machine, the draft mirror, and the package-internal `ComposerKeyboard` face that the bar binds (`hub.ts:186-195` — "package-internal — handed through the composer-bar entry's inject, never across a plugin boundary"). Extending `ComposerKeyboard` (`packages/client/ui-conversation/src/client/contract/draft-editor.ts:64-96`) with a recall verb therefore crosses no plugin boundary. The shell dies with the session scope (`actx.effect` teardown, `hub.ts:145-163`), so volatile navigation state (current index, saved in-progress draft) resets cleanly per session bind while the persisted history list survives restarts.

## 6. Conventions and testing checklist

- Typed i18n: any new user-visible copy (aria-labels, placeholder hints, tooltips) goes in the `conversation` namespace dictionary — zh is "the key-set source of truth" with an en mirror (`packages/client/ui-conversation/src/client/locales.ts:1-13`); `verify-client-ui-i18n` rejects hardcoded copy in client sources including `aria-label`/`placeholder` attributes and `*Label|*Text|*Title|*Tooltip`-suffixed props (`scripts/verify-client-ui-i18n.ts:1-38`); dictionary parity is gated by `scripts/locale-dictionary-parity.spec.ts`. If the feature adds no visible copy (pure behavior), no dictionary change is needed.
- Tests today:
  - Unit/behavior (jsdom+Lexical): `packages/client/ui-conversation/tests/input-bar.client.spec.tsx` (Enter semantics, IME guard, busy-Enter policy — file docstring at `:1-3`, "Enter semantics" describe at `:721`), `tests/keymap-routing.client.spec.tsx` (`:13,47,112`), `tests/input-matrix.client.spec.tsx`, `tests/input-scenarios.client.spec.tsx`, `tests/draft-hub.client.spec.tsx`, `tests/conversation-store.client.spec.tsx`. History capture/recall unit tests belong here.
  - Browser evidence: apps/web e2e (`pnpm run test:web`, "required Linux PR gate", `docs/testing.md:15`) has composer scenarios: `apps/web/tests/composer-shortcuts.e2e.ts` (keyboard chords against `[data-composer-input][contenteditable="true"]`, `:21`), `composer-draft-scroll.e2e.ts`, `composer-focus.e2e.ts`, `composer-placeholder.e2e.ts`; drafts are typed via `writeComposerDraft` (`apps/web/tests/support.ts:271`). An Up/Down recall e2e (type, send, press ArrowUp, assert recalled text; multiline caret-conflict case) belongs beside them.
- Recorded-session snapshot policy: "Every non-trivial model-, protocol-, or human-visible change adds or updates a keyless recorded-session scenario in the same PR" (`docs/testing.md:53-55`), while output "not driven by a recorded session stays with its owning app, package, or script" (`snapshots/AGENTS.md:3`). Input recall changes no model-visible content, no session log event, and no transcript rendering; the defensible reading is package client specs + a UI-only web e2e golden, not a new `snapshots/web/` scenario. Flag for review (open question 5).
- Docs to update in the same PR: `packages/client/ui-conversation/README.md` (the "Shell and standard props" / composer sections describe the input behavior; every package README carries Model Experience and Known Limitations sections, `packages/README.md:105`), and the Conversation subsystem doc only if it gains an input-behavior section (`docs/subsystems/conversation.md`). `docs/architecture.md`'s extension map applies to model/session capabilities, not composer interactions — no change expected (`docs/architecture.md:138-160`). `docs/cookbook/adding-a-tool.md` is unrelated (model-facing tools).
- Defensive patterns: `docs/defensive-patterns/client-components.md` covers client component/state review principles and applies to the new recall state (per root AGENTS.md instruction to read it before changing "client component or state").
- No Agent Note is required: "Mechanical or local edits, including local UI presentation and interaction changes, are exempt" (`.agents/notes/README.md`, "When to write one") — unless a product call below produces durable decision rationale.
- Model-visible ⟺ logged is not violated: recall only re-fills the draft; a re-submitted recall creates a fresh, normally logged `user/message` (`packages/core/agent-loop/src/agent.ts:430-439`). No `SessionEventMap` change, hence no SDK expected-output updates.

## 7. Recommended design

All file paths below exist today unless labeled "(new)".

1. Capture: in `SessionInputShell`, append the committed draft text to a per-session bounded history list at successful send commit — hook `commitSend` (`facade.ts:362-366`) or the `sink-settled ok:true` path; capture the plain clipboard projection (`this.projection.clipboardText` / `draftSnapshot.text`). Skip empty submissions (already impossible: empty drafts reject, `facade.ts:389`) and decide explicitly about command submissions and attachment-only sends (open question 2). Collapse a consecutive duplicate of the last entry (shell-level, like shell history).
2. Persistence (new store): `dsh-input-history.ts` (new) in `packages/client/ui-conversation/src/client/` declaring `defineStore({ persist: 'dsh.input-history', ... })` following `stores.ts:22-36`, instantiated per session with `create(sessionId)` (`packages/client/store/src/index.ts:186-192`) so storage lands at `dsh.input-history.<sessionId>`; bound on entry (append + trim to a constant cap, e.g. 50, mirroring the host's history page size, `packages/api/session-controller/src/history.ts:35`) and read at `shellFor` construction next to the draft seed (`hub.ts:170`). Keep it a separate store: the conversation store persists whole-value on every draft keystroke (`facade.ts:937-945`), and mixing a growing list into that write path would multiply localStorage churn. Alternative considered: one root-scope key holding a `Record<SessionId, entries[]>` map — fewer localStorage entries but unbounded growth across sessions and no per-session trimming; rejected.
3. Recall verb: extend `ComposerKeyboard` (`contract/draft-editor.ts:64-96`) with `recall(direction: 'previous' | 'next')` implemented on `SessionInputShell` (structural satisfaction already routes the whole face, `hub.ts:193-195`). State kept in the shell: `historyIndex` and the pre-navigation in-progress draft (saved on first `previous` of a navigation session; restored when navigation walks back past index 0 or on commit). Recall applies through `setDraft(recalledText)` (`facade.ts:221-229`) so placeholder sanitization, chip/command restore, and the publish/persist path all behave; on next successful send the navigation state clears.
4. Keymap wiring: in `registerComposerKeymap` (`keymap.ts:83-90,105-106`), before consulting menu arbitration, evaluate a caret-position guard and consume the key when the bar claims it. Guard: ArrowUp recalls only when the caret is on the first line of the draft; ArrowDown only when navigating history, or when on the last line with navigation active to return to the in-progress draft. Line detection uses the editor selection's anchor range versus the document's first/last line breaks (Lexical selection API; test engines stub via `fireEvent.keyDown`, matching `keymap-routing.client.spec.tsx`). The existing IME guard applies unchanged (`keymap.ts:47-52`): composition-closing arrows never recall. Any edit (editor update, `facade.ts:191-211`) or Escape exits navigation mode and restores the saved in-progress draft when the user walks off the newest entry. Failed sends that auto-restore drafts (`facade.ts:809-844`) also cancel navigation.
5. Bar wiring: add `recall` to the handlers object built in `installDraftKeymap` (`view-binding.ts:111-144`) gated by live bar state through the existing `gate` ref pattern (`InputBar.tsx:251-260`): no recall while `locked`/`machineBusy`/menu open. No new slot, no new i18n copy required for the minimal version (open question 4 may add a placeholder hint like `placeholder.recall`).
6. Scope discipline: hero variant has no session and no keyboard face, so it is unaffected (`slots.ts:438`, `InputBar.tsx:152-153`). Subagent continuable children get the feature for their own session id automatically, since everything keys on the SessionBinding.
7. Docs and tests in the same PR: README composer section, the unit specs named in section 6, and one composer e2e asserting recall + multiline caret conflict + persistence across page reload (localStorage survives; the e2e scaffold reuses one workspace, `apps/web/tests/composer-shortcuts.e2e.ts:11-18`).

Decisions needing a product call: capture triggers (successful send vs any submit attempt — 7.1), command (`/`) and attachment-only submissions in or out of history (open question 2), cross-restart persistence on/off (open question 3), caret-position guard vs single-line-only navigation (open question 1), and any visible affordance/hint (open question 4).

## 8. Open questions for the user

1. Multiline conflict policy: recall only when the caret is on the first (Up) / last (Down) line — recommended; or a modifier chord; or single-line drafts only. The composer is multiline (Shift+Enter newline, `keymap.ts:141`), so the naive "Up always recalls" would break caret movement inside multi-line drafts.
2. What counts as a history entry: successful default sends only, or also claimed `/command` submissions (whose args ride a claim transaction) and attachment-only sends? Recommended: default sends only, matching shell history's "what you typed" intuition.
3. Does history persist across app restarts (localStorage, like drafts) or live only for the app session (in-shell, reset on reload)? Recommended: persist, bounded per session.
4. Any visible affordance beyond the key gesture — placeholder hint, tooltip on the send button, or aria-live announcement on recall? Any copy must go through the `conversation` locale dictionaries (i18n gate).
5. Snapshot tier confirmation: package client specs + UI-only web e2e golden without a new recorded-session scenario — is that the accepted evidence tier for this human-visible but non-transcript change?
6. Should recall skip steering/queue duplicates (same text already pending in `InputState.queue`)? Current design: no filtering; product call.

## 9. Citation list

- `apps/web/package.json:2-5` — web entry over dsh-client-web.
- `apps/web/tests/composer-shortcuts.e2e.ts:1-30` — composer keyboard e2e pattern; `apps/web/tests/support.ts:271` — `writeComposerDraft`.
- `apps/desktop/package.json:2-3` — Electron shell hosting the web client.
- `docs/testing.md:15,53-55` — test:web gate; snapshot-required policy.
- `docs/architecture.md:138-160` — where new behavior goes (no composer row).
- `docs/subsystems/conversation.md:5,276` — assembly layer; tail-paged history.
- `snapshots/AGENTS.md:3` — owner-local expected output rule.
- `packages/client/store/src/index.ts:1-8,139-161,186-192` — store engine; localStorage persistence; per-session scope keys.
- `packages/client/shortcuts/src/configuration.ts:100-111` — reserved keys (arrows/Enter).
- `packages/client/ui-shortcuts/README.md:5-7` — application shortcut registry scope.
- `packages/client/ui-chat/src/client/conversation-nodes/message.ts:62-131` — user/message classification and content.
- `packages/client/ui-chat/src/client/contract/snapshot.ts:35-56` — ChatNodeStore face.
- `packages/client/ui-conversation/src/client/apply.ts:343,449-470` — composer bar slot registration and inject.
- `packages/client/ui-conversation/src/client/contract/slots.ts:282,438` — slot; hero/composer variant.
- `packages/client/ui-conversation/src/client/contract/input.ts:282-296` — InputState.
- `packages/client/ui-conversation/src/client/contract/draft-editor.ts:50-53,64-96` — ArbitrateKey/Outcome; ComposerKeyboard face.
- `packages/client/ui-conversation/src/client/input/hub.ts:55-56,96-172,186-195` — InputHub; shell construction and draft seed; keyboard face ownership.
- `packages/client/ui-conversation/src/client/input/facade.ts:124-137,191-211,221-229,362-366,385-432,440-442,715-723,809-844,937-945` — actions, editor update, setDraft, commitSend, submit, arbitrate, draft commit/undo cut, failed-send restore, draft persistence.
- `packages/client/ui-conversation/src/client/input/editor/keymap.ts:1-16,47-52,60-106,135-158` — keymap, IME guard, arrows, Enter.
- `packages/client/ui-conversation/src/client/input/editor/view-binding.ts:106-145` — installDraftKeymap handlers.
- `packages/client/ui-conversation/src/client/input/machine.ts:1-11,40+` — SubmitMachine roles.
- `packages/client/ui-conversation/src/client/input/submission-policy.ts` — resolveSubmitMode.
- `packages/client/ui-conversation/src/client/draft.ts:55-68` — persisted draft decoding.
- `packages/client/ui-conversation/src/client/stores.ts:8,22-36,43-56` — conversation store and per-session draft read.
- `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:46-62,152-158,251-270,306-312,327-342` — composer component, states, gate ref, keymap install, workspace trigger, primary submit.
- `packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx:148` — hero/composer variant selection.
- `packages/client/ui-conversation/src/client/locales.ts:1-13,747,755` — dictionary convention; queue edit copy.
- `packages/client/ui-conversation/src/client/settings/EnterBehaviorRow.tsx`, `packages/client/ui-conversation/src/submission-settings.ts:1-33` — busy-Enter preference pattern.
- `packages/client/ui-conversation/src/client/queue/QueueDock.tsx:126` — queued-message editing.
- `packages/client/ui-conversation/README.md:5-23,54-56,178` — package surface docs to update.
- `packages/client/ui-input-trigger/src/client/controller.ts:265-313` — menu arbitration (closed menu = pass; up/down = highlight move).
- `packages/client/ui-subagent/src/client/SubagentReadOnlyComposer.tsx:15-17` — read-only composer replacement.
- `packages/api/session-controller/src/history.ts:35-37` — host history pagination (user/message + assistant/message, 50-message pages).
- `packages/api/session-controller/src/client/sessions/session.ts:166-167` — client event window source.
- `packages/core/agent-loop/src/agent.ts:430-439` — user/message appended to the session log.
- `packages/storage/README.md:11`, `packages/settings/README.md:1-11` — host-side scope of storage/settings groups.
- `scripts/verify-client-ui-i18n.ts:1-38`, `scripts/locale-dictionary-parity.spec.ts` — i18n gates.
- `packages/client/ui-conversation/tests/input-bar.client.spec.tsx:1-3,721`, `tests/keymap-routing.client.spec.tsx:13,47,112`, `tests/apply-wiring.client.spec.tsx:81` — existing composer test coverage.
- `.agents/notes/README.md` ("When to write one") — interaction changes are exempt from Agent Notes.
