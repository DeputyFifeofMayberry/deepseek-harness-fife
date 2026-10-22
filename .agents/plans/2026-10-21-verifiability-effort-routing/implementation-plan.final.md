# Final Implementation Plan — Verifiability-Based Effort Routing

- Status: CONDITIONAL
- Review depth: Deep
- Based on: `.agents/notes/proposed/architecture/2026-10-21-verifiability-based-effort-routing.md`; revised after two independent source-level reviews (2026-10-21)
- Evidence baseline: repository at `Y:\deepseek-harness_fife`, working tree 2026-10-21
- Required approvals: implementation approval; P0 contract sign-off before M0; Mayberry package name and adapter contract agreed in P0

## 1. Objective and boundaries

Route reasoning effort by operation rather than perceived difficulty: a session runs at a configured base, rises only when a named verification fails, and holds until that verification passes; delegated children start from their operation, not from the parent; one auxiliary call is pinned. No recorded session changes while the feature is off.

Out of scope: no client or UI change; no model-based classification; no rule DSL or configuration UI; no second notification mechanism; no new subagent provider capability.

## 2. Evidence and assumptions

Verified:

- `agent/request` is the only waterfall that changes `provider`, `model`, or `reasoningEffort`; it may not mutate messages (`packages/core/agent/src/runtime-types.ts:321-337`).
- Direct `ctx.llm.stream()` callers inherit no session effort; `compaction-basic` passes none (`packages/compaction/compaction-basic/src/summarizer.ts:152-162`), `session-title-llm` resolves one through `prepareCall` (`packages/session/session-title-llm/src/index.ts:252-258`).
- DeepSeek advertises `off`, `low`, `high`, `max`, defaulting to `high` (`packages/llm/llm-deepseek/src/model-info.ts:80-98`); `off` is a real request (`packages/llm/llm-deepseek/src/serialize.ts:147-156`).
- A route without reasoning metadata rejects any explicit effort (`packages/llm/llm/src/index.ts:918-936`).
- `agent/request` seeds later steps from the logged header (`packages/core/agent-loop/src/agent.ts:571-610`).
- `Session.append` writes no `ignorable` field; only `#appendRecord` does, and only for `plugin:` types (`packages/core/session/src/index.ts:798-850`). A declared `SessionEventMap` member is therefore **required-on-read**: an older build refuses a session containing it.
- `SUBAGENT_DESCRIPTOR_VERSION = 3` rejects unknown composition inputs (`packages/subagent/subagent/src/descriptor.ts:42-48`, `:103-110`); cold resume rebuilds only provider, model, and effort (`packages/subagent/subagent/src/manager.ts:1349-1375`).
- `resolveChildAgentOptions` is called with three arguments (`packages/subagent/subagent/src/manager.ts:390`) and copies the parent effort by default (`packages/subagent/subagent/src/child-agent.ts:98-119`).
- `consumeSelection` retires a pick only on exact effort equality (`packages/api/session-controller/src/agent.ts:320-326`); the durable projection retires `pending` on provider/model/effort equality with `stateVersion: 2` (`packages/api/session-controller/src/model-selection-projection.ts:39-55`); ACP has no Agent in `AcpModelControl` (`packages/acp/acp/src/model-control.ts:32-53`) and never appends `model/selection`.
- `gen-tsconfig-paths.ts` generates bare-name aliases only; subpath aliases are hand-written (`tsconfig.base.json:143`, `:185`).
- One committed scenario performs compaction: `snapshots/session/compaction-output-reserve/session.v4.jsonl` contains `compaction/summary` with `llmStreamCall: true`, and `dsh-llm-replay` derives its replay entry from that call (`packages/test-support/llm-replay/src/index.ts:453-485`).
- `doc-sync` includes `verify-persistence-changes`; adding a `SessionEventMap` member changes `docs/persistence-schema.json`, `docs/persistence-catalog.md`, its Chinese pair, and `known-event-types.ts` (`scripts/gen-persistence-catalog.ts:28-31`).

Assumptions, each tested in the milestone that relies on them:

- A session projection can fold the new event across resume. M3.
- A cold-resumed child loses `effortOperation`. Accepted and tested, not hidden (M4).
- `tool-subagent` rows and the policy row are configured together; a mismatch is a load-time-visible misconfiguration (M4, M6).

## 3. Technical approach

### 3.1 Levels, exact efforts, and resolution

`low` = `low` if advertised, else the lowest non-`off` effort, else `off`. `standard` = `defaultEffort`. `deep` = `max` if advertised, else the highest.

A user pick may be an **exact effort** outside the three levels (`off`, or any advertised id). `setBase` stores the raw string; an exact base is written verbatim and never escalated, because the user asked for that value and the policy has no better claim.

