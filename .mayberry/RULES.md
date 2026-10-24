# The rule registry (normative)

One source of truth for stop classes, precedence, override semantics, and
what may never be waived. SKILL.md's gates section, the worksheets, and the
state vocabulary derive from this file; where prose elsewhere seems to
disagree, this file wins and the disagreement is a defect to report. Gate
conditions condensed from the workbook's gate ladder (WORKBOOK.md,
blocking-evidence column).

## Stop classes

Three kinds of stop exist. They never render alike.

1. **Gate failure** — overridable by recorded user decision. A gate
   evaluates at its step boundary, before the first action of the step it
   guards. Named `G0`-`G5` with the failed condition.
2. **DO-NOT-PROCEED condition** — never overridable. Six named conditions;
   while one is live, implementation halts. Named by the condition.
3. **Human checkpoint** — a question, not a failure. Raised only at step 9.
   Closes only by the user's answer.

## The gates

Each gate evaluates before the first action of the step it guards, against
the walk's named evidence. A gate fails when one of its conditions holds.

- **G0 — safe to work?** before step 2. Conditions: an unknown target;
  unpreserved valuable state; unresolved consequential behavior; unsafe
  credentials; missing authority.
- **G1 — task verified?** before step 11. Conditions: a failed or missing
  required acceptance or regression check; an unreviewed oracle change; new
  protection that cannot be discovered.
- **G2 — integration ready?** before step 15. Conditions: a required clean
  build, static, or test check failing; missing combined-state evidence;
  unresolved conflict behavior.
- **G3 — release ready?** at step 17. Conditions: missing or failed
  applicable artifact, upgrade, migration, compatibility, security,
  performance, or evaluation evidence.
- **G4 — rollout healthy?** before step 19's first action, after step 18
  closes. Conditions: a wrong installed identity or configuration; a
  critical workflow or integrity failure; an agreed error/latency stop
  criterion reached.
- **G5 — baseline maintained?** immediately after G4, same boundary, in ID
  order. Conditions: expired protection or drift that invalidates the next
  dependent task or release; an unresolved serious support/security
  exposure.

Until the verification epic ships executable evidence scripts, a gate
passes only when every condition it checks names its `[observed]` evidence
in the reply — name the evidence or the gate fails.

## The six DO-NOT-PROCEED conditions

Halt implementation the moment one is live:

1. Unresolved behavior, or an untested assumption the work depends on.
2. An uninspected code or data path you are about to change.
3. A new security, data, or operational boundary with no review.
4. A destructive action without a tested recovery.
5. Permissions or scope beyond what the user authorized.
6. Missing, stale, or foreign evidence where proof is required.

Safe, read-only investigation within already-authorized scope always
continues; the response to a stop is a specific next question, experiment,
preservation step, or approval — never another blind implementation action.

## Missing evidence: one classification

Missing required evidence classifies by where it bites, and only one way:

- **During implementation** it is DO-NOT-PROCEED condition 6.
- **At a gate boundary** (G1 before step 11, G3 at step 17) it is that
  gate's failure, naming the missing evidence.

Either way the clearing requirement is identical: produce the evidence. An
override of G1 or G3 records the decision and proceeds; it does not
re-label the condition — the DO-NOT-PROCEED list still halts new
implementation the moment the same missing proof blocks an action. Gate
overrides therefore cannot launder a missing-proof stop into permission.

## Precedence at one boundary

When more than one condition is live at the same boundary:

1. Gate and DO-NOT-PROCEED failures first, in ID order (G0-G5, then the six
   conditions in listed order).
2. The open Human Checkpoint renders last, as the question.

A bare "continue" with more than one live condition asks which condition it
targets; no decision is recorded until one is named. A stop never
interrupts a task in flight: no new implementation action starts, and the
in-flight action halts at its next internal step. When a gate sits after
the advance it guards (G4 and G5 evaluate after step 18 closes, with step
19 already written), the live gate halts step 19's first implementation
action while it stays live.

## Override semantics (exact effects)

- **Overriding a gate** records, in order: a ledger entry (`stop_overruled`,
  check = the gate ID, result = `overruled`, notes = the user's decision),
  confirmed first; then an `overruled_stops` state entry (`{at, condition,
  decision, ledger_ts}`) pointing at that exact ledger record. Effect: the
  guarded action may proceed with what still works. The overrule is scoped
  to the named condition at that boundary — it does not waive the gate at
  later steps, and it never applies to a DO-NOT-PROCEED condition.
- **"Continue" at a DO-NOT-PROCEED condition** is refused in one line, and
  each refusal is recorded in the ledger (`stop_refused`, check = the
  condition, result = `refused`). There is no override path.
- **A checkpoint** closes only by the user's answer; approve advances the
  walk, the other answers name the next action and keep it open. There is
  no overrule flow.

## Nonwaivable

- The six DO-NOT-PROCEED conditions.
- The Human Checkpoint's answer requirement at step 9.
- Evidence honesty: an empty cell means unanswered, never approved; "not
  run" means unverified; a blank is not approval.
- Append-only records: `repairs`, `walk_history`, `overruled_stops` grow at
  the tail only, and the corrections path is a recorded repair.

## Ledger vocabulary

Exactly these ledger `change` values record stop lifecycle, written through
the installed command: `stop_raised` (result `open`), `stop_overruled`
(result `overruled`), `stop_refused` (result `refused`), `stop_cleared`
(result `answered`). The handoff's four-line block is a copy, never the
record.

## Four-line stop block

Every live stop — gate, DO-NOT-PROCEED, or checkpoint — renders the same
four lines, always all four: the condition; `Blocked:` what may not
proceed; `Still works:` what continues; `Decision needed:` the question or
the clearing requirement. A checkpoint opens with the word `checkpoint` and
the unresolved question — never a gate ID, never failure language.
