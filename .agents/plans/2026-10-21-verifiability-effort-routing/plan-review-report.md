# Plan Review Report — Verifiability-Based Effort Routing

## Verdict

**CONDITIONAL.** Two independent source-level reviews are reflected here. The second found one blocker and eighteen material findings; all are resolved in the plan or recorded as accepted risks with tests. The plan is executable, but the revision itself has not had a third independent pass, and two approvals remain: implementation approval, and the P0 portability contract before M0.

## Review scope and evidence

- Review depth: **Deep** — the plan adds an event type, changes a model-facing tool schema, changes delegation defaults, adds a package, and hands a decision engine to another repository.
- Inspected: repository at `Y:\deepseek-harness_fife` (working tree, 2026-10-21) — `packages/core/agent`, `packages/core/agent-loop`, `packages/core/session`, `packages/core/tools`, `packages/llm/llm`, `packages/llm/llm-deepseek`, `packages/compaction/compaction-basic`, `packages/session/session-title-llm`, `packages/subagent/{tool-subagent,subagent,subagent-dsh-sdk}`, `packages/plan/plan-mode`, `packages/api/session-controller`, `packages/bundle/base`, `snapshots/`.
- Not inspected: Mayberry (not present in this workspace); no test suite, build, or snapshot replay was run, because this is a planning gate.
- Prior review: an earlier builder-check pass on the draft found the header-seeding and snapshot-corpus problems; both are carried into this report as resolved findings.

## Findings

