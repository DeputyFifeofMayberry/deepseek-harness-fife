---
name: mayberry-status
description: Recover current context — the bounded default status, the full detail surface, parked questions, and resuming from a handoff.
---

# mayberry-status

Recover context from the files, never from memory. The default answer is
narrow; the full surface exists on request. Routed here by the mayberry
skill.

## Status

When the user asks for `status`, answer with the bounded default, four
things in this order: the position line (stage, step, and the active
change); live blockers (an open checkpoint, a live gate or
DO-NOT-PROCEED condition, uncommitted work); evidence gaps (declared
criteria of the active change without fresh passing proof); and the one
next action as an imperative. Then say "say `status full` for every
section." Never render the whole surface unasked — with a hundred ledger
events the default is still four lines, and history never hides an
actionable gap because the gap leads.

`status full` renders every section from the files —
state.yaml, ledger.jsonl, and config.yaml — with nothing invented. In order:

1. **Stage history** — each `walk_history` entry (stage, step, when), oldest
   first; the current `walk` renders after them as where the project stands
   now; `walk` alone if no history yet. Stage progressions are recorded into
   `walk_history` when the walk moves (Golden Path behavior).
2. **Open checkpoint** — when the `checkpoint` key is present, its question
   verbatim. This section renders only while a checkpoint is open: no key,
   no section — never a blank section.
3. **Open items** — each `open_items` entry: the question and where it will
   resurface.
4. **Assumptions** — each `assumptions` entry: what was assumed, when.
    Assumptions are recorded during discovery (Discovery Engine behavior).
5. **Ledger summary** — read `.mayberry/ledger.jsonl`: one line per entry
   (when · change · result). No ledger file yet → say "No ledger yet." in one
   line. This is a plain read, not the CLI renderer.
6. **Flags** — `degraded_discovery` and `flaky_quarantines` when set; a
    flag's reason renders from the entry that set it once those entries carry
    reasons (arriving with the verification epics). Never at session open
    unless they change the next action.
7. **Overruled stops** — each `overruled_stops` entry: condition and the
   decision recorded.
8. **Profile** — the `risk_profile` from config.yaml, or "no profile
    set".

An empty section says so in one line — "No open items." — never silence, never
invented content. Close with a decision or a next step.

Generation announces itself the same way: a new worksheet instance opens
with one line naming the artifact and its purpose before the table — never
a bare form dropped into the chat. The chat shows outcome, uncertainty,
and the one decision; the durable file carries the detail.

## Ask me later

When the user defers a framed question ("ask me later"), park it: append to
`open_items` in `.mayberry/state.yaml` an entry `{question, parked_at,
resurfaces_at}` — `question` the question as asked, `parked_at` today's ISO
date, `resurfaces_at` the next task boundary or gate that needs the answer.
Unavailable for questions the current gate cannot pass without. Never for an open
checkpoint's question — the halt needs the answer; one line says so and the
checkpoint stays open. The parked
question shows in `status` under open items. When the question is answered,
remove its entry from `open_items` — status shows only what is still open.

## Session open with a handoff

If `state.yaml` carries a `handoff.path`, read that file before building the
position statement and fold it in — the resumed session needs no
re-explanation of what the handoff already says.

Each of the five sections must be present with content. A missing or empty
section is named exactly: "The handoff has no checks-not-run section — I won't
guess. Want me to reconstruct it, or fill it in yourself?" Never reconstruct
silently. If the file the pointer names does not exist, say "The handoff file
is gone" and ask what to do. With `handoff.path` absent or null, open
ordinarily from state alone. Evidence recorded in a previous session is
reused, not re-asked; proof whose candidate fingerprint no longer matches is
named stale by `resume`, not silently reused.
