# deepseek-harness-fife

This repository is a personal fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), which is MIT licensed. It tracks upstream `master` and adds a `fife` command alias and a self-updating Windows desktop build for local use.

## Commands

`dsh` is the standard command and keeps upstream behavior. `dsh --version` prints the upstream base version exactly.

`fife` runs the same profile launcher with the same profiles, `$DSH_HOME`, settings, sessions, credentials, and app arguments. `fife --version` prints the base version plus fork build metadata, such as `0.2.1-rc.2+fife.1`.

The launcher help for `fife` uses the `fife` name. Nested app help, such as `fife web --help`, is owned by the booted app and may still use upstream wording.

## Install and rebuild

Run these commands from the repository root on Windows:

```powershell
pnpm install
pnpm run build
Set-Location apps/cli
pnpm add -g .
```

`pnpm add -g .` registers this checkout as a global `link:` dependency and creates both the `dsh` and `fife` shims in `%LOCALAPPDATA%\pnpm\bin`. That directory must be on the user `Path`. The repository pins `pnpm@11.28.5`; confirm `pnpm --version` inside the checkout before building. pnpm 11 does not accept `pnpm link --global`.

After changing CLI source, rerun `pnpm run build`. Rerun `pnpm add -g .` from `apps/cli` only when package metadata or the binary list changes. The global link points at this checkout, so source-only changes need no reinstall.

## Update from upstream

```powershell
git fetch upstream
git switch master
git merge --no-ff upstream/master
pnpm install
pnpm run build
pnpm run typecheck
git push origin master
```

Resolve conflicts outside `apps/cli/**`, `FORK.md`, and the desktop update files listed below in favor of upstream. If upstream changes `apps/cli/src/bin.ts` or `apps/cli/src/args.ts`, move any new launcher behavior into `apps/cli/src/launcher.ts` and keep both entries calling it. If upstream changes the desktop update files, re-apply the small fife delta described in the next section. Do not rebase published history and do not force-push.

`upstream` has its push URL set to `no_push`, and `origin` is the push default.

## Desktop updates

The fork's Windows desktop build self-updates from this repository's GitHub Releases. electron-updater's generic provider fetches `https://github.com/DeputyFifeofMayberry/deepseek-harness-fife/releases/latest/download/nightly.yml`, which always resolves to the newest published release, and then downloads the installer the manifest names. Each release therefore carries exactly three assets: the unsigned NSIS installer, its `.blockmap`, and `nightly.yml`. Releases are published as regular releases; a prerelease or draft release would be invisible to the feed, and a missing `.blockmap` only disables differential downloads.

Only the **installed** application updates. It lives at `%LOCALAPPDATA%\Programs\DeepSeek Harness`, keeps its data under `%USERPROFILE%\.dsh`, and checks every ten minutes, on focus, on resume, and through **Check for Updates…**. The development launcher (`pnpm dev:desktop` / `pnpm start:desktop`) runs unpackaged Electron against this checkout, so it has no update source; its check reports that this is a development build instead of failing. Use the installed app as the daily driver and the development launcher only while working on the app itself.

Publish one release from the repository root:

```powershell
node apps\desktop\scripts\fife-release.mjs --notes "what changed"
```

The command derives the next build version (`<product version>.<date>.<index>`, such as `0.2.1-rc.2.20261020.2`) from the release tags already published for today, packages the unsigned Windows target, verifies the packaged `resources\app-update.yml` matches the feed and channel and that the emitted `nightly.yml` names the built version and installer, and only then creates the GitHub release. A build whose packaged application cannot reach the feed is rejected before it is published. Run the first installer by hand once; it upgrades the installed app in place, and every later release arrives through the app's own update flow. Windows SmartScreen warns once for an unsigned installer.

The build needs `apps/desktop/.env.windows` to declare `DSH_DESKTOP_APP_ID=com.deepseek.harness` and `DSH_DESKTOP_AUTO_UPDATE_ENV=fife`; the script creates that file when it is missing and refuses to rewrite one that exists. The feed URL defaults to this repository's `releases/latest/download` address and can be overridden with `FIFE_DESKTOP_UPDATE_FEED_URL` or `--feed-url`. The fife deployment skips signing and the mandatory-update policy service, so unsigned builds carry a working update source with checksum-only verification.

Diagnose an update problem in this order:

1. The app's **View technical details** names the resolved source, channel, installed version, configuration path, and the updater error.
2. The shell logs one `desktop update: source=…` line at startup.
3. `node apps\desktop\scripts\fife-doctor.mjs` prints the installed application's packaged feed, the published release, the version the feed currently offers, and any downloaded-but-uninstalled update. Pass `--app-path` for a non-default installation. It exits non-zero and names the failing step when the feed is missing or unreachable.
4. Downloaded installers are staged under `%LOCALAPPDATA%\@deepseek-aidsh-desktop-updater`.