| ID | Severity | Evidence status | Finding | Evidence/reference | Resolution | State |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | High | Verified | Gating the new tool fields on `ctx.get('effortPolicy')?.enabled` at `apply()` time is load-order dependent; a tool that applies before the policy mounts would never expose the fields, and no package in this repository uses Cordis optional injection to fix ordering. | `packages/subagent/tool-subagent/src/index.ts:43`; no `optional:` inject pattern under `packages/` | Gate the schema on the tool's own `effortPolicy` config, and cross-check service presence at execution time, failing loud when the flag is on and the service is missing. M4. | Resolved |
| F2 | High | Verified | A pending pick retires only when the logged effort equals the picked effort. Under the policy the header carries an escalated effort, so the pick never retires and `current` keeps returning it, fighting the policy on every request. | `packages/api/session-controller/src/agent.ts:296-326` | Retire a pick on provider/model acknowledgement, hand effort ownership to `setBase`. M5. | Resolved |
| F3 | High | Verified | The draft kept escalation evidence in memory while claiming elevation persists until verified. A resume would silently drop an open escalation. | `packages/core/session/src/types.ts:502-512`; `packages/plan/plan-mode/src/index.ts:375-391` | One ignorable `effort/decision` event plus a registered session projection; the projection is the resume mechanism. M3. | Resolved |
| F4 | Medium | Verified | A decision record per request adds a durable row per step for information the request header already carries, and inflates replay cost. | `packages/core/session/src/types.ts:497-512` | Emit only on transitions: raise, clear, base change, mode pin change. M3. | Resolved |
| F5 | High | Verified | The draft never mentioned that `KNOWN_SESSION_EVENT_TYPES` is generated, that `doc-sync` verifies it, or that an unknown event type without `ignorable: true` makes a session unreadable by older builds. | `packages/core/session/src/known-event-types.ts:1-21` | Regenerate the catalog in M1, mark the event `ignorable: true`, add `verify-persistence-catalog` coverage to the gates. | Resolved |
| F6 | Medium | Verified | "Verifier predicate" was described as configuration without a data representation; a config file cannot carry a function. | Draft plan, M3 | A closed rule shape `{ tool, commandPattern?, passPattern, failPattern?, outcome }`. Final plan §3.3. | Resolved |
| F7 | High | Verified | Mutation tracking listed only `write` and `edit`, but shell tools can change the workspace. A passing check after a shell-driven edit would have cleared an escalation on unrelated work. | `packages/fs/tool-fs/src/write.ts:74`, `edit.ts:86`; shell tools mutate | Conservative revision: every non-verifier shell result counts as a mutation. Accepted over-strictness. Final plan §3.3. | Resolved |
| F8 | Medium | Likely | If the policy row is absent while `effortPolicy` is on, or the service is disabled, compaction silently falls back to the model default. Silent degradation conflicts with the repository's fail-loud rule. | `packages/compaction/compaction-basic/src/summarizer.ts:152-163` | Compaction treats an absent service as "feature off" because a summarization request must not fail; the tool path fails loud instead. Recorded as an accepted asymmetry. | Risk accepted |
| F9 | Medium | Verified | The draft said SDK projections are regenerated in M3 but listed no gate that covers them. | Repository convention on SDK projection coverage | `pnpm run test:snapshot` plus explicit regeneration of TS and Python expected outputs in M3. | Resolved |
| F10 | Medium | Verified | "Byte-identical when disabled" was asserted without a test that captures the request. | Draft plan, M2 | Explicit enabled/disabled test pair in M2. | Resolved |
| F11 | Low | Verified | M6 named values ("typecheck, tests") without a concrete patch shape. | Draft plan, M6 | Final plan states the profile patch fields and leaves values to the deployment. | Resolved |
| F12 | Medium | Verified | Out-of-process providers resolve only named `AgentOptions` keys, so `effortOperation` is dropped silently; the draft did not say what a child then gets. | `packages/subagent/subagent-dsh-sdk/src/index.ts:106-117` | Documented and tested: such a child starts at `standard`. M4. | Resolved |
| F13 | Low | Verified | The decision event carried no protocol version, although the same data will cross a repository boundary in M7. | Draft plan, M3 | Event and decision carry `EFFORT_POLICY_PROTOCOL_VERSION`. | Resolved |
| F14 | Medium | Unverified | Per-request `resolveModelInfo()` adds one adapter capability lookup per step on top of the loop's own `prepareCall`, which may be a network call for an authoritative remote catalog. | `packages/llm/llm/src/index.ts:756-771`; draft plan §3 | Accepted for now; M3 measures the added latency in one session and the plan records the fallback (per-turn memo keyed by route) if it is material. | Deferred |
| F15 | High | Verified | Counting every non-verifier shell result as a mutation makes a read-only `git status` or `ls` invalidate a valid pass, so an escalation could stay raised through correct recovery. | Final plan §3.3 as first revised | Three-way classification: known mutation increments, known read-only preserves, everything else increments. The dangerous direction (a wrong read-only label) is guarded by a test that an unlisted command increments. | Resolved |
| F16 | High | Unverified | The projection was introduced without stating what happens on restart, replay order, compaction, child isolation, or an undecodable record; a silent reset to base would contradict the hold-until-verified rule. | Final plan §3.4 | Explicit durability rules, including fail-closed retention of the last elevated level when state cannot be reconstructed, plus M3 tests for resume, resume-after-compaction, isolation, and decode failure. | Resolved |
| F17 | High | Verified | Deferring the Mayberry contract to M7 risks turning extraction into a rewrite after the harness has already committed to a shape. | Final plan §4 | P0 freezes the `./core` surface, state transitions, package name, and protocol version before M0; M0 does not start without sign-off. | Resolved |
| F18 | Medium | Verified | The execution-time guard was not tied to configuration lifetime: an operator could enable the flag with no service, or reload into a half-applied state. | Final plan §2, M4 | Configuration is read at mount, so the guard sees one complete configuration; a failing combination is rejected loud and covered by a test that constructs the tool with the flag on and no service. | Resolved |
| F19 | Medium | Verified | Retiring a pick on provider/model acknowledgement could let a stale acknowledgement retire a newer pick with the same route. | Final plan M5 | A pick retires when the exact `model/selection` record that recorded it is observed; the record carries the full selection, so an older acknowledgement cannot match a newer pick. | Resolved |

### Second review — independent, source-level

