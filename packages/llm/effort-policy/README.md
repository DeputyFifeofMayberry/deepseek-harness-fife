---
description: "Reasoning-effort policy: a portable decision core that resolves an effort level from operation and evidence, plus the Cordis service that applies it to every request."
kind: "package-reference"
---

# @deepseek-ai/dsh-effort-policy

English | [中文](README.zh.md)

## Summary

The core resolves one of three effort levels against a route's advertised vocabulary, raises the level only when a configured verification fails, and holds it until that same verification passes. It is plain data in and out, with no Cordis, session, or LLM type, so another harness can reuse it.

The service applies that decision to every request of every Agent it can see, records one durable transition per change, and pins summarization to the low level. It ships disabled: a deployment that never enables the row writes no event and changes no request.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Import `@deepseek-ai/dsh-effort-policy/core` and call `decide(capability, state)` with the route's advertised efforts and the observed state. The result names the rule that produced it, so a caller can record why a request ran cheap.

Inside the harness, enable the `effort-policy` row and let the service work: it listens on its own scope, reads `agent/request`, and returns the proposed configuration with at most `reasoningEffort` replaced. Callers that need an explicit choice call `setBase(session, effort)`; a pick of one of the three levels sets the base, and any other advertised value (such as `off`) is written verbatim and never escalated. The Session Controller and ACP route their model pickers through that method, so a pick changes the routing base instead of competing with it.

### When to choose it

Reach for this package when a host already knows what a request is for and needs one consistent rule for choosing effort. Do not use it as a task classifier: it has no prompt, no model, and no opinion about what a request means.

### When not to use it

Do not use it to validate effort values against an adapter. The adapter remains the authority; the core only chooses among values it is told are available.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The decision rules live in `@mayberry/effort-policy-core`: the protocol version and plain data types, level resolution against an advertised vocabulary, and precedence, the operation table, and evidence transitions. This package depends on it and `src/core.ts` re-exports it under the unchanged `./core` entry, so a non-Cordis host imports the rules from one owner. `src/protocol.ts` refuses a core whose protocol differs; `src/evidence.ts` classifies tool results; `src/events.ts` declares the durable record and its projection; `src/service.ts` is the Cordis adapter.

The no-write rule is deliberate: when the chosen level resolves to the adapter's default effort, the decision carries no `effort`, because a written default is a different durable request fact from an adapter default. The same rule strips an effort inherited from the logged header once nothing is decided, so a cleared escalation cannot keep raising the next request.

Evidence is one settled tool result, classified three ways. A configured verifier decides pass or failure; an error from a text verifier is infrastructure because the check did not run; a configured mutator and an unlisted shell command advance the workspace revision, while a configured read-only pattern leaves it. A failure opens an escalation carrying the verifier identity (`tool`, arguments, working directory) and the revision at that moment. Both matching and identity read the arguments after `ignoredArgumentKeys` are removed — `description` by default, because a command label does not change what the command does — so a caller that retitles the same check still passes or fails that one check. A pass clears it only when the identity matches, the observation is later, and no mutation happened since.

The durable record is the `effort` session projection folded from `effort/decision` events, so a resumed Session reconstructs the open failure without touching the request header. The service reads that projection through `ctx.root` on every request: a missing service, a missing projection, or a record that fails the projection schema is an unavailable dependency, not base state. The last state the policy read successfully is retained across such a failure; a Session with nothing retained fails loud, because guessing base would lower an unknown level.

A delegated child starts at what its Agent was created with. `AgentOptions.effortOperation` fixes a starting level (`plan`/`review` `deep`, `mechanical` `low`, the rest `standard`); an effort the delegating tool named wins over it and is written verbatim as an exact start, so it is never escalated. A recorded pick or base on that Session outranks both, which is why a child's own escalation still works from its operation. The delegating tool (`dsh-tool-subagent`) owns the model-facing fields and refuses to start a delegation when its `effortPolicy` flag is on and this service is absent or disabled.

Listener ownership is per Agent and per dependency generation. A generation attaches one listener per live Agent, releases it when the Agent is disposed, and releases all of them when the generation unloads or the policy itself is disposed. A replacement generation attaches to the Agents that exist when it starts and to those created afterwards.

-----

<a id="model-experience"></a>
## Model Experience

### Request effort follows verification

#### What the model sees

The request's `reasoningEffort`, which the policy may set to the resolved level, leave at the adapter default, or drop. It never changes `provider`, `model`, or any other request field, and it adds no prompt text and no tool.

#### Token effect

Only the configured base and unresolved failures change reasoning tokens. A cleared escalation returns the next request to the adapter default, and an exact pick such as `off` is sent as chosen.

#### KV Cache effect

None. The policy changes one request control and leaves the message prefix untouched.

## Known Limitations and Deferred Work

- **A required event makes enabled Sessions unreadable by older builds** — `effort/decision` cannot be marked ignorable, so a build older than the one that wrote it refuses the Session. A deployment that never enables the policy writes nothing.
- **Revision is workspace-scoped and over-approximates** — an unlisted shell command counts as a mutation, so a legitimate pass can be rejected as stale and the escalation stays raised until the next matching pass.
- **Every request costs one capability lookup** — `resolveModelInfo` runs per request on top of the loop's own preparation; a route backed by a remote catalog pays that lookup per step. A per-turn memo keyed by route is the recorded fallback, not yet implemented.
- **A route replaced between the policy's lookup and the loop's bind dispatches at the route default** — the loop drops the unsupported effort, logs a warning, and rebinds, so that step runs at a different level than the policy decided; the logged header records what was dispatched.
- **An unreadable record retains the last level only within one policy instance** — after a restart with an undecodable record there is no last state to retain, so the request fails loud instead of falling back to base.
- **A cold-resumed child loses its operation** — the delegation descriptor stores provider, model, and effort only, so a resumed child starts at the configured base level rather than its original operation; an inherited effort is an exact start and is never escalated.
- **Out-of-process children get no operation** — an SDK provider copies the four named route fields, so `effortOperation` and `effortInherited` do not cross the process boundary and such a child starts at the configured base level.
