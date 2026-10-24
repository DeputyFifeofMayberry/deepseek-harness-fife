---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-23-delegated-subagent-usage

English | [中文](2026-10-23-delegated-subagent-usage.zh.md)

## Summary

Adds the log-only `subagent/usage` event. A delegating parent records the provider usage one child epoch incurred, so a conversation's token and spend readings include the work it delegated instead of only its own requests.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-23-delegated-subagent-usage
baseline: false
changes:
  - root: "event:subagent/usage"
    previous: null
    after: "9f45f09ee552545e6a9841eed2c3acb44fdc89a1eea6831a63eafcc972d5f330"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

A new root in the current Session format version. Existing logs contain no such event and remain valid; a reader that predates it refuses a log carrying it, as it does every required-on-read event. Only `dsh-subagent` appends the record, once per settled local child epoch, and it is never model-visible. The token-meter projections add its route buckets to the parent's billed totals and per-route usage while leaving context pressure and the `(turn, step)` replacement slot unchanged, so delegated spend is counted once and never inflates the parent's own context reading.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/subagent/subagent packages/llm/token-meter: 876 tests passed, 1 skipped. The added cases cover epoch folding (route attribution, per-step replacement, nested attribution, zero buckets), the parent append, both token-meter projections, and the activation-policy assertion that a child run adds only its catalog entry and one usage attribution to the parent log.

<a id="dev-note"></a>
## Dev Note

None.
