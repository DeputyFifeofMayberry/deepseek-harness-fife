# Plan Change Log — Verifiability-Based Effort Routing

Source draft: `.agents/notes/proposed/architecture/2026-10-21-verifiability-based-effort-routing.md`, sections `## Proposal` and `## Plan`.
Revised into: `.agents/plans/2026-10-21-verifiability-effort-routing/implementation-plan.final.md`.

C1–C16 come from the first hardening pass. C17–C21 come from the reviewer's response to that pass. C22–C40 come from the second, independent source-level review, which found one blocker and eighteen material issues.

| Change ID | Original section | Change in final plan | Reason / finding ID | Requirement impact | Approval needed? |
| --- | --- | --- | --- | --- | --- |
| C1 | M4 | Tool fields are gated by the tool's own `effortPolicy` config, with an execution-time cross-check, instead of by live service presence at `apply()` | F1 | R1 (compatibility), R6 (flags) | No |
| C2 | M5 | A pick retires on provider/model acknowledgement rather than effort equality; the picked effort becomes the base through `setBase` | F2 | R1 | No |
| C3 | M3 | Escalation state moves from in-memory storage to an `ignorable` decision event plus a registered session projection | F3 | R2 (evidence), R4 (fixtures) | No |
| C4 | M3 | Decision records are emitted only on transitions, not per request | F4 | R6 (no duplicate systems) | No |
| C5 | M1, M3 | Added regeneration of `KNOWN_SESSION_EVENT_TYPES` and the persistence-catalog gate; the event is explicitly `ignorable` | F5 | R1, R4 | No |
| C6 | M3 | Verifier rules become closed data (`tool`, `commandPattern`, `passPattern`, `failPattern`, `outcome`) instead of an unspecified "predicate" | F6 | R2 | No |
| C7 | §3.3 new | Every non-verifier shell result counts as a mutation, not only `write` and `edit` | F7 | R2 | No |
| C8 | M2 | Compaction treats an absent or disabled policy as "feature off" and does not fail; the tool path fails loud instead | F8 | R1 | No — accepted asymmetry |
| C9 | M3, §5 | Added explicit SDK projection regeneration and `pnpm run test:snapshot` to the M3 gate | F9 | R5, R6 | No |
| C10 | M2 | "Byte-identical when disabled" becomes a required enabled/disabled test pair | F10 | R4, R5 | No |
| C11 | M6 | The fork patch shape is stated; concrete command values stay deployment-owned | F11 | R6 | Yes — M6 changes a real default |
| C12 | M4 | Out-of-process children are documented and tested to start at `standard` when the operation field is dropped | F12 | R2, R5 | No |
| C13 | M3 | `EFFORT_POLICY_PROTOCOL_VERSION` is carried in the decision and the event | F13 | R3 (Mayberry) | No |
| C14 | §3.1 | Per-request capability resolution is accepted, with a measurement step in M3 and a documented fallback | F14 | R6 | No |
| C15 | §2 new | Three previously implicit assumptions became explicit milestone probes: projection resume, `tools/result` sufficiency, out-of-process field dropping | F3, F12, F14 | R5, R6 | No |
| C16 | §3.4 new | The base is durable through the existing `model/selection` record; no second event type is introduced | F3 | R3, R8 | No |
| C17 | §3.3 | Mutation tracking becomes three-way: known mutation, known read-only, unknown | F15 | R2, R5 | No |
| C18 | §3.4 | Added durability rules: append-only replay, per-session isolation, `clear` reset, fail-closed retention on undecodable state | F16 | R2, R4 | No |
| C19 | §4 new | P0 freezes the Mayberry contract before M0; M0's prerequisite changed from none to P0 | F17 | R3, R7 | Yes — user sign-off |
| C20 | §2, M4 | Configuration lifetime tied to mount; guard covered by a flag-on/no-service test | F18 | R1 | No |
| C21 | M5, §5 | A pick retires on the exact `model/selection` record; stale-acknowledgement test added | F19 | R1, R5 | No |
| C22 | §3.4, §6 | The decision event is required-on-read, not ignorable; the false compatibility claim and the core change are dropped | F20 | R1, R4 | No — documented compatibility cost |
| C23 | §3.2 new | Explicit precedence table; operation minimum scoped to delegation overrides only | F21 | R1, R2, R5 | No |
| C24 | M4 | `resolveChildAgentOptions` reads `effortInherited` from the request instead of taking a new argument | F22 | R1 | No |
| C25 | M4, §8 | Cold-resumed children lose the operation and start at `standard`; documented and tested instead of a descriptor v4 | F23 | R5 | No — accepted limitation |
| C26 | M4, M6, §6 | Both tool rows and the policy row are switched together; four combinations tested; rollback names all three | F24 | R1, R6 | Yes — M6 |
| C27 | §3.4 | Base stored in the policy's own records; `setBase` takes a raw effort; no `packages/llm → packages/api` dependency | F25 | R3 | No |
| C28 | M5 | ACP change moved to `session.ts`, where the Agent lives; ACP resume tested | F26 | R1, R5 | No |
| C29 | §3.1, M5 | Exact-effort base (`off` or any id) written verbatim and never escalated | F27 | R1, R5 | No |
| C30 | M5 | `model-selection-projection.ts` included; `stateVersion` bumped; resume test | F28 | R5 | No |
| C31 | M3 | Persistence-change record and all four generated artifacts added to M3 | F29 | R4, R6 | No |
| C32 | M0 | `src/core.ts` barrel plus hand-written `paths` for the package and `/core`; source-import test | F30 | R3 | No |
| C33 | §2, M2 | Corrected: `compaction-output-reserve` does compact; it becomes M2's compatibility gate | F31 | R4 | No |
| C34 | §5 | Added the unadvertised-explicit-effort case | F32 | R5 | No |
| C35 | M0+M1 | The core and the adapter land as one change | F33 | R6 | No |
| C36 | M6 | Names the three overlay rows and adds an in-tree fixture profile with a recorded scenario | F34 | R6 | Yes — M6 |
| C37 | M3 | `agent/request-error` awaits `next()`; retry-preservation test | F35 | R5 | No |
| C38 | §3.1 | Stated the two-registration limitation and the fallback for an own-write unsupported effort; route-swap test | F36 | R1, R5 | No |
| C39 | M7 | Dependency, lockfile, licence, notice, and protocol-version refusal steps added | F37 | R3, R7 | No |
| C40 | §3.3 | Revision is workspace-scoped; a child mutation invalidates a parent pass; tested | F38 | R2, R5 | No |