| ID | Severity | Evidence status | Finding | Evidence/reference | Resolution | State |
| --- | --- | --- | --- | --- | --- | --- |
| F20 | Blocker | Verified | `Session.append` cannot write `ignorable: true`; only `#appendRecord` can, and only for `plugin:` types. The plan's claim that older readers skip the event was false. | `packages/core/session/src/index.ts:798-850` | The event is declared required-on-read; the ignorable claim and the core change are dropped. Compatibility consequence documented, and no shipped session carries the event while the feature is off. | Resolved |
| F21 | High | Verified | Precedence between config base, operation start, explicit effort, inheritance, user pick, and mode pin was undefined; one acceptance criterion would fail either way. | Final plan §3.2 table | Explicit precedence table; the operation minimum applies only to model-facing delegation overrides; the config base never starts a child. | Resolved |
| F22 | High | Verified | `inherit_effort: false` never reaches `resolveChildAgentOptions`; `manager.ts:390` calls it with three arguments, so the parent effort is copied. | `packages/subagent/subagent/src/manager.ts:390` | The function reads `effortInherited` from `requested` and deletes the inherited effort; no signature change, no manager edit. | Resolved |
| F23 | High | Verified | The delegation operation is not durable: the descriptor is version 3, cold resume rebuilds only provider/model/effort, so a resumed child loses its operation. | `packages/subagent/subagent/src/descriptor.ts:42-48`; `manager.ts:1349-1375` | Accepted and documented: a cold-resumed child starts at `standard`; persisting it would need a versioned descriptor and a persistence change. Tested. | Risk accepted |
| F24 | High | Verified | Two independent enable flags; M6 set one; rollback left the other true, turning every delegation into an error. | `packages/bundle/base/cordis.patch.yml:380-395` | Both rows are set together in M6 and in rollback; the four flag/service combinations are tested; a mismatch fails loud naming both rows. | Resolved |
| F25 | High | Verified | Deriving the base from `model/selection` would make `packages/llm` depend on `packages/api`, with a cycle risk, and gave the controller a reason to import policy types. | `packages/api/session-controller/src/types.ts:35-41` | The base lives in the policy's own decision records; `setBase` takes a raw effort string, so callers need no policy import. | Resolved |
| F26 | High | Verified | M5's ACP change was aimed at a file with no Agent, and ACP never appends `model/selection`, so an ACP pick was lost on resume. | `packages/acp/acp/src/model-control.ts:32-53`; `session.ts:129-160` | The change moves to `session.ts`, where the Agent is, and appends a durable base transition; ACP resume is tested. | Resolved |
| F27 | High | Verified | A pick of `off` cannot survive, because the three levels contain no `off` and resolution would rewrite it. | `packages/llm/llm-deepseek/src/serialize.ts:147-156` | An exact-effort base outside the three levels is written verbatim and never escalated. | Resolved |
| F28 | High | Verified | M5 changed the in-memory `consume` but not the durable projection, so a policy-overridden pick stays `pending` forever and re-applies on resume. | `packages/api/session-controller/src/model-selection-projection.ts:39-55` | Projection retires on provider/model, `stateVersion` bumped, resume tested. | Resolved |
| F29 | High | Verified | M3 omitted the persistence-change record and the four generated artifacts, so `doc-sync` would fail. | `scripts/gen-persistence-catalog.ts:28-31`; `scripts/run-gates.ts:856` | M3 adds the bilingual record and regenerates all four artifacts, gated on `verify-persistence-changes`. | Resolved |
| F30 | High | Verified | The `./core` subpath had no source entry: the path generator emits bare names only, and no `src/core.ts` was planned. | `scripts/gen-tsconfig-paths.ts:97-117`; `tsconfig.base.json:143,185` | `src/core.ts` plus hand-written paths for both specifiers and a cross-package source-import test. | Resolved |
| F31 | Medium | Verified | A committed scenario does compact, so the "no scenario compacts" claim was false and M2's compatibility gate was missing. | `snapshots/session/compaction-output-reserve/session.v4.jsonl` | Claim corrected; that scenario is M2's compatibility gate. | Resolved |
| F32 | Medium | Verified | No test covered an explicit effort outside the route's vocabulary. | `packages/llm/llm/src/index.ts:918-936` | Added to the required cases. | Resolved |
| F33 | Medium | Verified | M0 could not ship alone: no adapter entry, and `verify-product-use` fails. | `scripts/run-gates.ts:370,791` | M0 and M1 land as one change. | Resolved |
| F34 | Medium | Verified | M6 named no file and had no automated gate. | Final plan M6 | Names the profile overlay rows and adds an in-tree fixture profile with a recorded scenario. | Resolved |
| F35 | Medium | Verified | An `agent/request-error` listener could short-circuit `llm-retry`. | `packages/core/agent/src/runtime-types.ts:338-353` | The listener awaits `next()` and returns its action; retry preservation tested. | Resolved |
| F36 | Medium | Verified | "Same registration" is not guaranteed between `resolveModelInfo` and `prepareCall`. | `packages/llm/llm/src/index.ts:756-771`, `:956-971` | Limitation stated; an own-write `UNSUPPORTED_REASONING_EFFORT` falls back to leaving the request untouched; route-swap test added. | Resolved |
| F37 | Medium | Verified | M7 omitted dependency, lockfile, licence, notice, and version-refusal steps. | Final plan M7 | All added, with a refusal test. | Resolved |
| F38 | Medium | Verified | Revision scope across concurrent parent and child agents was undefined, so a child mutation could be invisible to the parent's counter. | Final plan §3.3 | Revision is workspace-scoped; a child mutation invalidates a parent pass; tested. | Resolved |

