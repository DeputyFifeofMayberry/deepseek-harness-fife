# Final Implementation Plan — Effort-Policy Hardening and Token-Budget Tightening

- Status: CONDITIONAL
- Review depth: Standard (single-agent author-and-harden; independence limitation disclosed in the review report)
- Based on: findings from the 2026-10-22 review of the verifiability-based effort routing feature (landed in `master` 2026-10-22; M7 takeover complete) and the per-request token-anatomy audit; plan template and skill: `.agents/skills/plan-hardening/SKILL.md`, structure mirroring `.agents/plans/2026-10-21-verifiability-effort-routing/`
- Evidence baseline: working tree at `master`, 2026-10-22; live profile `~/.dsh/profiles/desktop/cordis.patch.yml`, dev-home profile `apps/desktop/.desktop-build/development/home/profiles/desktop/cordis.patch.yml` (git-ignored, user-owned)
- Required approvals: user approval for live-profile and dev-home config value changes (W1, W2, W3, W6, W7a, W7b); no upstream default changes are proposed

## 1. Objective and boundaries

Close the five review findings against the effort-policy deployment and land two token-budget reductions (lower compaction pressure threshold; tighter inline tool-result budgets), so that reasoning-effort routing works in every composition the user actually runs and long-session input cost drops measurably without touching upstream defaults or recorded-session snapshots.

Out of scope: PTC pilot (idea 3, deferred), skill-content budgets, the pre-send cost warning (rejected 2026-10-22), upstream changes to shipped defaults, npm publish of `@mayberry/effort-policy-core` (externally blocked; tracked, not executed).

## 2. Evidence and assumptions

Verified:

- Dev-home `agent-default-model` sets `reasoningEffort: high`; the policy never raises an exact Agent-level effort, so that composition neuters the policy (dev-home patch, row near top of file; rule documented in the patch comment and `packages/llm/effort-policy/src/service.ts:385-392`).
- The live profile has no `agent-default-model` effort and no `agent-preset-registry` override; the bundle default preset is `standard` (`packages/bundle/web-app/cordis.patch.yml:602-605`). The live patch restates only `preset-standard` (from line 86) with `effortPolicy: true` on both delegation rows (lines 220, 226). The dev-home patch additionally restates `preset-cordis` without the flags.
- `fetchMaxOutputChars` is an existing validated config field on `dsh-tool-web`, default `DEFAULT_FETCH_MAX_OUTPUT_CHARS = 200_000` (`packages/web/tool-web/src/index.ts:34`, schema at `:56-67`).
- `spill-policy` is bundle-mounted with `maxInlineTokens: 12500` (`packages/bundle/base/cordis.patch.yml:423-426`) and is absent from the preset restatement; whether bundle-level spill applies to preset-isolated agents is UNVERIFIED (assumption A1, tested in W7a).
- The `agent/pre-step` listener in `compaction-basic` (`packages/compaction/compaction-basic/src/index.ts:160-176`) currently calls only `compactIfNeeded`; pruning runs only inside the pressure/overflow paths (`index.ts:269-347`). `compaction/prune` is an existing durable event type (`packages/core/session/src/known-event-types.ts:32-35`), so step-boundary pruning needs no new event types.
- The effort-policy upgrade guide exists at `docs/upgrade-guide/v0.2.1-rc.2/effort-policy/` (`guide.md`, `guide.zh.md`, `guide.i18n.yaml`); the package README carries the required-event compatibility note (M7 ledger).
- The no-op `agent/request-error` passthrough listener sits at `packages/llm/effort-policy/src/service.ts:175`.
- Pruner budgets in the user's preset: `thresholdChars: 8192, headChars: 4096, tailChars: 1024` (both profile patches, compaction group).

Assumptions, each with a verification step:

- A3: the drafted test-verifier regexes match real `pnpm run test` output (W3 tunes against one real run).

Resolved during C-001 step 8 (2026-10-23, ledger `step-8-investigation`):

- A1, resolved: preset agents reach bundle-level `spill-policy`. `tools/post-execute` dispatches with a plain scoped-context `thisArg` (`packages/core/tools/src/index.ts:1790-1792`); the cordis listener filter engages only when the `thisArg` carries `Context.filter`, which only Service instances (`vendor/cordis/src/service.ts:61`) and service-event reflective contexts (`vendor/cordis/src/reflect.ts:332`) define; `events` is not an isolated service, so the shared root listener table applies unfiltered.
- A2, resolved: the live composition's effective `agent-preset-registry` is `default: standard` (`pnpm dsh --profile web --dump-config`, no user override), and the dump carries `effortPolicy: true` on all four delegation rows (two host rows, two inside `preset-standard`). The `cordis` preset is non-default and only hand-selectable.

## 3. Technical approach

