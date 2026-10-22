---
name: mayberry-change
description: Define and manage the next bounded change — worksheet placement, generation and regeneration ownership, and the quick route.
---

# mayberry-change

The change loop's worksheet surface: which worksheet surfaces when, how
instances generate and regenerate without losing the user's words, and how
the profile routes work. Routed here by the mayberry skill.

## Placement — which worksheet surfaces when (GOLDEN_PATH.md's bindings)

- Step 1: W01. Step 2: W02. Step 3: W03 (companions W28, W31 when
  relevant). Step 4: W04. Step 5: W07 (companions W29, W30, W33 when
  relevant). Step 6: W08, W09.
- Step 15: W17 (companions W32, W35 when relevant). Step 17: W18 (W19
  when data changes). Step 19: W31 when its "Use when" matches. Step 20:
  W21. Step 21: W22, W27. Step 22: W23.
- Incident path (something went wrong, any stage): W11, W20.
- Every other worksheet is a lens: reachable on demand when its own
  "Use when" matches the current situation — read the staged file's
  header to decide, never invent placement.

Asking for a worksheet out of position states why not — unless its
"Use when" applies here, or the user names it outright. A worksheet's
"Use with" line names its prompts: offer only the P-ids it names (from
`.mayberry/prompts/`) within that step's framing — chapters, decision
aids, cards, and worksheet links in Use-with are reading pointers, never
offered as prompts.

## The quick route

The profile scales worksheets; routing scales the loop. A change routes
Quick when it is bounded, already authorized, and low-risk — a label edit, a
copy tweak, a flagged diagnostic: it runs understand (step 7), a plan only
when a material decision is genuinely unresolved (step 9's checkpoint; the
mayberry-implement skill owns its machinery), verify (step 11, through the
mayberry-verify skill's runner), record (steps 13-14), then `change
complete` — no release candidate, no retirement stop, no companion lenses.
Two limits hold whatever the route: verification floors derive from the
change's own risk, never from the profile — the checks the change demands
run; and auth, destructive-data, migration, or security-boundary changes
never route Quick — they take the deeper path even when the profile says
quick. Consequential ambiguity and new authority always ask, profile or
not; silently assuming consequential behavior is a failure even when it
saves a question.

## Regenerating a worksheet

When the user asks to regenerate a worksheet — or a step's re-derivation
requires it, subject to the same placement rule (out of position states
why not; the user naming the worksheet outright is the exception) —
rebuild the instance from the staged template. This section governs
worksheet instances (W-ids in docs/); the X-Ray brief keeps its own
correction rule (the mayberry-onboard skill). The walk section's link rule
applies here too: rewrite template-relative links to the staged
`.mayberry/` locations and run `links check` on the rebuilt file.

Provenance before ownership: before rebuilding, copy the current instance
to `.mayberry/snapshots/<name>.md` — the merge compares three texts
(snapshot, current bytes, staged template), and the snapshot is what
guarantees the user's words survive even when the marks cannot be
trusted. Generated instances carry a stable field id per cell as an HTML
comment (`<!-- field: W03.criterion-1 -->`); rows keep their ids across
regenerations so a reorder is visible as a reorder, not a rewrite. The
Evidence Vocabulary marks are the ownership record — and evidence status is
never ownership: a mark says how a claim is grounded, not who wrote the
words:

- A response cell without a mark is the user's — preserved word-for-word,
  never rewritten, never reordered. If the repo now contradicts it, say so
  in one line after the closer; the cell itself stays.
- An empty cell is unclaimed — regeneration may fill it, marking it
  `[assumed]`, and names it as a new fill.
- A cell marked `[assumed]` is yours to re-infer from the current project.
  Read its current text first: if it now reads as the user's answer
  (their voice, their content — not template-run prose), keep it, drop
  the mark, and count it as kept.
- A cell marked `[observed]` is re-checked against the repo — but read
  its current text first, same rule: answered over, it is theirs. A
  user-edited marked cell keeps its mark and its evidence status — the
  mark is never removed merely to signal authorship.

When you cannot tell whether a marked cell was answered over, ask first —
never guess with the user's words. Scaffolding (title, purpose,
close-when) follows the template. Rows the template gained are appended
unanswered; a row the template dropped keeps its answer as an appended
orphan — a cell holding user words is never deleted. Recover every kept
cell into the new content first, then write the instance once; if the old
instance or its snapshot cannot be read, stop and say so — never write a
bare template over it. If the staged template itself is missing, say "The
W17 template is gone" — the actual W-id in the message — and stop; do not
rebuild from memory. A corrected walk key from a re-derivation is still a
repairs entry; only the worksheet file changes without a state write.

Close with one line counting the cells that held words: kept = user cells
left as-is, refreshed = re-inferred `[assumed]` plus updated `[observed]`
— "Kept your 6 answers, refreshed 3 cells (2 re-inferred, 1 updated)."
Newly filled empty cells and appended rows are named in the closer too — say
what you added and let the user decide what stays.
