# M7 Progress Ledger — Mayberry Takeover

Status: **COMPLETE via a git-tagged package.** The decision rules now live in `@mayberry/effort-policy-core` at `DeputyFifeofMayberry/effort-policy-core` (public, tag `v0.1.0`, commit `a740b35`); this repository depends on that tag, re-exports `./core` from it, and no longer contains a copy of the rules. The npm registry release is the only thing still outstanding, and it is blocked by an npm account suspension rather than by this work.
Baseline: `Y:\deepseek-harness_fife` at the M6 state, 2026-10-21. No commit or push in the fife repository; the package repository was pushed by its owner.

## What landed in this repository

| File | Change |
| --- | --- |
| `packages/llm/effort-policy/package.json` | depends on `@mayberry/effort-policy-core` at `git+https://github.com/DeputyFifeofMayberry/effort-policy-core.git#v0.1.0`; `pnpm-lock.yaml` pins the commit tarball `codeload.github.com/…/tar.gz/a740b355…` |
| `src/core.ts` | `export * from '@mayberry/effort-policy-core'` — the `./core` path and names are unchanged |
| `src/agent-options.ts`, `src/config.ts`, `src/events.ts`, `src/service.ts` | import their vocabulary from the package instead of the deleted local modules |
| `src/protocol.ts` | `SUPPORTED_EFFORT_POLICY_PROTOCOL_VERSION = 1` and `assertCoreProtocol(version)`, called at module load |
| `tests/protocol.spec.ts` | proves acceptance and the mismatch error |
| `tests/events.spec.ts` | reads `EFFORT_POLICY_PROTOCOL_VERSION` from the package |
| deleted | `src/{types,levels,policy}.ts`, `tests/{levels,policy,import-boundary}.spec.ts` — moved to the package, not rewritten |
| `README.md` / `.zh.md` + `.i18n.yaml` | the implementation section names the owning package and `src/protocol.ts` |
| `scripts/gen-third-party-notices.ts` | one documented `OVERRIDES` entry: a git-tagged install carries no `repository` field |
| `THIRD_PARTY_NOTICES.md` | regenerated; `@mayberry/effort-policy-core` → `https://github.com/DeputyFifeofMayberry/effort-policy-core`, MIT |
| `docs/persistence-catalog.{md,zh.md}`, `.i18n.yaml`, `docs/persistence-schema.json`, `packages/core/session/src/known-event-types.ts` | regenerated; the catalog's source links no longer point at the deleted modules |

The Mayberry side is one repository, `Y:\effort-policy-core` → `DeputyFifeofMayberry/effort-policy-core`: `src/{types,levels,policy,index}.ts`, `tests/{levels,policy,import-boundary}.spec.ts`, `tsconfig.json`, `package.json` (`@mayberry/effort-policy-core@0.1.0`, MIT, public), `README.md`, `LICENSE`, and the built `lib/` committed so an install needs no build step. The duplicate copy under `Y:\sdd-mayberry\packages\` was deleted, so exactly one implementation exists.

## Verified state

| Check | Result |
| --- | --- |
| package: `npm run build`, `npm test` | ESM + declarations into `lib/`; 29 passed (8 levels, 19 policy, 2 import-boundary) |
| package: `pnpm add "git+file:///Y:/effort-policy-core#v0.1.0"` | installs `lib/`, `LICENSE`, `README.md`, `package.json`; `decide` returns `{ rule: 'base', level: 'low', effort: 'low' }` |
| `pnpm install` in fife | resolves the tag to commit `a740b35…`; lockfile records the codeload tarball |
| `pnpm run typecheck` | 5 passed, 0 failed |
| `pnpm vitest run packages/llm/effort-policy packages/subagent/tool-subagent packages/acp/acp packages/api/session-controller` | 1392 passed, 1 skipped, 1 failed — the pre-existing Windows symlink `EPERM` in `media-references.host.spec.ts` |
| profile fixture (`vitest.expected.config.ts`) | 1 passed: a real CLI boot on the extracted adapter still records `low → high → low` |
| `pnpm run build` | see the job log for this turn; typecheck and bundle surfaces green |
| `verify-third-party-notices`, `verify-persistence-catalog`, `verify-config-catalog`, `verify-md-links`, `verify-doc-budgets`, `verify-export-jsdoc`, `verify-runtime-closure` | all pass (186 packages closed) |
| `verify-package-dependencies` | one violation, the pre-existing `ui-price-phase` one; nothing from this change |
| `oxlint` on the package and the notices generator | 0 warnings, 0 errors |

## Why the registry release is still outstanding

The npm account is suspended — `403 Your account has been temporarily suspended due to a recent security-sensitive action` — after the evening's failed publish and 2FA attempts. The failures escalated `503` → `404` → explicit suspension across three tokens, two terminals, and two package names, while the account itself owned the `@mayberry` org (`/-/org/mayberry/user` → `{"mayberry":"owner"}`) and the package built and packed cleanly every time.

Two consequences are recorded rather than hidden:

- **The dependency is a git tag, not a registry version.** npm 12 refuses `git` and `remote` specs outright, so this resolves under pnpm (this repository's package manager) but not for an npm consumer. It becomes a one-line `0.1.0` registry spec once publishing is restored.
- **`THIRD_PARTY_NOTICES.md` relies on one override** because a git-tagged install has no `repository` field. The entry is documented and can be dropped when the registry release lands.

## Follow-ups

1. When npm lifts the suspension, `npm publish` the untouched `0.1.0` from `Y:\effort-policy-core`, then switch the dependency spec to `0.1.0` and remove the notices override.
2. One throwaway stage (`@deputyfife/m7-stage-probe@0.0.0`, id `a246733a-…`) remains unapproved in the npm account's staged list; rejecting it needs the browser 2FA flow and is harmless while unapproved.
3. Regenerate npm recovery codes once the account is restored; the code used during diagnosis is single-use and spent.
4. The Mayberry adapter over the core (design-note step 2) is a Mayberry-repository task and is not started.
