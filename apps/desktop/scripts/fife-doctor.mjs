/** Report why an installed Desktop build is or is not offered an update; never changes state. */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  feedRepository,
  parseUpdateMetadata,
  pendingUpdateInstaller,
  readInstalledUpdateConfig,
  windowsMetadataFilename,
} from './fife-doctor-lib.mjs'

const DEFAULT_APP_PATH = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness')

/**
 * Run `gh` and return trimmed stdout, or undefined when it cannot answer.
 * @param {readonly string[]} args - Arguments after the program name.
 * @returns {string | undefined} Trimmed stdout.
 */
function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', windowsHide: true })
  return result.status === 0 ? result.stdout.trim() : undefined
}

/**
 * Print one labelled fact.
 * @param {string} label - Fact name.
 * @param {string} value - Fact value.
 * @returns {void}
 */
function report(label, value) {
  process.stdout.write(`${label.padEnd(16)} ${value}\n`)
}

/**
 * Report the installed build, its packaged feed, the published release, and the pending update.
 * @param {NodeJS.ProcessEnv} env - Calling environment; the application path may be overridden.
 * @param {string | undefined} requestedAppPath - `--app-path` override.
 * @returns {Promise<number>} Zero when the installed build can reach its feed, otherwise one.
 */
async function main(env, requestedAppPath) {
  const appPath = requestedAppPath ?? env.FIFE_DOCTOR_APP_PATH ?? DEFAULT_APP_PATH
  const resources = join(appPath, 'resources')
  report('application', appPath)
  report('resources', resources)

  let config
  try {
    config = await readInstalledUpdateConfig(resources)
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.stderr.write('fife doctor: this application cannot check for updates; reinstall a published build.\n')
    return 1
  }
  report('feed', config.url)
  report('channel', config.channel)
  report('cache', join(env.LOCALAPPDATA ?? '', config.updaterCacheDirName))

  const repository = feedRepository(config.url)
  report('repository', repository ?? 'not a GitHub Releases feed')

  const metadataUrl = new URL(windowsMetadataFilename(config.channel), config.url).toString()
  let feedVersion
  try {
    const response = await fetch(metadataUrl, { redirect: 'follow' })
    if (!response.ok) throw new Error(`${String(response.status)} ${response.statusText}`)
    const metadata = parseUpdateMetadata(await response.text())
    feedVersion = metadata.version
    report('feed version', metadata.version)
    report('feed installer', metadata.fileName)
  }
  catch (error) {
    process.stderr.write(`fife doctor: cannot read ${metadataUrl}: ${error instanceof Error ? error.message : String(error)}\n`)
    process.stderr.write('fife doctor: the update feed is unreachable from this machine.\n')
    return 1
  }

  if (repository !== undefined) {
    const release = gh(['release', 'view', '--repo', repository, '--json', 'tagName,assets'])
    if (release === undefined) {
      report('latest release', 'unavailable (gh could not answer)')
    }
    else {
      const parsed = JSON.parse(release)
      const assets = Array.isArray(parsed.assets) ? parsed.assets.map(asset => asset.name) : []
      report('latest release', `${String(parsed.tagName)} (${String(assets.length)} assets)`)
      if (!assets.some(name => typeof name === 'string' && name.endsWith('.blockmap'))) {
        report('assets', 'missing the .blockmap; differential downloads are disabled')
      }
    }
  }

  const cacheDir = join(env.LOCALAPPDATA ?? '', config.updaterCacheDirName)
  const pending = await pendingUpdateInstaller(cacheDir)
  report('pending', pending === undefined ? 'nothing downloaded' : `${pending} (downloaded, not installed)`)
  report('offered', `the next check compares the installed version with ${feedVersion}`)
  return 0
}

const { values } = parseArgs({
  allowPositionals: false,
  options: { 'app-path': { type: 'string' } },
})
process.exitCode = await main(process.env, values['app-path']).catch(error => {
  process.stderr.write(`fife doctor: ${error instanceof Error ? error.message : String(error)}\n`)
  return 1
})
