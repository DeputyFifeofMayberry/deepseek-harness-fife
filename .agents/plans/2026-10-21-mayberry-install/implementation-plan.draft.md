# Draft Implementation Plan — Install mayberry

- Status: draft (reconstructed; no prior draft was supplied)
- Intended outcome: make the Mayberry pack available to DeepSeek Harness in this checkout.

## Proposed work

1. Run `node Y:\sdd-mayberry\cli.js init` from the repository root so every detected harness receives the pack.
2. Keep the six files Mayberry writes into `docs/` as the project's operating records.
3. Confirm the seven `mayberry*` skills appear under `.agents/skills/`.
4. Run `node .mayberry/scripts/mayberry-api.js state validate` and `ledger read`.
5. Commit the new skills, `.mayberry/`, and generated docs.

## Expected result

A normal Mayberry install, discoverable in a new session, with its starter documents available in `docs/`.

## Risks noted at draft time

- Mayberry is unpublished, so the install depends on the local checkout.
- The repository is already dirty with unrelated work.
