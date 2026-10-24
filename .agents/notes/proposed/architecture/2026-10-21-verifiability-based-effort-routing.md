# Agent Note: Verifiability-based effort routing

Status: proposed

English | [中文](2026-10-21-verifiability-based-effort-routing.zh.md)

## Problem

Reasoning effort is a property of an Agent, not of the work. `ModelSelection` pins `{provider, model, reasoningEffort}` once, `installModelSelection` writes it into every request, and the logged `request/header` seeds later requests from itself. A new session inherits `agent-default-model`, which names no effort, so the DeepSeek adapter supplies its configured default — `high` — for every step of every turn.

Direct `ctx.llm.stream()` callers do not inherit the session's effort at all. They get the model's `defaultEffort` unless the call site names one. Session titles name the model's lowest effort; compaction names none, so a summarization request that replays the whole conversation runs at `high` regardless of what the user selected. The same holds for every future auxiliary request unless its author remembers to pin one.

Delegation repeats the mistake at a larger scale. A child created without an explicit effort inherits whatever effort the parent's `AgentOptions` carry, so a parent that escalated to recover from one failing test hands every later delegation the same expensive setting. Investigation, implementation, and review all start wherever the parent happened to be, and nothing records which of those the child was asked to do.

The result is that the harness spends its most expensive thinking on its least consequential work, and no durable record explains why any request used the level it did. The product requirement is to route by verifiability rather than perceived difficulty: work whose result can be checked by a parser, schema, test, or exact comparison may run cheap; work that needs judgment may not.

## Proposal

### Three lanes

Work is routed by what kind of operation it is, not by classifying the user's words. The harness already knows each operation's identity because the code that issues the request names it. A classifier that guesses from prompt text would pay for its own inference and could be wrong in the expensive direction.

**Deterministic — no model.** Anything with an exact answer stays a tool call: tests, typecheck, git, glob, grep, regex, token counts, sorting, hash comparison. No runtime component is proposed for this lane; it is a construction rule: a new harness feature that computes a value from structured input ships as a function and a model call must justify itself in review. The existing tier-0 tools already cover most of the table this note responds to.

**Mechanical — pinned low.** Named auxiliary operations name their effort at the call site instead of inheriting. The only product-reachable case today is compaction summarization: session titles already pin their own effort, and the remaining direct `ctx.llm.stream()` callers are experimental packages no shipped bundle mounts. Titles take `efforts[0]`, which is `off` on the DeepSeek route — a stronger choice than this lane needs. Compaction resolves the `low` level instead, because condensing a whole conversation with thinking disabled is a quality bet this note does not make. Each pin is local, individually revertible, and verifiable by reading the logged auxiliary request.

**Reasoning — session level.** The conversation loop keeps an effort level, described below.

### Effort levels

Three levels decouple policy from any one provider's vocabulary:

- `low` — `low` when the model advertises it, otherwise the lowest advertised effort that is not `off`, otherwise `off`.
- `standard` — the model's own `defaultEffort`, which is the behavior a deployment gets today.
- `deep` — `max` when advertised, otherwise the highest advertised effort.

The mapping resolves through `ctx.llm.resolveModelInfo()` for the exact route, on the same adapter registration the request will dispatch to. It is resolved per request rather than cached: reasoning metadata is derived from live connection settings that a Models-page edit replaces, and a cache with no invalidation would silently pin an effort the route no longer accepts. A route that advertises no reasoning at all is left untouched, because the runtime rejects any explicit effort on it before provider I/O. When the resolved effort equals the model's `defaultEffort`, the policy writes nothing: a defaulted effort and an explicitly written one are different durable header facts, and writing the value the adapter would have chosen changes the record without changing behavior.

### Loop policy

A new plugin, `@deepseek-ai/dsh-effort-policy`, owns the effort level for each Agent.