## Preserved decisions and scope

- The three lanes, the three levels, and the level-to-effort rules are unchanged.
- The delegation operation table and its minimums are unchanged, including rejection of an explicit effort below the minimum.
- Children never inherit the parent's level by default; `inherit_effort` is the opt-in.
- The shipped composition keeps `standard` and the policy writes nothing when the resolved effort equals the model default, so recorded sessions stay byte-identical.
- The portable core is owned by DSH until Mayberry publishes its package; DSH lands first and M7 is last.
- No client or UI work, no model-based classification, no rule DSL, no new capability flag across subagent providers.

## Changes not made

- **A second session event for the base selection.** Rejected because `model/selection` already records a pick; a new event would duplicate durable state (C16).
- **A subagent capability flag for the operation field.** Rejected to avoid touching six providers; out-of-process children fall back to `standard`, which is the safe direction (C12).
- **A per-route capability cache.** Deferred rather than adopted, because stale metadata after a Models-page change would pin an unsupported effort. The plan measures the cost instead (C14).
- **Optional Cordis injection for the tool schema.** Rejected: no package in this repository uses that form, and the config flag plus execution check needs no new loader behavior (C1).
- **Changing the shipped default to `low`.** Rejected for this repository; the fork enables it through its profile patch (C11).
- **Classifying read-only shell commands by heuristic.** Rejected in favour of an explicit curated pattern list, because a wrong guess in the read-only direction lets a stale pass clear an escalation (C17).