Fork scope: `apps/desktop/scripts/desktop-auto-update-environment.mjs` (the `fife` deployment), `apps/desktop/scripts/desktop-package-environment.mjs` and `apps/desktop/scripts/desktop-policy-environment.mjs` (fife skips the policy service), `apps/desktop/scripts/electron-builder-config.mjs` (unsigned builds keep their update source under fife), `apps/desktop/scripts/fife-release.mjs` (the release driver), `apps/desktop/scripts/windows-app-update-config.mjs` (the published-source gate), and `apps/desktop/scripts/fife-doctor*.mjs` (diagnosis). Upstream owns all of them except the fife-specific files; after an upstream sync, re-apply the fife delta marked by `fife` in each file.

## Official app backup

The fork's installer replaces the official DeepSeek Harness desktop app because both use the same application id, so a second installed copy is not possible. Instead, the official build is kept as a portable, frozen copy at `%USERPROFILE%\DSH-Backup\official-0.2.1-rc.2`; start it from the Start-menu shortcut **DeepSeek Harness (official backup)** or `Launch official DeepSeek Harness.cmd`.

- It was downloaded from the official feed (`https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml`, version `0.2.1-rc.2`, win-x64) and its SHA-512 was verified against the feed before extraction. `README.txt` in that folder records the exact source and hash.
- It runs entirely from that folder: `home\` is its `$DSH_HOME`, `user-data\` is passed as `--user-data-dir`, so it shares no sessions, credentials, or Electron data with the fork app and both can run at once.
- Its data was seeded from `%USERPROFILE%\.dsh` at creation time (sessions, storages, attachments, credentials), so the backup opens with the same work. Later changes in either copy do not synchronize.
- Its updater is disabled by renaming `app\resources\app-update.yml` to `app-update.yml.disabled`. Leaving it enabled would let the official copy install the official app over the fork installation; the frozen copy therefore reports that it has no update source if asked to check.
- To return to the officially installed app, run the installer kept beside the copy (`deepseek-harness-0.2.1-rc.2-win-x64.exe`); it installs over `%LOCALAPPDATA%\Programs\DeepSeek Harness`. Publish and install a fork release to switch back.
- Removing the backup means deleting that folder and the Start-menu shortcut; nothing outside it references it.

Sessions from the development home (`apps\desktop\.desktop-build\development\home`) can be copied into `%USERPROFILE%\.dsh` additively: sessions, storages, and attachments only, never `profiles\` or `dsh-runtimes\`, and never over existing credentials.

## Fork scope

This pass adds the command alias, the install workflow, and the desktop update feed. It does not change the persona, branding, default model, approval policy, autonomy, UI, system prompts, bundled skills, settings, or product documentation.

Keep future personal changes isolated so upstream merges stay small:

- Launcher commands: `apps/cli/src/fife.ts`, `apps/cli/src/launcher.ts`, and `apps/cli/src/args.ts`.
- Desktop update feed: the files listed in the Desktop updates section.
- Profiles and settings: `$DSH_HOME`, outside the repository.
- Personal skills: `~/.agents/skills`, outside the repository.

Do not commit personal configuration, credentials, session data, or skills to this public repository.

## Effort routing

Every session starts at `low` reasoning effort and rises one level while `pnpm run typecheck` is failing; the same check passing at the same command in the same directory returns it to `low`. The `effort-policy` row is enabled with `baseLevel: low` and two verifier rules, one per platform shell tool, and `agent-default-model` in these profiles names no `reasoningEffort` because an Agent-level effort is an exact start the policy would never raise.

The decision rules themselves live in `@mayberry/effort-policy-core`, a public repository (`DeputyFifeofMayberry/effort-policy-core`, tag `v0.1.0`) installed as a git dependency because npm publishing is blocked on an account suspension; `packages/llm/effort-policy/src/core.ts` re-exports it under the unchanged `./core` path. Replace that spec with the registry version — and drop the matching `OVERRIDES` entry in `scripts/gen-third-party-notices.ts` — once the release exists. npm itself cannot install a git dependency, so pnpm is required to install this checkout until then.

Three profile patches carry this, one per installed or development home:

- `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` — the installed application.
- `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` — the `web` profile.
- `apps\desktop\.desktop-build\development\home\profiles\desktop\cordis.patch.yml` — the development launcher.

The desktop and web applications mount the two delegation tools inside the `preset-standard` agent preset, and a patch replaces a row's whole config without descending into a preset, so each file also restates that preset's plugin list with `effortPolicy: true` on both delegation rows. That copy does not track upstream; after an upstream merge that changes the preset, regenerate it from the composed tree and re-add the two flags:

```powershell
$env:DSH_HOME = "$env:USERPROFILE\.dsh"
pnpm dsh --profile web --dump-config   # section `preset-standard`
```

Rollback is one edit per file: `effort-policy` `enabled: false`, `effortPolicy: false` on the two host rows, and delete the restated `preset-standard` row. The in-tree gate for the composition is `apps/cli/tests/profiles/effort-policy` under `pnpm run test:expected`.

## Architecture note

Upstream documents `dsh` as the sole supported Node application launcher. This fork deliberately adds `fife` as a second, classified entry point. `apps/cli/src/fife.ts` calls the exported `runCli()` from `apps/cli/src/launcher.ts` and changes only the launcher name and the `--version` display string. `apps/cli/src/bin.ts` re-exports the same implementation for Desktop and keeps the `dsh` entry self-executing. `scripts/verify-application-entrypoints.ts` classifies both entry points and still rejects any other package bin or executable source.