- It listens on `agent/request` with `prepend: true`, awaits `next()` so model selection has already applied the route, then replaces only `reasoningEffort`. The provider and model are never changed: a route change would invalidate prefix-cache reuse and log a model-switch notice for an effort decision.
- The base level comes from `Config`, defaulting to `standard` in the shipped composition so no recorded session changes, with this fork's profile patch selecting `low`. A silent behavior change for every deployment is not this note's to make, and the recorded-session corpus is the literal statement of current behavior.
- The policy is the only writer, and it learns the user's choice explicitly rather than inferring it. Reading intent from the request is unsound: `agent/request` seeds every step after the first from the last logged header, so the effort it sees is normally the policy's own previous write, and the Web picker projects that same header back. Instead the picker's selection command calls a public `setBase(agent, level)` on the policy and persists the choice as a session fact; the policy also records the effort it applied per Agent, so an echo of its own write is never read as a new choice. Consumers are the session controller's selection command and the ACP control surface.
- Mode pins need one read from the mode owner: plan mode is the case that matters, and its active state is currently private (`loggedActive`). The change adds a read-only accessor there, or reads the published plan projection, and the policy consumes it through an optional lookup so a deployment without plan mode keeps the base level. An active goal round pins `standard` the same way.

### Delegation

A child's effort is set by the delegation's operation, not inherited from the parent's current level.

The delegation tools gain an optional `operation` field, defaulting to `general`:

| `operation` | Starts at | Minimum |
|---|---|---|
| `general` | `standard` | `standard` |
| `explore` | `standard` | `standard` |
| `implement` | `standard` | `standard` |
| `plan` | `deep` | `deep` |
| `review` | `deep` | `deep` |
| `mechanical` | `low` | `low` |

- `mechanical` is the only route to a cheap child, and it requires a declared `verification` naming the check that decides the work is correct — a command whose success or failure the child will actually run. A delegation without one is rejected before a child exists, because "this is simple" is not evidence and the policy has no other way to tell.
- An explicit `reasoning_effort` is authoritative within the operation's minimum. A value naming one of the three levels below the minimum is rejected with the minimum named in the error; it is never silently raised, because a silent raise hides a caller that asked for something the operation forbids. Any other advertised effort is the caller's exact choice: the adapter validates it, and the policy writes it verbatim as the child's starting effort.
- The parent's current level is never inherited. A child that wants it must ask for it with `inherit_effort: true`, which is off by default. A parent temporarily at `deep` therefore does not make every later delegation expensive.
- The tool records the resolved operation and the inheritance choice on the child's `AgentOptions`, through merge-extensible fields. The policy reads that intent instead of re-deriving it from a prompt, and a child created by any other path has no operation and therefore starts at the configured base level.
- Fork children keep the parent's provider and model for prefix-cache reuse but still start at their operation's level; effort is a request control, not part of the cached prompt prefix.
- Every child has its own evidence and recovery state. Its outcome reaches the parent through the existing delegation result. A child's failure never changes the parent's level by itself: the parent escalates only from its own failing verification.

### Evidence and recovery

Escalation answers one question: did the work fail in a way that more thinking could fix?

- **Infrastructure failures do not escalate.** Authentication, quota, rate limiting, timeouts, network failures, cancellation, and provider overload are recovery problems. A cancellation is always infrastructure, whatever the deployment configures, because a stopped check proves nothing. Every other code becomes infrastructure only when the deployment lists it in the validated `Config` failure categories: for an error-signalled verifier the error flag is the verdict by design, so an unlisted code raises effort and the operator adds it to the list. A text verifier's error is infrastructure instead, because the check did not run.
- **Verification failures do.** A verifier is configured explicitly — a tool name plus the predicate that reads its result. A non-zero exit from a build, test, typecheck, or lint run escalates; a tool that throws, is denied, or times out does not. Treating every unhappy tool outcome as a reasoning failure would turn a flaky network into a permanently expensive session.
- **Elevated effort persists until recovery is verified.** The policy records the identity of the failing check, not just the fact of failure. The level returns to base when that same check succeeds, or when the user sets a level through `setBase`. A turn boundary does not lower it, because a new turn does not prove the previous work was repaired.
- **Recovery is the only automatic exit.** A session can stay elevated for the rest of its life if the failing check never runs again. That is intended: an unresolved failure is not evidence that the next step is easy.

### Logging and visibility

The effective effort already reaches the durable `request/header`, so no new model-visible input is introduced. The policy adds a log-only `effort/decision` session event carrying the chosen level and resolved effort, the rule that chose it, the previous value, the operation when one applies, and the identity of the evidence that raised or cleared it. That event is what makes the policy auditable: every cheap step traces to a rule, every expensive one to a named failure, and every infrastructure failure it declined to act on.