Config-first. Every deployment-varying value lands in the user's two profile patches; upstream files change in exactly one place, the new default-off pruner flag, so recorded-session snapshots stay byte-identical and rollback is deletion of patch rows. The pruner extension reuses the existing `compaction/prune` event and shadow-replace mechanism; it prunes only nodes appended since the previous request, so a fat tool result is trimmed before its first trip to the provider and no cached prefix is ever broken by the pruner itself.

## 4. Implementation sequence

### W1 — Remove the dev-home effort pin (F1)

Edit `apps/desktop/.desktop-build/development/home/profiles/desktop/cordis.patch.yml`: delete the `reasoningEffort: high` line from the `agent-default-model` row. Keep the rest of the row (`provider`, `model`).

Done when: a dev-home boot (`DSH_HOME` pointed at the development home, `dsh --profile web --dump-config`) shows `agent-default-model` without `reasoningEffort`, and the `effort-policy` row composes unchanged.

### W2 — Close the `cordis` gap (F2)

The original verification step is answered (see A2 in section 2): the live composition defaults to `standard` with all four delegation flags, and `cordis` is non-default, hand-selectable only.

1. Dev home: add `effortPolicy: true` to the two `tool-subagent` rows inside the existing `preset-cordis` restatement (it already exists for the shell swap, and the dev-home registry override makes `cordis` the likely dev preset).
2. Live profile: add a one-line comment on the `effort-policy` row recording that the `cordis` preset carries no delegation flags and must not be selected for work that needs routing.

Done when: the dev-home restatement carries the flags and the live patch records the limitation.

### W3 — Add a test-failure verifier (F3)

Append a third verifier to the `effort-policy` row in BOTH patches, mirroring the existing bash/pwsh shape:

```yaml
- tool: bash
  commandPattern: 'pnpm( run)? test'
  passPattern: 'Test Files\s+\d+ passed'
  failPattern: '\d+ failed'
  outcome: text
```

(A pwsh twin is unnecessary: the PowerShell executor is disabled in both compositions.) The patterns are drafts per A3: run `pnpm run test` once, read its real summary lines, and tune `passPattern`/`failPattern` before relying on them. Note the tradeoff in the patch comment: the full unit suite takes minutes, so escalation lags that long behind a red suite; a targeted `pnpm vitest run <paths>` verifier is the faster alternative if lag matters.

Done when: a planted failing test raises effort (decision event `escalated`), a passing re-run clears it (`rule: base`), and an aborted run changes nothing.

### W4 — Verify the downgrade-risk documentation (F4)

Read `docs/upgrade-guide/v0.2.1-rc.2/effort-policy/guide.md` and `packages/llm/effort-policy/README.md`. Confirm each states that sessions written while the policy is enabled are refused by builds without the feature. If either omits it, add the two-sentence statement (bilingual pair for the guide; `pnpm run doc-sync` after). No code changes.

Done when: both documents state the constraint, or the gap is closed and `doc-sync` passes.

### W5 — Adapter cleanup and dependency tracking (F5)

1. Delete the passthrough listener at `packages/llm/effort-policy/src/service.ts:175` (`ctx.on('agent/request-error', (_payload, next) => next())`); it changes nothing. Sweep the package tests for assertions on that listener and update them. Run `pnpm exec vitest run packages/llm/effort-policy`.
2. Record a tracking note in the effort-policy README's implementation section: `@mayberry/effort-policy-core` remains on the `git+…#v0.1.0` pin until npm registration is restored; switching to a registry version is a one-line `package.json` change plus lockfile and `scripts/gen-third-party-notices.ts` re-run.

Done when: the package suite passes without the listener and the README names the pending registry switch.

### W6 — Lower the compaction pressure threshold (Idea 1)

Live profile, inside the `preset-standard` restatement's compaction group, give the `compaction-basic` entry (line ~194) a config block:

```yaml
- id: compaction-basic
  name: '@deepseek-ai/dsh-compaction-basic'
  config:
    thresholdRatio: 0.4
    retainRatio: 0.12
```

Add the same as a top-level patch row (`- id: compaction-basic`) so non-preset agents (headless one-shots, scheduled runs) match. Validation math for the 1,000,000-token default window: pressure threshold resolves to `min(0.4 × 1M, 1M − 256k − 65,536) = 400,000`; retained tail ≈ 89,280 tokens; `retainRatio (0.12) < thresholdRatio (0.4)` passes load-time validation.

Apply to one profile first (live), use it for a few real sessions, then mirror to the dev home. Expect more frequent summarization; that is the accepted tradeoff (quality knob, reversible in one line).

Done when: dump-config shows the values, and a long session's `contextPressure` projection stays at or under ~400k between compactions.

### W7 — Tighten inline tool-result budgets (Idea 2)

