# Plan Change Log — Effort-Policy Hardening and Token-Budget Tightening

The draft was authored directly from the 2026-10-22 review findings and audits, then hardened in the same pass against `.agents/skills/plan-hardening/SKILL.md`. This log records what hardening changed.

| Change ID | Original section | Change in final plan | Reason / finding ID | Requirement impact | Approval needed? |
| --- | --- | --- | --- | --- | --- |
| C-1 | Idea 2, fetch cap | Downgraded from a code change to pure config (`fetchMaxOutputChars` already exists on `dsh-tool-web`) | Source check found the validated config field at `packages/web/tool-web/src/index.ts:56-67` | Smaller W7b; no upstream code | No |
| C-2 | Idea 2, step-boundary pruner | Restricted the pruner to nodes appended since the previous request and added the constraint to section 3 and W7c | R-01 pre-mortem: pruning old cached nodes breaks provider prefixes and can raise cost | Same token goal, safer mechanism; one new default-off config field | No |
| C-3 | Idea 2, spill threshold | Added the A1 probe (W7a) before the config row, with a preset-restatement fallback | I-03: spill coverage inside preset realms is unverified; the effort-policy seam needed per-agent wiring for a similar case | W7a may grow into a preset edit | Only if the fallback fires |
| C-4 | F4, docs | Downgraded from "add documentation" to "verify both documents state it", conditional two-sentence edit | The upgrade guide already exists at `docs/upgrade-guide/v0.2.1-rc.2/effort-policy/` (M5/M7 ledgers) | W4 is mostly read-only | No |
| C-5 | F5, no-op listener | Disposition chosen: delete rather than document | A pure passthrough changes nothing; keeping it would preserve the confusion it causes | One-line removal plus test sweep | No |
| C-6 | F2, preset coverage | Split into verify-then-fix; live-profile `cordis` restatement made conditional on actual preset selection | `web-app/cordis.patch.yml:605` shows the bundle default is `standard`; restating a second preset adds permanent merge maintenance | W2 may end as a comment-only change | No |
| C-7 | Idea 1, rollout | Added staged adoption: live profile first, dev home mirrored after real use; stepwise raise-back path instead of outright revert | One behavior change at a time keeps the quality tradeoff attributable (repo optimize-protocol ethos) | None | No |

## Preserved decisions and scope

- No upstream default changes: `compaction-basic`, `spill-policy`, and `tool-web` shipped defaults stay untouched; every deployment value lives in the user's two profile patches.
- The pre-send cost warning stays rejected (2026-10-22 decision); PTC pilot and skill budgets stay out of scope.
- The effort-policy required-on-read event stays as designed; F4 is documentation verification only.

## Changes not made

- Renaming or relocating the no-op listener into a documented seam: rejected; deletion is smaller and the seam has no consumer.
- A dollar-based warning threshold or idle heuristic from the earlier cost-alert exploration: rejected with the feature on 2026-10-22; not reintroduced.
- Tightening grep tool constants (`GREP_MAX_MATCHES`, line caps): deferred; they are upstream protocol-ish constants, the spill/fetch/pruner levers cover the same volume with less upstream surface.