Resolution per request through `ctx.llm.resolveModelInfo()`. `resolveModelInfo` and `prepareCall` bind the adapter registration separately, so a models change between them can make the chosen effort unsupported; the adapter treats `UNSUPPORTED_REASONING_EFFORT` from its own write as "leave the request untouched" and records the fallback, rather than failing the turn. A route without reasoning metadata is always left untouched. When the resolved effort equals `defaultEffort`, nothing is written, so adapter-defaulted headers stay byte-identical.

### 3.2 Precedence

| Layer | Applies to | Wins over |
|---|---|---|
| User exact effort (`setBase('off')` or any id) | session | base config, mode pin, escalation |
| User level (`setBase('low'\|'standard'\|'deep')`) | session | base config |
| Mode pin (`plan` → `deep`) | session | base config and user level, never a user exact effort |
| Escalation | session | effective base, one level at a time |
| Delegation `reasoning_effort` | child | operation start, inheritance, config base |
| `inherit_effort: true` | child | operation start, config base |
| Operation start | child | config base |

Rules that make the table executable:

- The **effective session base** is the user level when set, else the config base; the mode pin raises it but never above a user exact effort.
- The **operation minimum** applies only to a model-facing `reasoning_effort` on a delegation. It never floors the session base, the config base, or an inheritance result.
- A child starts at its explicit `reasoning_effort` if given (rejected below the operation minimum), else the parent's current level when `inherit_effort: true`, else the operation start. The config base is never a child's start.

### 3.3 Evidence

Verifier rules are data: `{ tool, commandPattern?, passPattern, failPattern?, outcome: 'text' | 'error' }`.

Identity: `tool + "\0" + normalized arguments + "\0" + working directory`. Revision is **workspace-scoped**, not per Agent, because children mutate the same workspace: a child's mutation invalidates a parent's pending pass. Classification is three-way:

- known mutation (`write`, `edit`, configured) — increments;
- known read-only shell pattern — preserves, so `git status` does not discard evidence;
- anything else, including every unlisted command — increments.

The verifier run under evaluation never increments. A pass clears only when it has the same identity, is later than the failure, and is not older than the current revision. Everything else is stale and changes nothing. Infrastructure failures (authentication, quota, rate limiting, timeout, network, cancellation, overload) neither raise nor clear; the category set is config, default-deny, and an unknown code is infrastructure.

The `agent/request-error` listener awaits `next()` and returns its action, so `llm-retry` keeps owning recovery.

### 3.4 Durable state

One `SessionEventMap` member, `effort/decision`, emitted only on transitions: raise, clear, base change, mode-pin change. It carries `{ protocolVersion, rule, level | exactEffort, previous, operation?, evidenceId?, revision }`.

It is **required-on-read**, not `ignorable`: the current session writer cannot mark a declared event ignorable, and adding that capability to core is a larger change than this feature justifies. Consequence, documented in the upgrade guide and the package's known limitations: a build older than the one that wrote an enabled session refuses to open it. A deployment that never enables the policy writes no such event and stays fully compatible.

A registered session projection folds those records, keyed by Session, into `{ base, openEscalations }`; it is the only resume mechanism. The base lives in these records — `setBase` appends a `base-change` transition with the raw effort — so the policy does not read `model/selection` and the `packages/llm → packages/api` dependency does not exist. Callers pass a string, so they need no policy import; the controller and ACP each declare the one-method service type they use.

Durability rules proven in M3: replay in log order; per-Session isolation; `clear` starts empty; an undecodable record or a missing reconstruction keeps the last elevated state and appends the uncertainty. Fail closed.

### 3.5 Package layout and portability

`@deepseek-ai/dsh-effort-policy` exports `.` (adapter) and `./core`, backed by a real `src/core.ts` barrel re-exporting `types.ts`, `levels.ts`, `policy.ts`. Those three files import no Cordis, session, LLM, Node, or clock API. Explicit `paths` entries for both specifiers are hand-written in `tsconfig.base.json`, because the generator emits bare names only. `EFFORT_POLICY_PROTOCOL_VERSION` versions the boundary; the adapter refuses to start against an unknown version.

## 4. Implementation sequence

### P0 — Portability contract freeze (decision)

Agree with the Mayberry owner: package name, the `./core` surface (`EffortLevel`, `DelegationOperation`, `EffortCapability`, `Evidence`, `Decision`, `DecisionRule`, `resolveLevelEffort`, `decide`, `EFFORT_POLICY_PROTOCOL_VERSION`), the transition vocabulary, the precedence table in §3.2, and the rule that a divergent rule is a protocol version bump. Record it in the design note.