**W7a — Spill threshold.** A1 is resolved (section 2): spill already covers preset agents, so the change is a top-level live-patch row `- id: spill-policy` with `config: { maxInlineTokens: 4000 }`. The first fat tool result in a real session still confirms the spill footer appears at the new threshold before the milestone closes.

**W7b — Fetch output cap.** In the live patch's restated `tool-web` entry (line ~239), add `fetchMaxOutputChars: 60000`. Rationale: spill trims anything over ~4,000 tokens anyway; the cap bounds what reaches the durable log and any spill file in the first place, and it backstops W7a if the probe fails.

**W7c — Step-boundary incremental pruner (the one code change, default-off upstream).**

- `packages/compaction/compaction-tool-result-pruner`: extend the pruner entry point to accept a lower-bound sequence so only surface nodes at or above it are considered.
- `packages/compaction/compaction-basic`: new config field `pruneNewResultsAtStep` (default `false`) in `src/config.ts`; in the existing `agent/pre-step` listener (`src/index.ts:160-176`), when enabled, run the pruner over results appended since the previous step and remember the high-water mark per Agent.
- Design constraint: new-nodes-only. Pruning an old, already-cached result would break the provider prefix at that node; pruning the newest batch before its first request is prefix-safe by construction.
- Tests: unit test for the sequence bound; config/loader test for the new field; a profile fixture under `apps/cli/tests/profiles/` (pattern: `apps/cli/tests/profiles/effort-policy/`) whose scripted scenario writes an over-budget result and asserts the next request carries the pruned text.
- Upstream safety: flag off keeps every existing snapshot byte-identical; verify with `pnpm run test:snapshot`.

Enable `pruneNewResultsAtStep: true` in the user's preset compaction entries only after W7c lands and the fixture passes. Revisit `thresholdChars: 8192` downward (e.g. 4096) only after a week of real use.

Done when: a fresh fat result enters its first request pruned, older results are untouched by the step pass, upstream snapshots are unchanged with the flag off, and the fixture passes with it on.

## 5. Verification

In-repo changes (W5, W7c):

```
pnpm exec vitest run packages/llm/effort-policy packages/compaction/compaction-basic packages/compaction/compaction-tool-result-pruner
pnpm run typecheck
pnpm run lint
pnpm run test:snapshot        # must be unchanged by W7c with the flag off
pnpm run doc-sync             # after README/guide edits
pnpm run build                # before claiming completion
```

Profile-only changes (W1, W2, W3, W6, W7a, W7b):

- `pnpm dsh --profile web --dump-config` per home: rows parse, values compose, delegation flags cover every selectable preset.
- One real session per changed concern: effort rises and clears on the planted check (W3); compaction fires near 400k (W6); a fat tool result shows the spill footer at the new threshold (W7a); a large fetch returns the truncated cap (W7b).

Behavior observation across at least a few real sessions after W6/W7: turn-usage input tokens and the context meter should sit visibly lower on long sessions; quality of continued work is the user's call and the rollback is row deletion.

## 6. Release and recovery

- Everything user-side is profile YAML: rollback any item by deleting the added lines; upstream defaults never moved.
- The only upstreamable change (W7c) ships default-off, so upstream merge order is irrelevant and bisects stay clean.
- W5's listener deletion is behavior-neutral; revert is a one-line restore.
- W6 changes summarization cadence immediately on reload; if continued-work quality degrades, raise `thresholdRatio` in one step (0.4 → 0.55 → 0.8) rather than reverting outright.

## 7. Acceptance criteria

- F1: dev-home requests are no longer pinned to `high`; the policy writes `low` at base in a dev-home session.
- F2: dump-config proves `effortPolicy: true` on the delegation rows of every selectable preset, or the live patch records the limitation.
- F3: a failing `pnpm run test` escalates effort; the passing re-run clears it; infrastructure failures change nothing.
- F4: the upgrade guide and package README both state the required-event downgrade constraint.
- F5: the effort-policy suite passes without the passthrough listener; the README names the pending npm switch.
- I1: compaction engages near 400k tokens on the user's profiles; `contextPressure` confirms it across real sessions.
- I2: spill trims at 4,000 tokens for preset agents (or the preset restates spill-policy), `web_fetch` caps at 60,000 chars, and the step-boundary pruner trims new over-budget results with upstream snapshots untouched.

## 8. Remaining risks and decisions

- **Summarization quality vs. input cost (user decision, W6).** Lower thresholds summarize more often; each summary is lossy. Owner: user, via one real week of use at 0.4.
- **`cordis` preset restatement maintenance (accepted).** Any restated preset must be refreshed from `--dump-config` after upstream merges; that burden already exists for `preset-standard` and grows by one preset in the dev home (W2).
- **Test-verifier lag (accepted, W3).** Full-suite escalation lags minutes behind a red suite; acceptable while the typecheck verifier covers the fast loop.
- **npm registration (external blocker, F5).** The git-tag pin works; the registry switch waits on the account.
