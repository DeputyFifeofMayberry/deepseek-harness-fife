---
name: mayberry-verify
description: Establish what is done — gates G0-G5, the six DO-NOT-PROCEED conditions, the verification runner, and the evidence-gated completion decision.
---

# mayberry-verify

Completion means executed evidence. This skill owns the gates, the six
DO-NOT-PROCEED conditions, the verification runner, and the completion
decision. The normative rule registry is `.mayberry/RULES.md` — where any
prose seems to disagree with it, it wins and the disagreement is a defect
to report.

## Gates and DO-NOT-PROCEED stops

The walk halts before unsafe progress. Two stop kinds, never rendered
alike: a **gate failure** names the gate ID and the failed condition; a
**DO-NOT-PROCEED stop** names the condition. Both open with the same
four lines, always all four — the condition; `Blocked:` what may not
proceed; `Still works:` what continues (read-only investigation within
already-authorized scope always does); `Decision needed:` the question
or the clearing requirement. One four-line block per live condition —
the walk stays stopped while any condition remains live, and a continue
refusal applies to the condition it was asked about; a bare "continue"
with more than one live condition asks which condition it targets, and
no decision is recorded until one is named. At one boundary the live
conditions render in ID order — gate and DO-NOT-PROCEED failures first,
an open checkpoint last, as the question. A stop never
interrupts a task in flight; when any live stop — gate or DO-NOT-PROCEED —
goes live mid-task, no new implementation action starts and the in-flight
action halts at its next internal step. A gate stop blocks the `walk`
advance write: the step moves only when the gate passes or the overrule is
recorded — and when a gate sits after the advance it guards (G4 and G5
evaluate after step 18 closes, with step 19 already written), the live
gate halts step 19's first implementation action while it stays live. If
the session ends with a stop open, its four lines go in the
handoff's Recheck list section, and the next session's position
statement renders it as the layer-3 blocker — it always changes the next
action, which is clearing or deciding the stop.

Raising a stop is recorded: append a ledger entry with the installed
command (`node .mayberry/scripts/mayberry-api.js ledger append --change
"stop_raised" --check <the gate ID or condition> --result open --notes
<what is blocked>`) before the session may end — the
handoff's four lines are a copy, not the record. If the append fails, say
why in one line and retry; a stop that cannot be recorded still ships its
four lines in the handoff's Recheck list — the raise is never silent.

The gates, at their steps — each evaluates before the first action of
the step it guards: G0 (safe to work?) before step 2; G1 (task
verified?) before step 11; G2 (integration ready?) before step 15; G3
(release ready?) at step 17; G4 (rollout healthy?) before step 19's
first action, after step 18 closes; G5 (baseline maintained?)
immediately after G4 at the same boundary, in ID order. Each gate's
conditions, condensed from the workbook's gate ladder — WORKBOOK.md's
blocking-evidence column, the inception-cited source — one line per gate;
a gate fails when one of its conditions holds:

- G0 — safe to work: an unknown target, unpreserved valuable state,
  unresolved consequential behavior, unsafe credentials, or missing
  authority.
- G1 — task verified: a failed or missing required acceptance or
  regression check, an unreviewed oracle change, or new protection that
  cannot be discovered.
- G2 — integration ready: a required clean build, static, or test check
  failing; missing combined-state evidence; unresolved conflict behavior.
- G3 — release ready: missing or failed applicable artifact, upgrade,
  migration, compatibility, security, performance, or evaluation
  evidence.
- G4 — rollout healthy: a wrong installed identity or configuration, a
  critical workflow or integrity failure, or an agreed error/latency
  stop criterion reached.
- G5 — baseline maintained: expired protection or drift that invalidates
  the next dependent task or release, or an unresolved serious
  support/security exposure.

At a gated step,
answer the gate's question against the walk's evidence. Executed checks run
through the installed runner (`node .mayberry/scripts/mayberry-api.js verify
run --criterion <id> --command "<cmd>" [--expect ...]`), which records the
ledger proof and refuses vacuous suites; until tiering arrives, completion
is gated on a change's declared criteria (`change criteria --changes ...`
declares them). A gate passes only when every condition it checks names its
`[observed]` evidence or executed proof in the reply — name the evidence or
the gate fails. The six DO-NOT-PROCEED conditions
are never a gate's evaluation; they stay DO-NOT-PROCEED class.

The six DO-NOT-PROCEED conditions — halt implementation the moment one
is live: unresolved behavior or an untested assumption the work depends
on; an uninspected code or data path you are about to change; a new
security, data, or operational boundary with no review; a destructive
action without a tested recovery; permissions or scope beyond what the
user authorized; missing, stale, or foreign evidence where proof is
required.

The continue ruling: **gate failures are overridable, DO-NOT-PROCEED
conditions are not.** "Continue" at a gate failure proceeds with what
still works and records the decision — the ledger entry via the installed
command (`ledger append --change "stop_overruled" --check <the gate ID>
--result overruled --notes <the user's decision>`, `ts` the entry's
timestamp), then — only
once the ledger write is confirmed — the `overruled_stops` entry in
`.mayberry/state.yaml` `{at, condition, decision, ledger_ts}`, `ledger_ts`
the ledger entry's `ts`, pointing at the exact ledger record; if the
state write fails after the ledger confirms, retry the state write only —
never append a second ledger entry. "Continue" at a DO-NOT-PROCEED stop
is refused in one line and each refusal is recorded in the ledger
(`ledger append --change "stop_refused" --check <the condition> --result
refused`):
the condition must clear; only read-only investigation within
already-authorized scope proceeds meanwhile. (Recorded as the OQ-5
second-clause ruling, 2026-10-11.)

## Review and completion

Review the diff before recording completion: behavior, failure paths,
data/security, compatibility; oracle, fixture, snapshot, skip, selection,
and threshold changes are inspected, never assumed. Then the completion
decision is the runner's, not the agent's impression: `change check`
renders each declared criterion's verdict from the ledger — pass, stale,
or missing — plus orphan runs for undeclared criteria. `change complete`
refuses while any criterion lacks fresh, valid proof for that change;
without declared criteria it completes ungated and says so. A revision
(`change revise --reason ...`) watermarks earlier proof stale. `resume`
classifies the recorded proof reusable or stale against the current
candidate fingerprint.
