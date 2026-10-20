/** Build and publish one fork Desktop release into the fife GitHub Releases update feed. */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  FIFE_DESKTOP_UPDATE_FEED_URL_ENV,
  desktopUpdateMetadataFilename,
  resolveDesktopUpdateChannel,
  resolveFifeFeedUrl,
} from './desktop-auto-update-environment.mjs'
import { desktopBuildVersionPrefix, validateDesktopBuildVersion } from './desktop-build-version.mjs'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const UNSIGNED_ARTIFACTS = join(APP_ROOT, '.desktop-build', 'targets', 'win-x64', 'unsigned-artifacts')
/** The packaged application identifier; the fork keeps the upstream id so a fork installer upgrades in place. */
const FIFE_APP_ID = 'com.deepseek.harness'

/**
 * Run one program and return its stdout, failing the release on any failure.
 * @param {readonly string[]} args - Program name and arguments.
 * @param {{ inputEnv?: NodeJS.ProcessEnv, shell?: boolean }} options - Added environment; the shell flag exists because Windows resolves `pnpm` only through its `.cmd` shim, and shell invocation would misquote argument values with spaces.
 * @returns {string} Trimmed stdout.
 */
function run(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: APP_ROOT,
    env: options.inputEnv === undefined ? process.env : { ...process.env, ...options.inputEnv },
    encoding: 'utf8',
    shell: options.shell === true,
    windowsHide: true,
  })
  if (result.error !== undefined) throw new Error(`fife desktop release: cannot run ${args[0]}: ${result.error.message}`)
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(`fife desktop release: ${args[0]} ${args.slice(1).join(' ')} failed${output === '' ? '' : `: ${output}`}`)
  }
  return (result.stdout ?? '').trim()
}

/**
 * Format a date as the build version's date segment, matching desktopBuildDateSegment.
 * @param {Date} date - Date to format.
 * @returns {string} The date as `YYYYMMDD` in the host's own time zone.
 */
