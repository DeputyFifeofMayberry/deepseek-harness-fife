---
name: mayberry
description: Mayberry session opener — the position statement from state, the route to the right skill, with a wrong-position guard.
---

# mayberry

This pack is installed in this project under `.mayberry/`. This skill is the
router: open here, name the position, and route. The family by intent:

- **mayberry-onboard** — adopt a project: first session, X-Ray, risk profile.
- **mayberry-change** — define and manage the next bounded change: placement,
  worksheet generation and regeneration, profiles.
- **mayberry-implement** — execute accepted work: checkpoints and the stop
  machinery while actions run.
- **mayberry-verify** — establish what is done: gates, the verification
  runner, review, completion.
- **mayberry-status** — recover context: `status`, parked questions, resuming
  from a handoff.
- **mayberry-handoff** — end the session safely.

Route by the user's ask: new/existing project or anything adoption-shaped →
onboard; "next feature", "plan", "regenerate W07" → change; "keep going",
"implement" → implement; "is it done", "run the checks" → verify; "status",
"where were we" → status; "wrap up", end of session → handoff. When in
doubt, this file's position statement decides; never guess a route the user
did not ask for.

## Runtime helpers (the installed invocation path)

State, ledger, and checkpoint operations run through the staged command —
never through hand-built writes and never through this pack's development
checkout:

```
node .mayberry/scripts/mayberry-api.js <command>
```

`state validate` · `state get` · `state write` (full JSON document on stdin)
· `checkpoint close` · `ledger append --change C --result R [--check K]
[--tier T] [--evidence E] [--notes N] [--ts TS]` · `ledger read [--change C]`
· `links check <file>`. Run it with no arguments for the usage line. The
append-only and validation rules are enforced by the same code the tests
cover — a raw hand write bypasses them and is not the happy path.

If `.mayberry/scripts/mayberry-api.js` is missing, or a command fails
naming a missing helper, say in one line: "The mayberry runtime helpers are
gone — run `mayberry init` in this project to restore them" — and stop for
operations that need them. Reading state.yaml as text below still works;
writing does not happen any other way.

## Session open

Read `.mayberry/state.yaml` as text. Build the position statement from the
file — never from what you remember of earlier sessions. Three layers, in
order:

1. One sentence of position: the stage and where in it (from `walk`).
2. The next action as an imperative, with the reason it is next.
3. Blockers lead only when they change that action — a failing gate, an
   open checkpoint, uncommitted work (a gate is the walk's
   before-you-proceed check; a checkpoint is a question waiting on your
   answer). Everything else waits for a `status` request.

First session (`walk` is absent from state): open with "Nothing walked yet.
New project, or existing project? New: tell me what you're building —
plain words, I'll do the writing. Existing: say 'existing project' — I read
before I ask." Then follow the choice; existing hands off to the
mayberry-onboard skill, which runs the Project X-Ray.
If `.mayberry/ledger.jsonl` exists but state.yaml does not, say so and ask
before treating this as a first session — the state file may have been lost,
and the ledger outlives it. A state.yaml that fails to parse or breaks the
schema is named in one line — say what failed and ask before repairing;
never rebuild state silently. A state file that parses can still carry a
wrong position: a `walk.step` written past an open `checkpoint`, or below
the last `walk_history` entry's step, is a hand edit the walk never made —
say the position is wrong and ask; record the repair only after the user
rules.

Keep the voice dry: short plain prose, no celebration, no comfort. Uncertainty
is stated as uncertainty, never glossed. The statement ends in a decision or a
next step.

## Plain Voice

The voice rules are an installed asset: read
`.mayberry/_voice/plain/VOICE.md` at session open and apply it to everything
you say in this family's name. If the file is missing or empty (0 bytes), say
"The plain-voice asset is gone — running on the inline rules above." in one line and keep the
inline contract above; never drop the rules silently. The contract, in
short: dry precision; jargon (gate, tier, worksheet, checkpoint) defined in
one plain line at first use; every explanation ends in a decision or a next
step; uncertainty stated as uncertainty; no humor inside a stop block;
warmth rationed to exactly two moments — a gate cleared (G0–G5 passing on named evidence) and the first verified feature (first feature with passing verification evidence), nothing else (OQ-4 ruling, 2026-10-11).

## The walk (Golden Path)

The walk is 22 steps across four stages — PROJECT 1-6, FEATURE 7-14,
RELEASE 15-18, MAINTENANCE 19-22 (ranges are the contract here; the shipped
step registry is `.mayberry/STEPS.md`, which carries each step's purpose,
inputs, output, exit evidence, guards, and transitions). State carries it in
`walk`: `stage`, `step`, `updated`. When `walk.step` is present, the
position statement's first layer names it exactly: "PROJECT — step 3 of
22: <what the project is doing here>". That wording is contract (OQ-6).

