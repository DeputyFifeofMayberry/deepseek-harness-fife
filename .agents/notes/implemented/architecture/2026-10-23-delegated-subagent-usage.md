# Agent Note: Delegated usage is attributed to the delegating parent

Status: implemented

English | [中文](2026-10-23-delegated-subagent-usage.zh.md)

## Problem

A delegation ran a child Session, and every token it spent settled in that child's log. `tokenUsage` and `usageByRoute` folded one Session's own events, so a conversation's usage reading covered only the requests it issued itself. A conversation that delegated three analyses reported 38.0M of the 162.7M tokens it was billed for, and users comparing that reading with the provider's usage export saw a 4.3× gap with no way to close it.

## Decision

`packages/subagent/subagent/src/delegated-usage.ts` appends one `subagent/usage` record to the delegating parent when a local child epoch settles. The record carries the epoch's provider counters, deduplicated per `(turn, step)` and grouped by the route each settlement used, plus the child's own nested attributions so a root parent sees the whole tree. `SubagentManager.attributeDelegatedUsage` writes it after result capture and contains any refusal so accounting never changes the run.

`tokenUsage` (state version 3) and `usageByRoute` (state version 2) fold the record into billed totals and per-route buckets. They leave the last-sample slot and `contextPressure` untouched: the parent pays for its children's requests, and its own context reading stays its own. The state version bumps discard cached projection rows whose totals predate the fold.

## Verification

Folding the stored logs of the conversation behind this note reproduces the provider export: 162,696,320 tokens across the parent and its three children against 164,167,633 exported for the hour, the difference being a partly elapsed hour. `pnpm exec vitest run packages/subagent/subagent packages/llm/token-meter` passes with 876 tests, including epoch folding, the parent append, both projections, and the activation-policy assertion that a child run adds only its catalog entry and one usage attribution.

## Alternatives considered

**Read-time roll-up in the client.** The sidebar could sum descendant projections where they are loaded. That leaves every non-UI consumer (SDK, ACP, JSON stream) undercounting and yields an incomplete figure whenever a child Session is not loaded.

**Attribute at the tool result.** A usage payload inside `tool/result.meta` needs no new event, but the fold would then parse an opaque presentation field owned by the producing tool, making a cross-package contract implicit.

**Append a record per assistant settlement.** A crash-proof trail with no epoch bookkeeping, at one event per child model call on the parent — roughly 230 records for one hour of delegation.

## Consequences

A conversation's usage and spend readings now equal what the account was charged for the whole tree, and the sidebar reports delegated spend without a separate surface. Resuming a continuable child adds only the later epoch, so the totals stay exact across restarts. A child epoch that never settles because the host process died leaves its usage unattributed, since only settlement writes the record. A parent log carries child routing identities, so a second provider's model names appear in the parent's `usageByRoute` buckets beside its own. This extends the reading [projected token usage](2026-07-29-projected-token-usage-and-request-context.md) defined from one Session's own requests; that unit, its surface pricing, and `contextPressure` are unchanged.
