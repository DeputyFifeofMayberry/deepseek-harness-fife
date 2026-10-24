---
name: mayberry-onboard
description: Adopt a project into Mayberry — first session entry, the existing-repo X-Ray, adopted canonical records, and the risk profile.
---

# mayberry-onboard

Adoption: read what the project already is, keep its own records as the
truth, and set the depth. Routed here by the mayberry skill.

## Project X-Ray (existing-repo entry)

When the user picks "existing project" — a project with code but no walked
position — announce the X-Ray in one line ("I read before I ask: code,
deps, risks — then a short brief you correct"), read quietly, and write
`docs/mayberry-xray.md`: architecture and data flow, dependencies, risks —
W04's shape. Every claim carries `[observed]` (you saw it in the repo) or
`[assumed]` (you inferred it). No untagged claims — a blank is not approval.

If a section cannot be inferred confidently, ask targeted questions about
exactly what is missing — never guess and never tag a guess as observed.

When the user corrects a claim, regenerate that section with the correction
recorded; other sections stay untouched. A re-run reads the existing brief
first: corrected sections regenerate with the correction retained, never
over it. When the brief is accepted, seed
`.mayberry/state.yaml`: `walk: {stage: "existing", updated: today}` and
`xray: {path: "docs/mayberry-xray.md", updated: today}` — the position
statement then places the user mid-path with the brief as anchor, and every
later session opens by reading the brief the pointer names. If the brief the
pointer names does not exist, say "The X-Ray brief is gone" and ask whether
to re-run the X-Ray. Read the first bounded change's shape from the brief
and the ask: `change start` names it explicitly — never leave an adopted
project "mid-path" without a named next change.

## Adopted records

Init adopted the project's own canonical documents where they existed
(`adopted.records` in state: `docs/PROJECT.md`, `docs/QUALITY.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`). They are the truth — read them
before asking what they already answer, never lay a parallel record beside
them, and update them in place when work changes what they say. A starter
template that was never filled in is not policy: bracketed placeholders mean
unanswered, and an unanswered template is never cited as an approved rule —
say so and fill it with the user.

## Risk profile

At the end of step 1 — after W01 is filled — ask the Risk Profile
question once, framed with consequences: Quick means understand, change,
verify — lightest worksheets, fewest required sections. Standard means
the full feature loop — every worksheet as shipped. Deep means research,
alternatives, experiments, approvals, staged validation and recovery are
added before high-consequence action — heaviest. Record the answer by
reading `.mayberry/config.yaml` first and writing the whole object back
with `risk_profile` added (quick | standard | deep) — every existing key
(including `harness`) preserved, and never a key outside the documented
set: an unknown key already in config fails validation, so surface it
and ask instead of writing around it. A missing config.yaml is "no
profile set" — session open never fails on config.

Ask only when config carries no valid `risk_profile`: a valid value
already there is read aloud and kept; an invalid one is named in one
line, then asked and overwritten. If the walk is past step 1 and config
still carries none, ask before generating the next worksheet. A deferred
("ask me later") profile question parks with its resurface trigger as
the next worksheet generation — it must resurface before the first
worksheet is generated without a profile. Session open reads
`.mayberry/config.yaml` too and carries `risk_profile` into every
worksheet generated this session.

The profile scales how worksheets generate, never the stage order or the
22 steps: Quick generates a worksheet's response table and skips
companion lenses — only the parenthesized worksheets at a bound step —
unless asked; Standard generates the template as shipped; Deep generates
as shipped and also asks the questions the worksheet's Use-with prompts
and decision-aid links imply for research, alternatives, and recovery —
reading pointers may seed those questions but are still never offered as
prompts; if the worksheet names none, say so instead of inventing
questions. A Use-with pointer whose file install did not stage seeds
nothing — say so once instead of inventing its content. Incident
worksheets (W11, W20) and any worksheet whose "Use when" matches a live
failure surface in every profile. Whatever the profile, every generated
cell still carries its Evidence Vocabulary mark, and a Quick walk that
reaches a DO-NOT-PROCEED condition stops like any other — the six stop
conditions are named in the gates section of the mayberry-verify skill.
Regeneration follows the current profile for depth; the ownership rules in
the mayberry-change skill are profile-independent.