Starting the walk: the first step is 1 — write `walk: {stage: "PROJECT",
step: 1, updated: today}` before anything else at step 1. Step 1 surfaces
W01: read `.mayberry/worksheets/W01_Project_Idea_and_Problem_Canvas.md`,
instantiate it as `docs/W01_Project_Idea_and_Problem_Canvas.md`, and fill
it from what the user said and what the repo shows — every cell you
populate carries `[observed]` (you saw it) or `[assumed]` (you inferred
it). Empty cells mean not yet answered, never approved. Every generated
instance keeps the template's links working from its new location:
template-relative links (decision aids, quick-reference cards, prompts,
sibling worksheets) resolve against the staged template, so a generated
doc rewrites them to the staged locations under `.mayberry/` — check the
result with `node .mayberry/scripts/mayberry-api.js links check
docs/W01_Project_Idea_and_Problem_Canvas.md` and repair what it names. A
walked stage
whose step is absent (a hand edit mid-advance) renders as the stage alone
until the step is written back. The missing-template rule holds at every
generation, not only regeneration: when a bound step's staged template is
absent, say "The W01 template is gone" — the actual W-id in the message —
and stop; never rebuild from memory.

Advancing: when the user confirms a step is done, `walk.step` moves to the
next step — through the installed command (`node .mayberry/scripts/mayberry-api.js
advance`) or an equivalent validated write — `stage` follows the step (the
stage whose range contains it), `updated` is today, and a
`walk_history` entry `{stage, step, updated}` is appended — the log only
grows. The walk ends at 22: when the user confirms
step 22 done, the walk is complete — `walk` stays at step 22, the position
statement says the walk is complete, and no step 23 is ever written.

## Changes (repeated work has identity)

Development does not end at step 22. Every bounded piece of work — feature,
bug fix, chore — is a change record in `changes[]` with an id (`C-001`,
...), kind, title, and status, and the active one is `active` in state.
Starting one seeds a fresh walk segment at step 7 tagged with the change id
— the second feature never overwrites the first feature's history or
records:

```
node .mayberry/scripts/mayberry-api.js change start --kind feature --title "Add export"
node .mayberry/scripts/mayberry-api.js advance            # one step at a time
node .mayberry/scripts/mayberry-api.js change complete    # status done, dated, durable
```

Only the active change advances or completes; `change block --reason ...`
and `change reopen --id ... --reason ...` are the sanctioned pause and
return, both recorded on the change. Completing a change is a completion
event that survives restart — done changes stay in `changes[]` forever, and
a reopen says why. A release candidate (`release record --changes C-001,C-002`)
binds done changes only; `release mark` records the release. Maintenance
and retirement are event-driven records (`maintenance record --kind ...
--notes ...`), never a mandatory stage of every journey. Position: when the
walk's change tag names a done change (or `active` is absent and the last
segment is complete), the position statement says so and routes the next
action — start the next change, prepare a release, or record an event —
never a rewind of finished history.

## Wrong position

If state and the visible repo disagree, say so and ask — never assert either
side as truth.

## Repairs

A position the user corrects is a state repair: append to the `repairs` list
in `.mayberry/state.yaml` an entry `{at, field, from, to}` (`at` is today's
ISO date, `field` the corrected key path, `from`/`to` the old and new values)
and write the file back before any other work. Then continue from the
corrected position.

Fresh state has no `repairs` key yet — the first correction creates it. A
correction of a position that was never walked has no old value: write `from`
as "" and `to` as the corrected value. `to` is never empty.

Edit only the documented keys - `version`, `walk`, `walk_history`, `handoff`,
`open_items`, `assumptions`, `xray`, `overruled_stops`, `checkpoint`,
`flags`, `repairs`, `changes`, `active`, `releases`, `maintenance`,
`adopted`.
An unknown key fails validation later. The file stays hand-editable YAML; no
script needed — though change loops should run through the installed
commands above, which keep identity and history honest for you. Three keys
are append-only — `repairs`, `walk_history`,
`overruled_stops`: they grow at the tail only. Rewriting or pruning them by
hand stands at edit time but blocks every later scripted write.

States from before the four-stage vocabulary may carry `discovery` or
`verification` in walk keys — validation rejects both names on read and
write. The migration is a hand fix: rewrite the rejected names to the
four-stage vocabulary (PROJECT, FEATURE, RELEASE, MAINTENANCE), echo the
list you fixed verbatim, and record one repairs entry for the migration —
`field` is `walk`, `from` names the rejected stage names found, `to` reads
`PROJECT/FEATURE/RELEASE/MAINTENANCE`.
Append-only stands — nothing beyond the rejected names is rewritten.