function dateSegment(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${String(date.getFullYear())}${month}${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Escape a literal for use inside a regular expression.
 * @param {string} value - Literal text.
 * @returns {string} Escaped text.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Resolve the user's own temp directory as an absolute Windows path.
 * @returns {string} Absolute temp directory, or the current directory when none can be resolved.
 */
function userTemp() {
  const candidate = process.env.LOCALAPPDATA
  if (candidate !== undefined && isAbsolute(candidate)) return join(candidate, 'Temp')
  return isAbsolute(tmpdir()) ? tmpdir() : process.cwd()
}

/**
 * Read the sequence numbers today's fife releases already use.
 * @param {string} repo - `owner/name` repository that hosts the feed.
 * @param {string} tagPrefix - Regexp source matching `v<prefix><date>.` for one product version and date.
 * @returns {number[]} Every index present, unordered.
 */
function takenIndexes(repo, tagPrefix) {
  const listing = JSON.parse(run(['gh', 'release', 'list', '--repo', repo, '--limit', '200', '--json', 'tagName']))
  const tag = new RegExp(`^v${tagPrefix}(\\d+)$`, 'u')
  return listing.flatMap(release => {
    const match = tag.exec(release.tagName ?? '')
    return match === null ? [] : [Number(match[1])]
  })
}

/**
 * Ensure the Windows packaging file selects the fife deployment.
 *
 * The packaging loader reads `DSH_DESKTOP_AUTO_UPDATE_ENV` only from the platform file, so a missing
 * file is created with the fife settings; a user-owned file is never rewritten, and one that selects
 * another deployment fails the release instead.
 * @returns {void}
 */
function ensureWindowsEnvironmentFile() {
  const path = join(APP_ROOT, '.env.windows')
  if (!existsSync(path)) {
    writeFileSync(path, `DSH_DESKTOP_APP_ID=${FIFE_APP_ID}\nDSH_DESKTOP_AUTO_UPDATE_ENV=fife\n`)
    process.stdout.write(`fife desktop release: created ${path} with the fife deployment settings\n`)
    return
  }
  const contents = readFileSync(path, 'utf8')
  if (!/^DSH_DESKTOP_AUTO_UPDATE_ENV=fife$/mu.test(contents) || !/^DSH_DESKTOP_APP_ID=/mu.test(contents)) {
    throw new Error(`fife desktop release: ${path} must declare "DSH_DESKTOP_APP_ID=..." and "DSH_DESKTOP_AUTO_UPDATE_ENV=fife" to publish the fife feed`)
  }
}

/**
 * Build one unsigned fife Desktop release and publish its feed assets.
 * @param {NodeJS.ProcessEnv} env - Calling environment; the feed URL may arrive through it.
 * @param {string | undefined} requestedNotes - Release notes from the command line.
 * @param {string | undefined} requestedFeedUrl - Feed URL overriding the repository default.
 * @returns {Promise<void>} Resolves after the GitHub release is published.
 */
async function main(env, requestedNotes, requestedFeedUrl) {
  const repo = run(['gh', 'repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])
  const productVersion = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8')).version
  const requested = requestedFeedUrl ?? env[FIFE_DESKTOP_UPDATE_FEED_URL_ENV] ?? `https://github.com/${repo}/releases/latest/download`
  const feedUrl = resolveFifeFeedUrl({ [FIFE_DESKTOP_UPDATE_FEED_URL_ENV]: requested })
  const prefix = desktopBuildVersionPrefix(productVersion)
  const date = dateSegment()
  const indexes = takenIndexes(repo, escapeRegExp(`v${prefix}${date}.`))
  const buildVersion = validateDesktopBuildVersion(`${prefix}${date}.${Math.max(0, ...indexes) + 1}`, productVersion)

  ensureWindowsEnvironmentFile()
  const channel = resolveDesktopUpdateChannel(env)
  process.stdout.write(`fife desktop release: packaging ${buildVersion} for ${feedUrl}\n`)
  // Unix-style shells put GNU tar first on PATH, and it reads a drive-letter archive path as a
  // remote host, so an ordinary Windows PATH is forced. A Unix-style TEMP makes Windows resolve
  // the system temp directory, where the installer build cannot write its include files, so an
  // absolute temp directory is forced too.
  const shellSettings = process.platform === 'win32'
    ? { PATH: `C:\\Windows\\System32;${process.env.PATH ?? ''}`,
        ...(/^([A-Za-z]:[\\/]|\\\\)/u.test(env.TEMP ?? '') ? {} : { TEMP: userTemp(), TMP: userTemp() }) }
    : {}
  run(['pnpm', 'run', 'package:win:x64:unsigned', '--', '--build-version', buildVersion],
    { inputEnv: { ...shellSettings, [FIFE_DESKTOP_UPDATE_FEED_URL_ENV]: feedUrl }, shell: true })

  const installer = join(UNSIGNED_ARTIFACTS, `deepseek-harness-${buildVersion}-win-x64-unsigned.exe`)
  const assets = [installer, `${installer}.blockmap`, join(UNSIGNED_ARTIFACTS, desktopUpdateMetadataFilename(buildVersion, 'win32', channel))]
  const missing = assets.filter(asset => !existsSync(asset))
  if (missing.length > 0) {
    throw new Error(`fife desktop release: missing packaging outputs ${missing.map(asset => JSON.stringify(asset)).join(', ')}; ${
      existsSync(UNSIGNED_ARTIFACTS) ? readdirSync(UNSIGNED_ARTIFACTS).join(', ') : `${UNSIGNED_ARTIFACTS} does not exist`}`)
  }

  const commit = run(['git', 'rev-parse', '--short', 'HEAD'])
  const notes = [`Build ${buildVersion} from ${commit}.`, ...(requestedNotes === undefined ? [] : [requestedNotes])].join('\n\n')
  const url = run(['gh', 'release', 'create', `v${buildVersion}`, '--repo', repo,
    '--title', `fife desktop ${buildVersion}`, '--notes', notes, ...assets])
  process.stdout.write(`fife desktop release: published ${url}\n`)
  process.stdout.write(`fife desktop release: the installed app offers this update on its next check (about every 10 minutes, on focus, or via "Check for Updates…").\n`)
}

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    notes: { type: 'string' },
    'feed-url': { type: 'string' },
  },
})
await main(process.env, values.notes, values['feed-url']).catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