Done when the note holds the contract and the user confirms it. M0 does not start without it.

### M0+M1 — Portable core and disabled adapter (one change)

One change, because `verify-product-use` fails for a package with no product composition and `exports "."` needs `src/index.ts`.

Create `packages/llm/effort-policy/`: `package.json` (exports `.` and `./core`), `tsconfig.json`, `README.md` (model experience + known limitations, including the required-event compatibility note), `src/types.ts`, `src/levels.ts`, `src/policy.ts`, `src/core.ts`, `src/index.ts` (plugin, disabled), `src/config.ts`, `src/service.ts`, `tests/{levels,policy,import-boundary,loader-composition}.spec.ts`, `tests/fixtures/cordis.yml`.

Modify: `tsconfig.host.json`; `tsconfig.base.json` (bare and `/core` paths); `packages/llm/README.md`; `packages/bundle/base/cordis.patch.yml` (row `effort-policy`, `enabled: false`); `packages/bundle/base/package.json`; `scripts/gen-cordis-catalog.ts` (`SERVICE_PAGE` for `ctx.effortPolicy`).

Prerequisite: P0. Done when the unit suites pass, the import-boundary test fails on a probe harness import, `pnpm run doc-sync` passes, `pnpm run test:snapshot` is unchanged, and a loader test shows a disabled policy writes nothing.

### M2 — Compaction pin

Modify `packages/compaction/compaction-basic/src/summarizer.ts` to dispatch through `prepareCall` with a configure callback that resolves `low` only when the policy service is enabled; add the dependency; update `README.md`; add the enabled and disabled tests.

Prerequisite: M0+M1. Done when both tests pass and `snapshots/session/compaction-output-reserve` (and any other compaction scenario) replays unchanged with the policy disabled. This scenario exercises exactly this call path, so it is the compatibility gate, not an optional extra.

### M3 — Loop policy

Add `src/evidence.ts` (workspace revision, verifier classification), `src/projection.ts`, listeners in `src/index.ts`, `tests/{evidence,loop-policy,projection-resume}.spec.ts`.

Tasks, in order:

1. Probe `tools/result` for a shell command and for `write`; adjust the predicate data if it cannot distinguish outcome.
2. Implement evidence and revision; register the projection; add the listener set (`agent/request` `prepend: true`; `tools/result`; `agent/request-error` with `await next()`).
3. Add the persistence record `docs/persistence-changes/<date>-effort-decision/` (bilingual) and regenerate `docs/persistence-catalog.md`, its Chinese pair, `docs/persistence-schema.json`, and `packages/core/session/src/known-event-types.ts`.

Prerequisite: M0+M1. Done when escalation, infrastructure classification, stale evidence, resume, resume-after-compaction, decode failure, child isolation, and a route swap between resolution and dispatch are covered; `pnpm run doc-sync` passes with `verify-persistence-changes`.

### M4 — Delegation

Modify `packages/subagent/tool-subagent/src/index.ts`: config `effortPolicy` (default false) adds `operation`, `verification`, `inherit_effort` to the schema and writes `effortOperation` / `effortInherited` onto the child request. At first execution, when the flag is on but the service is missing or disabled, fail loud naming both rows.

Modify `packages/subagent/subagent/src/child-agent.ts`: read `requested.effortInherited === false` and delete the inherited `reasoningEffort`; no signature change, so `manager.ts:390` stays correct.

Declare `AgentOptions.effortOperation` and `effortInherited` in the policy package through declaration merging.

`packages/bundle/base` has two `tool-subagent` rows (`:380-395`); both receive `effortPolicy: true` in M6.

