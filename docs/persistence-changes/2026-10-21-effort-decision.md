---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-21-effort-decision

English | [中文](2026-10-21-effort-decision.zh.md)

## Summary

Adds the log-only effort/decision session event, which records one reasoning-effort transition: the durable base, exact effort, or open verification failure after the change, plus the rule that produced it.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-21-effort-decision
baseline: false
changes:
  - root: "event:effort/decision"
    previous: null
    after: "69d81cfb2452d110c8f47a8d5a8b1a98e4bcae78443a92b009a20e32160300d4"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Additive and required-on-read. Existing logs contain no such event, so current readers are unaffected. A build that predates the member refuses a session written while the policy is enabled; the policy ships disabled, so no shipped session contains one.

<a id="verification"></a>
## Verification

The persistence catalog was regenerated and the event appears in known-event-types.ts and docs/persistence-schema.json. The effort-policy unit and integration suites cover decision recording, escalation, recovery, stale rejection, disabled behavior, and session restoration.

<a id="dev-note"></a>
## Dev Note

None.