The existing model picker remains the manual override, and it changes the base instead of fighting the policy: selecting a level maps it to the nearest level and calls `setBase`, so the two cheapest settings are not silently ignored by a floor rule. Selecting `off` in a thinking-disabled deployment leaves the adapter publishing only `off`, and the policy defers to it.

### Portable core

The policy is written to move. The decision logic lives in a dependency-free module that takes plain data — operation, supported efforts and default effort for the route, queued evidence, the user's chosen level — and returns a decision: an effort, or no change, plus the rule that produced it. It imports no Cordis, session, or LLM types and reads no configuration, environment, or clock.

The Cordis plugin is one adapter over that core: it maps agent and tool events into evidence, resolves model capability through `ctx.llm.resolveModelInfo()`, and writes the request. Mayberry would supply its own adapter over the same core rather than a second copy of the rules. The vocabulary — three levels, six operations, infrastructure versus verification — belongs to the core, so both harnesses route identically.

## Plan

### Sequencing

Every milestone below lands in its own reviewable change. M0 and M1 ship together, because a package with no product use fails `verify-product-use`; M0 is still independently testable before M1 exists.

| Order | Milestone | Depends on | Runtime effect when merged |
|---|---|---|---|
| 1 | M0 portable core | — | none |
| 2 | M1 adapter plugin, composed disabled | M0 | none (service registered, no listeners) |
| 3 | M2 compaction pin | M1 | none until `enabled` |
| 4 | M3 loop policy | M1 | none until `enabled` |
| 5 | M4 delegation fields | M1, M3 | none until `enabled` |
| 6 | M5 manual selection | M3 | none until `enabled` |
| 7 | M6 fork enablement | M2–M5 | the fork's default changes |
| 8 | M7 Mayberry takeover | M6 + Mayberry release | none in this repo |

M2 and M3 are independent of each other and may land in either order or in parallel.

### M0 — Portable decision core

Create `packages/llm/effort-policy/`:

- `package.json` — `@deepseek-ai/dsh-effort-policy`, exports `"."` (adapter, added in M1) and `"./core"` (pure), the standard `files` list, `@deepseek-ai/cordis` in peer and dev, `@deepseek-ai/schemastery` in dependencies.
- `src/types.ts` — plain data: `EffortLevel`, `DelegationOperation`, `EffortCapability { efforts: readonly string[]; defaultEffort?: string }`, `Evidence`, `Decision`, `DecisionRule`, `EFFORT_POLICY_PROTOCOL_VERSION = 1`.
- `src/levels.ts` — `resolveLevelEffort(capability, level): string | undefined`, implementing the three level rules and returning `undefined` when the route advertises no reasoning.
- `src/policy.ts` — `decide(input): Decision` over `{ operation, capability, base, evidence, revision, minimum }`.
- `README.md` — the model-experience and limitations sections the package gate requires.
- `tests/levels.spec.ts`, `tests/policy.spec.ts`, `tests/import-boundary.spec.ts`.

Also modify: `tsconfig.host.json` (project reference), `tsconfig.base.json` (generated aliases via `pnpm run gen-tsconfig-paths`), `packages/llm/README.md` (group table row).

The import-boundary test reads `levels.ts`, `policy.ts`, and `types.ts` as text and asserts they contain no `@deepseek-ai/`, `node:`, or `@mayberry/` import, and no reference to `Context`, `Session`, or `Date`. That test is the portability guard; nothing else enforces it.

Done when: `pnpm vitest run packages/llm/effort-policy` passes, the import test fails on a probe import, and `pnpm run typecheck` is clean.

### M1 — Adapter plugin composed disabled

Add to the same package:

- `src/config.ts` — the validated `Config`: `enabled` (default `false`), `baseLevel` (default `'standard'`), `verifiers` (tool name plus the result predicate that decides pass or fail), `mutators` (tool names whose result changes the workspace), `infrastructureFailureCodes`, `escalationOrder`.
- `src/service.ts` — `EffortPolicyService` on `ctx.effortPolicy`, exposing `enabled`, `levelFor(operation)`, `setBase(agent, level)`, and `capabilityFor(provider, model)`.
- `src/index.ts` — the plugin: registers the service, and subscribes to nothing when `enabled` is false.
- `tests/loader-composition.spec.ts` plus `tests/fixtures/cordis.yml`.