## Traceability and verification

| Requirement | Planned work | Verification |
| --- | --- | --- |
| R1 compatibility strategy for the tool fields and `inherit_effort` | M1 flag, M4 config flag plus execution-time check, M5 upgrade guide, protocol version | Compatibility cases in §5; existing subagent suite run with the flag off |
| R2 evidence correlated to operation, context, revision | §3.3 identity and revision; M3 projection | Stale-evidence cases: before failure, before a later mutation, other directory, other agent, other command |
| R3 Mayberry owns the core | M0 export boundary, M7 migration | Import-boundary test; M7 deletes the local copy in the same change |
| R4 fixtures and default-effort serialization preserved | "write nothing when equal to the default"; no shipped default change | `pnpm run test:snapshot` unchanged; disabled-path byte comparison |
| R5 regression tests | §5 case list | Named cases per milestone |
| R6 files, order, commands, gates, flags, risks, rollback | §4, §5, §6 | Each milestone has a command gate and a done condition |
| R7 DSH versus Mayberry split | §4 M7; dependency order | M7 cannot start before M6 is verified |
| R8 no unnecessary abstraction, UI, events, classifier | §1 out-of-scope list; single event plus projection | Review check; no client package is touched |

Independent verification: two fresh-context reviewers ran against the repository. The first validated the design note and produced the header-seeding and snapshot-corpus findings; the second audited this plan line by line and produced F20–F38. Both are recorded above with their evidence. The second revision has not been independently re-reviewed, so this report does not claim independent sign-off on the current text.

## Open decisions and residual risks

| Item | Owner | Impact | Next action |
| --- | --- | --- | --- |
| Mayberry package name, `./core` surface, state transitions, and protocol version | User | M0 cannot start without this; extraction later would be a rewrite | Sign P0 off before implementation begins |
| Mayberry release timing | User | M7 cannot start; the core stays in this repository until then | Commit to a release, or accept deferral |
| Approval to change the fork's default level | User | M6 changes real behavior only after this | Approve after M5 is verified |
| Per-request capability lookup cost | Implementer | Latency on routes with remote catalogs | Measure in M3; add the per-turn memo only if material |
| Conservative mutation tracking | Implementer | Extra verification runs | Keep unless real sessions show it clearing too rarely |

## Review limitations

- Mayberry is not accessible from this workspace; the M7 adapter contract is specified by shape, not validated against that codebase.
- No command in this report was executed; the plan's gates are proposed, not demonstrated.
- `tools/result` payload sufficiency is an explicit M3 probe rather than an established fact.
