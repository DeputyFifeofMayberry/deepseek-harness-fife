# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/glossary.md`** — the project glossary. It defines the harness vocabulary (capability seams, plugins, sessions, turns, events, tools). Use its terms; do not drift to synonyms it avoids. The repo is single-context: one glossary serves all packages.
- **`docs/architecture.md`** — the authoritative system map, required reading before changing `packages/`.
- **`docs/defensive-patterns/README.md`** — review principles that apply per artifact when the work touches a package surface, remote service, client component or state, conversation or Session behavior, or lifecycle, concurrency, subprocess, and teardown code.
- **`.agents/notes/`** — durable decision-rationale records, the repo's equivalent of ADRs. Check the `implemented/` subtree for decisions in the area being touched. Archived notes are frozen and are not current authority.

The engineering-skills `GLOSSARY.md` / `docs/adr/` layout from other repos does not apply here; the files above are this repo's canonical homes. Do not suggest creating sibling glossary files upfront.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, or a test name), use the term as defined in `docs/glossary.md`. If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for a glossary update).

## Flag decision-record conflicts

If your output contradicts an existing `.agents/notes/implemented/` record, surface it explicitly rather than silently overriding:

> _Contradicts `<note-path>` (<decision>), but worth reopening because…_
