# Automating FIFECODE app updates

A complete procedure for an agent or a person to take a source change in this fork and land it in the
installed Windows application. [FORK.md](FORK.md) owns the fork's product decisions; this file is the
operator runbook and the record of every host-specific trap the release has produced.

## 1. Four artifacts, one version

| Artifact | Built from | Where it lands |
| --- | --- | --- |
| Web GUI (`dsh web`) | `pnpm run build` → `apps/web/dist` | the browser tab on the port printed at launch |
| Desktop app | the packaged workspace | `%LOCALAPPDATA%\Programs\DeepSeek Harness` |
| GitHub release (update feed) | `apps\desktop\scripts\fife-release.mjs` | `DeputyFifeofMayberry/deepseek-harness-fife` releases |
| Profile composition | `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` | live plugins and config in the app |

The installed app updates **only** from published GitHub releases. Merging to `master` and running
`pnpm run build` changes the web GUI alone; it never changes the app the user launches.

## 2. Fixed facts

```
repository        Y:\deepseek-harness_fife           origin: DeputyFifeofMayberry/deepseek-harness-fife
worktrees         Y:\deepseek-harness_fife\.agents\worktrees\<name>
installed app     %LOCALAPPDATA%\Programs\DeepSeek Harness
installed version HKCU\...\Uninstall → DisplayName "DeepSeek Harness <version>"
app id            com.deepseek.harness   (upstream id, so installers upgrade in place)
update feed       https://github.com/DeputyFifeofMayberry/deepseek-harness-fife/releases/latest/download/
feed manifest     nightly.yml            (channel "nightly", even for stable versions)
release assets    <installer>.exe, <installer>.exe.blockmap, nightly.yml
updater cache     %LOCALAPPDATA%\@deepseek-aidsh-desktop-updater
user home         %USERPROFILE%\.dsh      (profiles/desktop, profiles/web)
bundled runtime   apps\desktop\.desktop-build\development\home\dsh-runtimes\dsh-primary-runtime
bundled pnpm      <bundled runtime>\dependencies\pnpm\bin\pnpm.mjs   (11.28.5, Node 24.21.0)
```

Version scheme: `<product version>.<YYYYMMDD>.<index>`, where the index counts the releases already
published for that day, for example `0.2.1-rc.2.20261022.2`.

## 3. The fast path: GitHub Actions

`.github/workflows/fife-desktop-release.yml` builds and publishes the release on a `windows-latest`
runner. It needs no secrets — only its own `GITHUB_TOKEN` with `contents: write` — because the fife
deployment is unsigned and publishes to this repository.

```powershell
gh workflow run fife-desktop-release.yml --repo DeputyFifeofMayberry/deepseek-harness-fife `
  --ref master -f confirm=publish -f notes="what changed"
gh run watch --repo DeputyFifeofMayberry/deepseek-harness-fife --interval 30
```

Rules that keep this path reliable:

- The workflow requires `master` and a `confirm: publish` input; a failed run leaves the feed unchanged.
- Expect roughly 20–30 minutes on a hosted runner (4 vCPU). The job packs ~300 workspace packages,
  installs the production runtime, smoke-tests it, and compresses a 288 MB NSIS installer.
- Nothing else may publish concurrently: the job sets `concurrency: fife-desktop-release` with
  `cancel-in-progress: false`.
- Trust but verify (section 5) before declaring success.

## 4. The local path

Use it when the runner is unavailable. It takes 11–13 minutes and **cannot resume**, so a cancelled run
always starts over — which is the single largest source of lost time in this repository's history.

```powershell
# from the checkout that holds the commit to build, with apps\desktop\.env.windows present
node apps/desktop/scripts/fife-release.mjs --notes "what changed"
```

Local packaging must run with a **short `PATH`**. The interactive shell on this machine carries about
7,300 characters; `electron-builder` compiles the NSIS helper through `cmd.exe`, `vcvars32.bat` appends
the Visual Studio paths, and the command line crosses cmd's limit:

```
The input line is too long.
Native installer helper compilation failed.
```

Build from a ~400-character Windows `PATH` (System32, WindowsPowerShell, nodejs, Git cmd/usr/bin, GitHub
CLI, pnpm, plus the repo's `node_modules\.bin`). The measured cost breakdown of one local release:
`release:pack` 263 s (serial before the Windows `--concurrency 8` change), `prepare:dsh` 154 s,
`electron-builder` 154 s, runtime preparation 83 s, build 27 s.

## 5. Verify the release before declaring success

```powershell
gh release list --repo DeputyFifeofMayberry/deepseek-harness-fife --limit 1
gh release view v<version> --repo DeputyFifeofMayberry/deepseek-harness-fife `
  --json tagName,isDraft,isPrerelease,assets
node apps/desktop/scripts/fife-doctor.mjs
```

Expect `Latest`, `isDraft=false`, `isPrerelease=false`, the three assets, and a `fife-doctor` line
`feed version <new version>` with `pending nothing downloaded`.

## 6. Install without waiting for the updater

The app downloads on its own within about ten minutes, on focus, or via **Check for Updates…**. To
install immediately, from an elevated-free PowerShell:

```powershell
Stop-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\@deepseek-aidsh-desktop-updater\pending" -Recurse -Force -ErrorAction SilentlyContinue
$installer = "$env:USERPROFILE\Downloads\deepseek-harness-<version>-win-x64-unsigned.exe"
Start-Process -FilePath $installer -ArgumentList '/S' -Wait
```

Verify the installed copy rather than the sources:

```powershell
(Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* |
  Where-Object DisplayName -like '*DeepSeek Harness*').DisplayName
Select-String -Path "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app.asar" -Pattern 'FIFECODE'
Compare-Object (Get-FileHash "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\tray.ico").Hash `
  (Get-FileHash 'Y:\deepseek-harness_fife\apps\desktop\resources\tray-windows.ico').Hash
```

Finally launch `DeepSeek Harness.exe` and confirm the feature with the user.

## 7. Rules learned the hard way

1. **The app ships `master`, nothing else.** A feature left on `notes-header` or
   `feat/sidebar-usage-panel` is invisible however many releases are published. Check
   `git branch --no-merged master` before blaming the release; that exact mistake hid the Notes
   scratchpad and the usage panel from the installed app on 2026-10-22.
2. **Never restart the `dsh web` host.** It runs the current session; a page refresh picks up rebuilt
   client bundles.
3. **Use the bundled pnpm** for local installs: `node "<bundled pnpm>" install --prefer-offline`
   finishes a fresh worktree in under a minute.
4. **Never `git add -A` in the main checkout.** Parallel agent sessions leave work-in-progress edits
   there (`apps/desktop/src/main.ts`, `packages/client/web/src/mount.ts`, …). Stage explicit paths.
5. **`blockExoticSubdeps` stays waived** for `@mayberry/effort-policy-core` in
   `apps/desktop/scripts/prepare-dsh.ts` (`PNPM_CONFIG`) while that dependency is a git tag.
6. **Bilingual docs are recorded.** After editing a paired README run
   `pnpm exec tsx scripts/verify-translation-pairing.ts --write <README.md>`, then the same command
   without `--write`. Hand-edited `README.i18n.yaml` hashes fail the gate.
7. **Merge conflicts in documentation:** two branches regenerating one section leave duplicates.
   `scripts/verify-package-readme-model-experience.ts` rejects duplicate object keys with
   `TS1117`; keep the row that matches the current README, delete the other.
8. **Hooks in a fresh worktree fail** until dependencies are installed (`node_modules/.bin/tsx` not
   found). Install first, or commit with `--no-verify` and re-run the checks by hand.
9. **Known pre-existing failures:** `verify-repository-references` (`python/sdk/uv.lock:113`),
   `ui-theme` `radius-styles` and `corner-shape-styles`, `ui-deliverables` `present-open.host.spec.ts`,
   and `ui-sidebar-documentpreview`'s license spec when a Git-bash `PATH` puts GNU `tar` first
   (`tar: Cannot connect to C: resolve failed`). None indicate a regression from an app update.
10. **The installed app is single-instance.** While a development `electron.exe` from
    `Y:\deepseek-harness_fife\node_modules` runs, launching the installed exe exits 0 and opens
    nothing.
11. **Clear the updater cache after a manual install**, or the pending older installer runs on the next
    quit and downgrades the app.
12. **File hygiene:** one trailing newline, LF endings. Use `git -c core.autocrlf=false` and check
    `git diff --cached --check` before committing.
13. **Electron used as a rasterizer** receives its arguments at `process.argv.slice(2)` and needs
    `env -u ELECTRON_RUN_AS_NODE`.

## 8. End-to-end procedure

1. `git status --porcelain` and `git branch --no-merged master` in `Y:\deepseek-harness_fife`.
2. Integrate missing features in a worktree based on `master`; resolve doc conflicts; commit.
3. `node "<bundled pnpm>" install --prefer-offline`, then `run build` (expect 9/9), targeted
   `vitest run <touched packages>`, and `run test:docs` (expect 20/21).
4. `git push --no-verify origin HEAD:master`.
5. Dispatch `fife-desktop-release.yml` from `master` and watch it finish.
6. Verify with `gh release view` and `fife-doctor` (section 5).
7. Install and verify on disk (section 6), relaunch, and confirm the feature.
8. Refresh the web GUI tab at the printed URL.

## 9. Failure catalog

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ERR_PNPM_EXOTIC_SUBDEP … effort-policy-core` | pnpm 11 blocks git subdependencies | already waived by `PNPM_CONFIG` in `prepare-dsh.ts` |
| `The input line is too long` during packaging | `PATH` too long for `vcvars32.bat` | publish from CI, or trim `PATH` locally |
| `node_modules/.bin/tsx: No such file or directory` | dependencies not installed in that worktree | run the install step first |
| Feature missing in the app after a release | branch never merged into `master` | merge, rebuild, republish |
| Update never arrives | release is draft or prerelease, or `nightly.yml`/`.blockmap` missing | publish a regular release with all three assets |
| App quietly downgrades | stale installer in the updater `pending` directory | delete it before installing |
| Installed exe exits instantly with code 0 | development Electron holds the single-instance lock | close the dev instance |
| `tar: Cannot connect to C: resolve failed` in a spec | Git-bash GNU `tar` first on `PATH` | rerun under a Windows `PATH` or ignore as environmental |
| Web GUI shows old branding | stale tab or cache | reload the page |

## 10. Definition of done

- [ ] `master` on GitHub contains every feature the user expects (`git branch --no-merged master` empty).
- [ ] `pnpm run build` reports 9/9 gates and `test:docs` reports 20/21 with only the reference failure.
- [ ] The release is `Latest`, not draft or prerelease, with installer, `.blockmap`, and `nightly.yml`.
- [ ] `fife-doctor` reports the new `feed version` and `pending nothing downloaded`.
- [ ] The uninstall registry entry shows the new version, and `app.asar` contains the expected strings.
- [ ] The app launches and shows the requested change; the web GUI shows it after a reload.