Modify:

- `packages/bundle/base/cordis.patch.yml` — one row, `id: effort-policy`, `name: '@deepseek-ai/dsh-effort-policy'`, `config: { enabled: false }`.
- `packages/bundle/base/package.json` — the dependency that `verify-cordis-config` requires for a composed bare plugin name.
- `scripts/gen-cordis-catalog.ts` — the `SERVICE_PAGE` entry for `ctx.effortPolicy`.

Regenerate: `docs/config-catalog.md`, `docs/module-graph.md`, `docs/event-producer-consumer.md`, the generated region of the LLM subsystem page, `packages/extensions/tool-cordis/src/api-catalog.ts`.

Done when: `pnpm run doc-sync` passes, `pnpm run test:snapshot` is unchanged, `dsh --profile headless --dump-config` shows the row with `enabled: false`, and a disabled plugin produces no request change in a loader test.

### M2 — Compaction pin

Modify `packages/compaction/compaction-basic/`:

- `src/summarizer.ts` — replace the bare `ctx.llm.stream(options)` call with `ctx.llm.prepareCall(config, signal, (controls, model) => …)`, resolving the `low` level through `resolveLevelEffort` only when `ctx.get('effortPolicy')?.enabled` is true. When the policy is absent, disabled, or the route advertises no reasoning, the configure callback returns the controls unchanged.
- `package.json` — dependency on `@deepseek-ai/dsh-effort-policy`.
- `README.md` — state the summarization effort behavior.

This mirrors the pattern in `packages/session/session-title-llm/src/index.ts:252-258`, which already resolves an effort from `prepareCall`'s model metadata.

Done when: with the policy enabled, a summarization request logs `low`; with it disabled, the request is byte-identical to today; no recorded session changes, because no committed scenario compacts.

### M3 — Loop policy

Add:

- `src/evidence.ts` — per-Agent evidence store keyed by `{ verifier, command, workingDirectory }`, tracking the revision of the last mutating result and the session sequence of each observation.
- `src/index.ts` — listeners: `agent/request` (`prepend: true`, awaits `next()`, replaces only `reasoningEffort`), `tools/result` (records verification, mutation, and infrastructure evidence), `agent/request-error` (classifies the failure, never escalates on infrastructure), and the `effort/decision` session event declared through `declare module '@deepseek-ai/dsh-session/types'`.
- `tests/evidence.spec.ts`, `tests/loop-policy.spec.ts`.

The decision event is log-only and carries `{ protocolVersion, level, effort?, rule, previous?, operation?, evidence? }`. It introduces no model-visible input and no second notification mechanism.

Done when: the acceptance criteria for levels, escalation, recovery, and infrastructure classification pass in unit tests, and one recorded scenario pins a header sequence and its decision events.

### M4 — Delegation

Modify:

