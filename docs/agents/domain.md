# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/glossary.md`**: this repo's canonical glossary. There is deliberately no root `GLOSSARY.md`; this file is the single glossary home.
- **`.agents/notes/`**: this repo's decision records ("Agent Notes") in `proposed/`, `implemented/`, and `rejected/` lifecycle folders. Read the notes that touch the area you're about to work in. Treat `archived/` as frozen history, not current authority.

If any of these don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) resolves terms and decisions into these locations when they actually come up.

## File structure

Single-context repo reusing its existing documentation:

```
/
├── docs/
│   └── glossary.md
└── .agents/notes/
    ├── proposed/
    ├── implemented/
    ├── rejected/
    └── archived/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/glossary.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision-record conflicts

If your output contradicts an existing Agent Note, surface it explicitly rather than silently overriding:

> _Contradicts 2026-08-23-locale-owned-client-ui-copy (implemented), but worth reopening because…_