Prerequisite: M1, M3. Done when the four flag/service combinations are tested (on/on active; on/off loud; off/on fields absent, children standard; off/off today's behavior), parent-child isolation holds, minimums and overrides behave per §3.2, and a cold-resumed child is proven to start at `standard` with the limitation documented in the package README.

### M5 — Manual selection

Modify:

- `packages/api/session-controller/src/agent.ts` — retire `picked` on provider/model match, not effort; the exact selection record decides.
- `packages/api/session-controller/src/model-selection-projection.ts` — retire `pending` on provider/model, bump `stateVersion`, and test resume.
- `packages/api/session-controller/src/commands.ts` — after a successful selection call `setBase(agent, rawEffort)`.
- `packages/acp/acp/src/session.ts` — the Agent is here; call `setBase` there, not in `model-control.ts`, and test ACP resume.
- `docs/upgrade-guide/<next-version>/effort-policy/guide.md` — behavior, flags, selection semantics, and the required-event compatibility note.

Prerequisite: M3. Done when a pick of `off` stays `off`, a level pick sets the base, a stale acknowledgement cannot retire a newer pick, ACP resume keeps the base, and the policy no longer fights a selection.

### M6 — Fork enablement

Two rows in the fork overlay `$DSH_HOME/profiles/<name>/cordis.patch.yml`:

```yaml
- id: effort-policy
  config: { enabled: true, baseLevel: low, verifiers: [...], mutators: [...] }
- id: tool-subagent
  config: { effortPolicy: true }
- id: tool-subagent-fork
  config: { effortPolicy: true }
```

An in-tree fixture at `apps/cli/tests/profiles/effort-policy/` boots this composition with a recorded scenario, so the enablement path has an automated gate. Upstream keeps `enabled: false` and the tool flags false.

Prerequisite: M2–M5. Done when the fixture scenario passes and a real session records `low`, rises on a broken typecheck, and returns only after it passes.

### M7 — Mayberry takeover

Add `@mayberry/effort-policy-core` to `package.json`, the lockfile, licences, and third-party notices; replace `./core` with a re-export; delete `src/{types,levels,policy,core}.ts` and their tests in the same change; keep the export path. The adapter refuses to start when the package's `EFFORT_POLICY_PROTOCOL_VERSION` differs from its own, and a test covers the refusal.

Prerequisite: M6 verified plus a Mayberry release.

## 5. Verification

```
pnpm vitest run packages/llm/effort-policy
pnpm vitest run packages/compaction/compaction-basic
pnpm vitest run packages/subagent/tool-subagent packages/subagent/subagent
pnpm vitest run packages/api/session-controller packages/acp/acp
pnpm run constraints
pnpm run typecheck
pnpm run lint
pnpm run doc-sync
pnpm run test:snapshot
pnpm run build:artifacts && pnpm run build:check
pnpm run hygiene
```

`pnpm run test:coverage` applies to the new package before M1 merges.

Required cases:

- Levels: full vocabulary, no `low`, `off`-only, no reasoning metadata, exact `off` base.
- Policy: precedence table rows; mode pin versus user level and user exact effort; escalation above an effective base and back.
- Evidence: failure escalates; infrastructure does not; stale cases (before failure, before a later mutation, other directory, other agent, other command, child mutation during a parent run); verifier re-run clears.
- Delegation: minimums, overrides, inheritance, four flag/service combinations, cold-resume fallback, out-of-process fallback.
- Selection: stale acknowledgement, `off` pin, ACP resume, projection state version.
- Compatibility: flag off → schema unchanged and request byte-identical, including `snapshots/session/compaction-output-reserve`.
- Portability: import boundary, `./core` source import from another package, protocol-version refusal.
- Persistence: the change record and all four generated artifacts fresh.

## 6. Release and recovery

- Rollback is three rows: `effort-policy.enabled: false` and both `tool-subagent.effortPolicy: false`. Flipping only one is a loud misconfiguration, not a silent divergence; the error names both rows.
- Reverting M4 alone restores today's inheritance; a lingering `effortOperation` is ignored.
- Reverting M5 alone leaves the base at its configured value.
- No data migration. Sessions written while enabled contain a required event and are refused by older builds; disabling the feature stops new ones.
- Human approval is required before M6 changes a real default.

## 7. Acceptance criteria

- With the fork overlay at `low`, a session's first request logs `low`; with the shipped `standard`, every recorded session replays unchanged, including the compaction scenario.
- A failed verification raises effort, records one transition, survives a turn boundary and a resume, and clears only when the same check passes.
- Infrastructure failures never change the level.
- A route without reasoning metadata dispatches untouched; a route swapped between resolution and dispatch falls back instead of failing.
- An exact pick of `off` stays `off`; a level pick sets the base; a stale acknowledgement cannot retire it.
- `plan`/`review` children start `deep`; `general` children start `standard` under any parent; `mechanical` requires verification; a cold-resumed child starts `standard`.
- The core imports nothing from the harness and is importable as `./core` from source.

## 8. Remaining risks and decisions

- **Required event (accepted risk).** Enabling the policy makes those sessions unreadable by older builds. Documented; no core change.
- **Cold resume loses the operation (accepted).** A resumed child starts at `standard`; persisting it would need a versioned descriptor and a persistence change.
- **Two enabled rows (accepted).** A single switch would need optional service injection, which this repository does not use; the load-time check makes a mismatch loud.
- **Mutation classification (accepted).** Unlisted commands count as mutations; a missed read-only pattern costs a re-run.
- **Mayberry (decision, owner: user).** P0 before M0; M7 after M6.
- **Re-verification.** This is the second revision. It has not had a third independent pass; the verdict is CONDITIONAL for that reason as much as for the approvals.