- `packages/subagent/tool-subagent/src/index.ts` — add `operation`, `verification`, and `inherit_effort` to the tool input schema only when `ctx.get('effortPolicy')?.enabled`; validate `verification` presence for `mechanical` and the operation minimum for an explicit `reasoning_effort`; reject with the minimum named. Extend the model-facing description per provider wording, keeping both variants pinned by tests.
- `packages/subagent/tool-subagent/src/model-selection.ts` — pass the resolved inheritance choice into `preflightChildLlmRoute`'s existing `inheritParentReasoningEffort` parameter instead of hard-coding `true`.
- `packages/subagent/subagent/src/child-agent.ts` — `resolveChildAgentOptions` gains an `inheritEffort` argument (default `true`, preserving today's behavior) and omits the parent's `reasoningEffort` when it is false.
- `packages/core/agent/src/runtime-types.ts` — no change expected: `AgentOptions` is merge-extensible and `resolveChildAgentOptions` spreads `requested`, so the new fields travel with it. Confirm in M4's first test rather than editing speculatively.

Declare the merge-extensible fields (`effortOperation`, `effortInherited`) in the policy package rather than in core, so the subagent tool depends on the policy package's types and core stays free of effort vocabulary.

Out-of-process providers (`subagent-dsh-sdk`, `subagent-acp`, `subagent-claude-code`, `subagent-codex`) drop the new fields by construction. Their children therefore start at their own runtime's default, which is `standard` here. Document that rather than adding a capability flag.

Done when: the delegation acceptance criteria pass, a policy-enabled scenario records a child at `standard` under a parent at `deep`, and every existing subagent test still passes with the policy disabled.

### M5 — Manual selection

Modify:

- `packages/api/session-controller/src/commands.ts` — after a successful selection, call `ctx.get('effortPolicy')?.setBase(agent, levelForEffort(effort))`. The effort-to-level mapping lives in the policy package, not in the controller.
- `packages/api/session-controller/src/agent.ts` — keep `consumeSelection` retiring a pick when the header matches; a policy-applied effort is not a pick, so the pending entry must retire on the command's own acknowledgement.
- `packages/acp/acp/src/model-control.ts` — same call for the ACP `reasoning_effort` option.
- `docs/upgrade-guide/<next-version>/effort-policy/guide.md` — the behavior change, the flag, and the selection semantics.

No client package changes: the picker still sends the same selection command and still reads the header's effort.

Done when: a pick of `off` stays `off`, a pick of `high` survives escalation and de-escalation, and the ACP config option round-trips.

### M6 — Fork enablement

The fork's profile patch, not this repository's shipped composition:

```yaml
- id: effort-policy
  config:
    enabled: true
    baseLevel: low
    verifiers: [ … the workspace's build, typecheck, test, and lint commands … ]
    mutators: [ … the fs write and edit tools … ]
```

Upstream keeps `enabled: false`. The fork may instead edit `packages/bundle/base/cordis.patch.yml` directly, accepting the merge conflict cost on every upstream sync; the profile patch is preferred.

Done when: a real session records `low` first, rises on a deliberately broken typecheck, and returns to `low` only after that typecheck passes.

### M7 — Mayberry takeover

Mayberry side, in this order:

1. Publish `@mayberry/effort-policy-core` containing a copy of `src/types.ts`, `src/levels.ts`, `src/policy.ts` and their tests, exporting the same names and the same `EFFORT_POLICY_PROTOCOL_VERSION`.
2. Implement a Mayberry adapter over that core — mapping its request events, capability lookup, and evidence sources — without copying any rules.

DSH side, after the Mayberry package is published:

3. Replace `@deepseek-ai/dsh-effort-policy`'s implementation of `./core` with a re-export of `@mayberry/effort-policy-core`, delete the three local files and their tests in the same change, and keep the `./core` export path so existing consumers do not move.
4. Delete nothing else: `src/index.ts`, `src/config.ts`, and `src/evidence.ts` are the Cordis adapter and stay here.

The invariant is one implementation at any time. Never vendor a copy into both repositories, and never let the DSH adapter re-implement a rule the core already decides; a rule that differs is a protocol version bump.

### Evidence correlation

An escalation is a claim about a specific check at a specific revision. The adapter records, for every verification observation: the tool name, the exact arguments, the working directory the call ran in, the observation's order within its Session, and the workspace mutation revision at that moment. The durable state is keyed by Session, so one Session's pass cannot clear another's failure, while the revision is workspace-scoped because concurrent children mutate the same tree.

- A failure escalates.
- A pass clears only when all hold: same verifier triple, later session sequence than the failure, mutating revision not older than the latest mutation at pass time, and no failure of the same verifier after it.
- A pass observed before the failure, in another working directory, from another Agent, or from a different command is recorded as stale and changes nothing.
- A pass invalidated by a later mutation without a re-run is not a recovery; the escalation stands until the check runs again.
- Infrastructure failures never escalate and never clear.

### Compatibility and versioning

- `enabled: false` is the shipped default. With it, no listener runs, the tool schema has no new fields, and every recorded session replays unchanged.
- `inherit_effort` has two documented meanings by composition: absent under a disabled policy (today's inheritance), and default `false` under an enabled policy. The field is only offered when the policy is enabled, so no model can request semantics its deployment does not implement.
- `operation` defaults to `general` when omitted, which resolves to `standard` — the same starting level a child gets today when it does not inherit.
- `EFFORT_POLICY_PROTOCOL_VERSION` versions the decision data that crosses the core boundary. A change to level rules, operation minimums, or decision fields increments it; the adapter refuses to run against a core whose protocol version it does not know.
- The `effort/decision` event is additive and log-only. It does not bump `SESSION_FORMAT_VERSION`. It is required-on-read rather than ignorable, because only an undeclared `plugin:` record can carry the ignorable flag; a build older than the one that wrote an enabled Session therefore refuses it, and a deployment that never enables the policy writes none. SDK projections are regenerated in M3.

### Tests

Every milestone adds the cases its surface needs; these are required regardless:

- Levels: full vocabulary, no `low`, `off`-only, no reasoning metadata, unknown effort.
- Policy: base level, operation minimum, explicit override above and below the minimum, `setBase` replacing the base.
- Evidence: failure escalates; infrastructure does not; pass clears; pass before failure does not; pass before a later mutation does not; pass in another directory, from another Agent, or from another command does not; unresolved failure keeps the level raised across turn boundaries.
- Delegation: parent-child isolation (parent `deep`, child `standard`); `inherit_effort` copies the parent only when true; `mechanical` without `verification` rejected; explicit override honored above and rejected below the minimum; a provider that drops the fields yields a child at `standard`.
- Compatibility: with the policy disabled, the tool schema is unchanged, `inherit_effort` is absent, and a captured request header is byte-identical.
- Portability: the import-boundary test.
- Snapshots: one policy-enabled scenario for escalation and recovery, one for delegation; all existing scenarios unchanged with the policy disabled.

### Gates

Per milestone, the smallest set that covers the diff:

```
pnpm vitest run packages/llm/effort-policy
pnpm vitest run packages/compaction/compaction-basic
pnpm vitest run packages/subagent/tool-subagent packages/subagent/subagent
pnpm run constraints
pnpm run typecheck
pnpm run lint
pnpm run doc-sync
pnpm run test:snapshot
pnpm run build:artifacts && pnpm run build:check
pnpm run hygiene
```

`pnpm run test:coverage` applies to the new package before M1 merges, because per-file coverage is the CI gate.

### Rollout, rollback, migration risks

- Rollback is one flag. `enabled: false` restores every behavior, because no listener runs and the tool schema loses its fields. M2's compaction pin reads the same flag, so it rolls back with it.
- Reverting M4 alone is safe: children return to today's inheritance, and the `effortOperation` field on a live child is ignored.
- Reverting M5 alone is safe: the picker stops calling `setBase`, and the policy keeps its configured base.
- No data migration exists. The new event is additive, and no durable record changes format.
- The risks worth watching in review: the tool schema change is model-facing and must be pinned in both variants; the `effort/decision` event must not become a second notification path; `verify-product-use` and the config catalog force the base row and the service page into the same change as M1; and the engine must stay out of `packages/core/agent-loop`, which takes no decision it cannot explain.

### What this plan deliberately does not add

No client or UI change; no new event bus beyond the single log-only event; no model-based classification; no rule DSL, plugin hooks, or configuration UI inside the policy; no capability flag across subagent providers; no second implementation of the rules for Mayberry.

## Alternatives considered

**An LLM classifier in front of the loop.** The proposed flow starts with "classify the task". Rejected as the mechanism: the classifier is itself a model request whose effort must be chosen, its errors land on the most expensive side, and it adds a round trip to every turn. Operation identity is already known to the code that builds the request, so classification would re-derive a fact the harness has.

**A deterministic prompt classifier as the routing authority.** Rejected as primary because keyword heuristics are brittle across languages and phrasing, and a wrong `low` on a reasoning task is not recoverable by the same turn. Retained only as an optional `deep` start hint, which errs toward the safe direction.

**Escalation without a low base.** Rejected because it leaves the measured waste in place: auxiliary requests and mechanical turns stay at high, which is most of the token bill in long sessions.

**Changing the model instead of the effort.** Rejected because a different route breaks prefix-cache reuse and writes a model-switch notice into the conversation for a decision the user never made.

**Reading the user's choice from the request.** Rejected because `agent/request` seeds each step after the first from the last logged header, so the effort on the request is normally the policy's own previous write, and the Web picker projects that same header back. Inferring choice from an echo makes one escalation permanent, leaves the picker's pending selection never settling, and cannot tell a resumed session's inherited effort from a fresh pick. An explicit `setBase` costs one call site per surface and removes the ambiguity.

**Inheriting the parent's effort level.** Rejected as the default. Inheritance is cheap to implement and wrong in the common case: delegation exists because the parent needs investigation, implementation, or independent judgment, and a parent that just escalated is the worst possible source for a child's starting level. Opt-in `inherit_effort` keeps the capability without the default.

**Routing by `GenerateOptions.purpose` in core.** Attractive because `purpose` already distinguishes `compaction` from `session-title`. Deferred rather than rejected: making core route on a logging field would put policy in the loop, and the loop must not gain a decision it cannot explain. Revisit if the number of auxiliary call sites grows past what per-site pins can carry.

## Acceptance criteria

- With the fork's profile selecting `low`, a new session sends its first request at `low` (or the model's lowest non-`off` effort), and the logged `request/header` shows it.
- With the shipped `standard` base, the recorded-session corpus replays unchanged: no header gains or loses an explicit effort, because the policy writes nothing when the resolved effort equals the model's default.
- A compaction request runs at the `low` level, and the session's own level does not change it.
- A failed verification raises the next request's effort, logs an `effort/decision` naming the check, keeps it raised across turn boundaries, and lowers it only when that check succeeds.
- An authentication failure, a rate limit, a timeout, and a tool that throws leave the level unchanged and say so in the decision event.
- A route that advertises no reasoning metadata is left untouched and dispatches without error.
- `setBase` from the picker changes the session's base; a pick of `off` stays `off`; escalation may still raise above a pick and settles back to it only on verified recovery.
- Delegation: no `operation` starts at `standard`; `plan` and `review` start at `deep`; `mechanical` without `verification` is rejected; `mechanical` with one starts at `low`; an explicit `reasoning_effort` above the minimum is honored; one below it is rejected with the minimum named; `inherit_effort` is required to copy the parent's level, and a parent at `deep` does not raise its `general` children.
- Child creation, inherited options, explicit overrides, independent escalation, parent-child isolation, and recorded-session compatibility each have a regression test.
- The decision core has a test asserting it imports nothing from the harness, and compiles against plain data only.
- A recorded session snapshot pins the header sequence and the decision events for one escalating turn.

## Risks

- **Low-first can silently underperform.** A task with no verification step gets a cheap first attempt and no mechanical signal that it went badly. This is the central bet: in a coding harness most failures surface through a tool, and escalation catches them one step later than a classifier would have prevented them.
- **Recovery-gated de-escalation can pin a session high.** If the failing check never runs again, the elevated level never clears. That is preferred to resetting on a turn boundary, but it makes a single unresolved failure expensive for the rest of the session.
- **The escalation classifier will be wrong sometimes.** A provider error that is really a capacity problem will be classified as infrastructure and will not escalate; a genuinely bad result that arrives as a clean tool exit will not either. The decision event is the only way to audit those calls.
- **The `operation` field is model-facing and can be mislabeled.** A model that believes bounded work is mechanical can ask for `low`. The mandatory `verification` is the mitigation; it does not make the label true, it makes the lie visible.
- **The deterministic lane is enforced by review, not by code.** A construction rule that no gate executes will erode. If it matters, it needs a checklist entry in the change review path rather than prose here.
- **One exception to the no-write rule re-records the corpus.** Shipped compositions stay byte-identical only while the policy leaves adapter-defaulted efforts alone. If a later level or pin writes an explicit effort equal to a default, every recorded session changes and the replay lane needs an owner with a real API key to re-record, because snapshots are owner-local.
- **A per-request model lookup on the request path.** Resolution runs once per request and is not cached; a deployment with an adapter backed by an authoritative remote catalog turns that into a network call per step.
- **The policy needs consumers in the selection paths.** `setBase` is only correct if the session controller and the ACP control surface both call it; a surface that keeps writing the header directly would fight the policy in a way the design cannot detect.
- **The portable core can drift toward its first adapter.** The moment the core takes a Cordis type, a session id, or a clock, Mayberry cannot reuse it. The import test is the guard; review has to hold the line on everything the test cannot see.
- **The policy can surprise a user who did not ask for it.** A session that silently runs at `low` until something fails is a behavior change users did not select. The logged decision event and the visible effort in the request header are the only disclosure.
- **The visible effort moves by itself.** The model picker projects the latest request header, so a session that escalates shows the effort changing between steps. That is honest but it makes a manual selection look unstable; the client may need to distinguish a policy-applied effort from a user selection.
