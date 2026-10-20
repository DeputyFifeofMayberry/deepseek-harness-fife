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

Publish one release from the repository root:

```powershell
node apps\desktop\scripts\fife-release.mjs --notes "what changed"
```

The command derives the next build version (`<product version>.<date>.<index>`, such as `0.2.1-rc.2.20261020.2`) from the release tags already published for today, packages the unsigned Windows target, and creates the GitHub release. Run the first installer by hand once; it upgrades the installed app in place, and every later release arrives through the app's own update flow. Windows SmartScreen warns once for an unsigned installer.

The build needs `apps/desktop/.env.windows` to declare `DSH_DESKTOP_APP_ID=com.deepseek.harness` and `DSH_DESKTOP_AUTO_UPDATE_ENV=fife`; the script creates that file when it is missing and refuses to rewrite one that exists. The feed URL defaults to this repository's `releases/latest/download` address and can be overridden with `FIFE_DESKTOP_UPDATE_FEED_URL` or `--feed-url`. The fife deployment skips signing and the mandatory-update policy service, so unsigned builds carry a working update source with checksum-only verification.

Fork scope: `apps/desktop/scripts/desktop-auto-update-environment.mjs` (the `fife` deployment), `apps/desktop/scripts/desktop-package-environment.mjs` and `apps/desktop/scripts/desktop-policy-environment.mjs` (fife skips the policy service), `apps/desktop/scripts/electron-builder-config.mjs` (unsigned builds keep their update source under fife), and `apps/desktop/scripts/fife-release.mjs` (the release driver). Upstream owns all of them except the release driver; after an upstream sync, re-apply the fife delta marked by `fife` in each file.

## Fork scope

This pass adds the command alias, the install workflow, and the desktop update feed. It does not change the persona, branding, default model, approval policy, autonomy, UI, system prompts, bundled skills, settings, or product documentation.

Keep future personal changes isolated so upstream merges stay small:

- Launcher commands: `apps/cli/src/fife.ts`, `apps/cli/src/launcher.ts`, and `apps/cli/src/args.ts`.
- Desktop update feed: the files listed in the Desktop updates section.
- Profiles and settings: `$DSH_HOME`, outside the repository.
- Personal skills: `~/.agents/skills`, outside the repository.

Do not commit personal configuration, credentials, session data, or skills to this public repository.

## Architecture note

Upstream documents `dsh` as the sole supported Node application launcher. This fork deliberately adds `fife` as a second, classified entry point. `apps/cli/src/fife.ts` calls the exported `runCli()` from `apps/cli/src/launcher.ts` and changes only the launcher name and the `--version` display string. `apps/cli/src/bin.ts` re-exports the same implementation for Desktop and keeps the `dsh` entry self-executing. `scripts/verify-application-entrypoints.ts` classifies both entry points and still rejects any other package bin or executable source.
