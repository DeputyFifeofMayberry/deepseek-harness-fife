---
name: mayberry-implement
description: Execute accepted work inside the stop machinery — the Human Checkpoint at step 9 and how live stops bound implementation.
---

# mayberry-implement

Implementation runs inside the stop machinery: the work proceeds only while
no live condition holds, and the Human Checkpoint at step 9 is the one
place the user's answer moves the walk. The gates themselves and the
verification runner live in the mayberry-verify skill; the normative rule
registry is `.mayberry/RULES.md`.

## Human checkpoints

At step 9 — Approve a bounded plan — the walk stops for the Human
Checkpoint: W10's questions
(`.mayberry/worksheets/W10_Human_Checkpoint.md`), answered by the user, in
the user's words. The checkpoint is a question, not a failure and not a
gate, and never renders as one: it opens with the word `checkpoint` and
the unresolved question itself — never a gate ID, never failure language —
then carries the same four lines every stop carries (the gates section of
the mayberry-verify skill defines them). A checkpoint and a gate failure
never render identically, even side by side in one reply.

Raising it: write `checkpoint: {question, opened}` in `.mayberry/state.yaml`
(`question` the checkpoint's question as asked, `opened` today's ISO date)
and record the raise like any stop (the gates section owns the
`stop_raised` ledger entry and its before-session-end deadline). While a
checkpoint is open the `walk` advance write blocks (the gates section's
stop machinery): an approve is step 9's approval, and the step moves only
when it is given.

Only the user's answer lifts it — W10's teach-back decision: approve,
investigate, revise, or escalate. Only approve advances the walk. An
approve appends the closing ledger entry with the installed command first
(`ledger append --change "stop_cleared" --check <the checkpoint> --result
answered`)
— if the append fails, the `checkpoint` key stays, say why in one line,
and retry — then removes the `checkpoint` key (`checkpoint close`) and
advances the walk.
Investigate, revise, and escalate are not approvals: the checkpoint stays
open, the walk holds at step 9, and the answer names its next step — the
investigation, the revision, or the escalation is the named next action.
No ledger entry records a non-approval answer. The open key is the record
of the open question — there is no overrule flow: gates close by
overrule, checkpoints close by answer. "Continue" at an open checkpoint
states in one line that the question is unanswered and writes nothing;
the checkpoint stays open.

The risk profile scales the depth, never the stop: Quick answers the
relevant subset of the questions in a few sentences of the user's own
words, and that counts as answered; Standard and Deep answer W10 as
shipped. No profile skips it. Only step 9 raises a checkpoint — W10 on
demand at any other step stays a worksheet lens, not a halt. The quick
route (mayberry-change skill) still passes step 9 when any material
decision is unresolved; a quick change with nothing material to decide
states that in one line and proceeds.

If the session ends with a checkpoint open, the gates section's
session-end rule applies, and the next session's position statement leads
with the question verbatim from state — resuming never re-explains it.
