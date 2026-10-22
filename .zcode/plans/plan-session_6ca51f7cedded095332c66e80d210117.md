# Make the fork's desktop app self-updating from GitHub Releases

## What's happening today

The message comes from `apps/desktop/src/update-coordinator.ts:187`. The updater only enables when the process is packaged and `<resources>/app-update.yml` exists (`update-coordinator.ts:55`). Your installed app at `%LOCALAPPDATA%\Programs\DeepSeek Harness` is an official DeepSeek build: its `app-update.yml` points at `https://download.deepseek.com/dsh-desk/feeds/win-x64/` and pins DeepSeek's signing identity, so it would only ever pull upstream builds and would overwrite your fork changes. Unsigned builds get `publish: null` (`apps/desktop/scripts/electron-builder-config.mjs:98` and `:264`), so a fork build packaged today has no update source at all and shows your exact message on a manual check.

The plan: give the fork its own update feed on your existing public GitHub repo, reuse the app's entire built-in update flow (scheduled checks, "update available" state, download and install-and-restart confirmations), and change almost nothing in product code. All changes are packaging-script level.

## Design

electron-updater's generic provider fetches `<feed-url>/nightly.yml` and then the installer file the yml names. Setting the feed URL to `https://github.com/DeputyFifeofMayberry/deepseek-harness-fife/releases/latest/download` works because that GitHub URL always redirects to the newest published release's assets. Each release ships three assets that electron-builder already emits: `nightly.yml`, the unsigned NSIS installer, and its `.blockmap`. Verification stays checksum-based (sha512 in the yml); there is no publisher pinning because the build is unsigned. No GitHub API is involved, so no tokens and no rate limits.

Versioning uses the mechanism the repo already has: a build version of `<manifest version>.<YYYYMMDD>.<index>`, e.g. `0.2.1-rc.2.20261020.1`, passed via `--build-version` (validated by `desktop-build-version.mjs`, allowed because the base is a prerelease). That is always greater than the base upstream version and strictly increases per fork build, so `gt()` in `doCheck` does the right thing even when the fork and upstream share a version. Releases are published as regular (non-prerelease, non-draft) GitHub releases so `/releases/latest/download` resolves to them; the nightly channel permits the prerelease-form version string. If the repo were private this would break anonymously, and you confirmed it's public.

## Changes

1. `apps/desktop/scripts/desktop-auto-update-environment.mjs`
   - `resolveDesktopAutoUpdateEnvironment` accepts a third value `fife` for `DSH_DESKTOP_AUTO_UPDATE_ENV`.
   - `resolveDesktopAutoUpdateConfig` resolves the fife feed URL from a new env var `FIFE_DESKTOP_UPDATE_FEED_URL`, validated as absolute https with no credentials, query, or fragment; a path is allowed (the existing `httpsOrigin` helper forbids paths, so fife gets its own validator) and normalized to a trailing slash. Returns `publicUrl` as that URL with empty `keyPrefix`/`binaryKeyPrefix` so the returned shape stays symmetric.
   - `resolveDesktopUploadConfig` throws for fife: the COS upload path doesn't apply, releases publish via `gh`. Fails loud rather than half-working.

2. `apps/desktop/scripts/electron-builder-config.mjs`
   - Line 98: allow update config on unsigned builds when the environment is fife (`unsigned && env !== 'fife'` keeps upstream unsigned behavior identical).
   - Line 68: skip `resolveDesktopPolicyEnvironment` for fife. The fork has no mandatory-update policy service; the packaged manifest simply omits `dshMandatoryUpdatePolicy` and the runtime feature stays off.
   - Nothing else changes: publish stays `[{ provider: 'generic', url, channel: 'nightly' }]`, `dshDesktopUpdateChannel` seals as nightly, no `publisherName` on unsigned builds, and Windows electron-builder writes the resulting `app-update.yml` into the installer resources.

3. New `apps/desktop/scripts/fife-release.mjs`, the one-command release driver:
   - Computes the next build version: reads existing fork releases via `gh` for tags starting `v<productVersion>.<today>`, takes max index plus one (1 when none), e.g. `0.2.1-rc.2.20261020.3`.
   - Runs the existing unsigned Windows packaging entry (the `package:win:x64:unsigned` script in `apps/desktop`, mirrored at root; exact invocation confirmed at implementation, since `package-target.ts` has a `--` forwarding quirk documented at its line ~225) with the fife env vars and `--build-version <version>`.
   - Collects `deepseek-harness-<version>-win-x64-unsigned.exe`, its `.blockmap`, and `nightly.yml` from `.desktop-build/targets/win-x64/artifacts/`, and creates the GitHub release: `gh release create v<version> --target master` (regular release, never draft or prerelease) with those three assets and your release notes.

4. Tests: extend `apps/desktop/tests/desktop-auto-update-environment.spec.ts` for fife selection, URL validation (rejects non-https, credentials, query), and the upload-config rejection. Run the focused desktop suite and fix any spec that pins unsigned-means-no-publish.

5. `FORK.md`: a short "Desktop updates" section documenting the feed URL, the release command, the version scheme, and that fork scope now includes the three files above; note the upstream-sync rule for them (upstream wins, re-apply the small fife delta).

## One-time migration

Run the first fork installer by hand. It upgrades the official install in place (same app id, per-user location) and replaces its update config, so the DeepSeek feed can never pull upstream builds over your fork again. Windows SmartScreen warns once for an unsigned installer; "More info, Run anyway" clears it permanently for this flow. From then on the app checks every 10 minutes (plus on focus and resume) and walks you through download and install-and-restart with its normal dialogs.

## Verification

- Focused unit tests for the changed script, plus repo typecheck.
- Package one build, then confirm `app-update.yml` inside the unpacked resources contains the GitHub feed URL and no publisher name, and that `nightly.yml`, the exe, and the blockmap landed in the artifacts directory.
- Publish release #1, install it, then rebuild the same commit as index 2 and publish release #2: the running app should report an available update, and install-and-restart should land on the new build version. That exercises the whole loop without waiting for real changes.

## Risks and notes

- Dev-mode runs (`pnpm run dev:desktop`) keep showing this exact message on a manual check by design; the packaged app is the auto-updating surface.
- The two touched scripts are upstream files, so upstream syncs can conflict; the FORK.md note keeps re-applying the small delta mechanical.
- Upstream's COS upload, signing, and macOS paths stay untouched; the unsigned `-unsigned` artifact suffix stays so a fork build can't pass for a release artifact.
- GitHub's `/releases/latest/download` only resolves regular releases, which is why the script must never mark a feed release as prerelease; that's enforced in the script, and the unit test covers the config side.
- Unverified during planning: the exact pnpm script invocation string for the unsigned target (the `--` forwarding quirk), and whether any test beyond `installer-packaging.spec.ts` asserts unsigned builds carry no publish config. Both get settled in the first implementation step.