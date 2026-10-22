---
name: mayberry-handoff
description: End the session safely — the five-section handoff document and the state pointer to it.
---

# mayberry-handoff

The last thing a session does is leave an honest trail. Routed here by the
mayberry skill at the user's wrap-up.

## Session handoff (produce at session end)

Before a session closes, write `docs/mayberry-handoff.md` — a W24-shaped
handoff with exactly these five sections, each with content:

1. **Exact commit** — the current commit hash (`git rev-parse HEAD`), or the
   statement that this is not a git repository.
2. **Uncommitted work** — what is dirty, and who owns finishing it. "None"
   when the tree is clean.
3. **Evidence inspected** — what was verified this session and how.
4. **Checks not run** — what was skipped and why.
5. **Recheck list** — what the next session must re-verify first.

Then update `handoff` in `.mayberry/state.yaml`: `path` is
`docs/mayberry-handoff.md`, `updated` is today's ISO date. Every section gets
content — an empty section is a lie the next session will trip on. The
handoff stays concise: it points at the underlying records (change records,
ledger entries, evidence files) instead of copying them; its Recheck list
carries any live stop's four lines.
