---
kind: upgrade-guide
description: "Reasoning effort can now be routed by the effort policy, and a request naming an effort its route does not advertise is dispatched at the route default instead of failing the turn."
---

# Reasoning effort is routed by verification, and picks set its base

English | [中文](guide.zh.md)

## Change

A new `effort-policy` row routes each request's `reasoningEffort` by verifiability: the configured base unless a configured verification failed, one level higher while it stays unresolved, and back after that same check passes. It ships disabled, and a deployment that never enables it writes no event and changes no request.

Three surfaces change for callers who upgrade:

- **`cordis.yml`.** `effort-policy` takes `enabled`, `baseLevel`, `verifiers`, `mutators`, `readOnlyCommands`, `ignoredArgumentKeys`, `infrastructureFailureCodes`, and `shellTools`; `tool-subagent` gains `effortPolicy` (default `false`), which adds `operation`, `verification`, and `inherit_effort` to the model-facing tool and requires the `effort-policy` row enabled in the same composition. `ignoredArgumentKeys` defaults to `description`: those arguments are removed before a verifier is matched and before its identity is built, so a caller that retitles the same check still passes or fails that one check.
- **Model selection.** The Web picker and ACP `reasoning_effort` now record the pick as the policy's durable base through `setBase`: a level name sets the level, any other advertised effort is written verbatim and never escalated, and the provider default is `standard`. The pending pick retires when a request acknowledges its provider and model, not its effort, so a policy-chosen effort no longer keeps a pick pending.
- **Request effort fallback.** A request whose effort the bound route does not advertise is now rebound at the route's default with a warning instead of failing the turn. This applies with or without the policy.

A Session written while the policy is enabled contains the required `effort/decision` event, which an older build refuses to open. Downgrading is not supported for such a Session; disabling the feature stops new ones.

## Migration

1. Leave `enabled: false` to keep today's behavior; no other step is required.
2. To enable routing, set `effort-policy` `config.enabled: true` and a `baseLevel`, list the checks that may raise effort under `verifiers`, and set `tool-subagent` `config.effortPolicy: true` on every delegation row. Flipping only one of the two delegation rows is a loud misconfiguration, not a silent divergence. A patch replaces a row's whole config and does not descend into an agent preset, so a composition that mounts the delegation rows inside one — the Web and Desktop apps do — needs a profile patch that restates that preset's `config.plugins` with the flag added.
3. Restart the process and confirm the migration: run one prompt, then check that a failing configured verifier logs `effort/decision` and raises the next request's `reasoningEffort`, and that a passing run of the same check returns it to the base.
4. To roll back, set `effort-policy` `config.enabled: false` and every `tool-subagent` `config.effortPolicy: false` together. Requests return to today's behavior; Sessions already written with `effort/decision` stay readable by this release.
