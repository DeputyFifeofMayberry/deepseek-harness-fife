/** Read-only facts for diagnosing why an installed Desktop build is not offered an update. */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { load } from 'js-yaml'

/**
 * Read the feed electron-updater reads from an installed application.
 * @param {string} resourcesDir - Installed application resources directory.
 * @returns {Promise<{ provider: string, url: string, channel: string, updaterCacheDirName: string }>} Packaged feed facts.
 * @throws {Error} When the file is missing or does not declare a complete generic feed.
 */
export async function readInstalledUpdateConfig(resourcesDir) {
  const path = join(resourcesDir, 'app-update.yml')
  const text = await readFile(path, 'utf8').catch(error => {
    throw new Error(`fife doctor: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  })
  const config = load(text)
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`fife doctor: ${path} must contain an object`)
  }
  const { provider, url, channel, updaterCacheDirName } = config
  if (provider !== 'generic') throw new Error(`fife doctor: ${path} does not use the generic provider`)
  if (typeof url !== 'string' || url === '') throw new Error(`fife doctor: ${path} has no feed URL`)
  if (typeof channel !== 'string' || channel === '') throw new Error(`fife doctor: ${path} has no channel`)
  if (typeof updaterCacheDirName !== 'string' || updaterCacheDirName === '') {
    throw new Error(`fife doctor: ${path} has no updater cache directory`)
  }
  return { provider, url, channel, updaterCacheDirName }
}

/**
 * Read the channel metadata filename the nightly or latest feed serves for Windows.
 * @param {string} channel - Packaged channel.
 * @returns {string} Metadata filename electron-updater requests below the feed URL.
 */
export function windowsMetadataFilename(channel) {
  return `${channel}.yml`
}

/**
 * Extract the GitHub repository that hosts a Releases feed.
 * @param {string} url - Feed URL.
 * @returns {string | undefined} `owner/name` when the feed is a GitHub Releases download path.
 */
export function feedRepository(url) {
  let parsed
  try {
    parsed = new URL(url)
  }
  catch {
    return undefined
  }
  if (parsed.hostname !== 'github.com') return undefined
  const match = /^\/([^/]+)\/([^/]+)\/releases\//u.exec(parsed.pathname)
  return match === null ? undefined : `${match[1]}/${match[2]}`
}

/**
 * Parse one channel metadata document.
 * @param {string} text - YAML metadata body.
 * @returns {{ version: string, fileName: string }} Version the feed offers and the installer it names.
 * @throws {Error} When the document does not name a version, path, and file.
 */
export function parseUpdateMetadata(text) {
  const metadata = load(text)
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new Error('fife doctor: channel metadata must contain an object')
  }
  const { version, path, files } = metadata
  if (typeof version !== 'string' || version === '') throw new Error('fife doctor: channel metadata has no version')
  if (typeof path !== 'string' || path === '') throw new Error('fife doctor: channel metadata has no installer path')
  if (!Array.isArray(files) || files.length === 0) throw new Error('fife doctor: channel metadata lists no file')
  return { version, fileName: path }
}

/**
 * Read the installer an update already downloaded and left waiting for installation.
 * @param {string} cacheDir - electron-updater cache directory.
 * @returns {Promise<string | undefined>} Pending installer filename, or undefined when nothing is pending.
 */
export async function pendingUpdateInstaller(cacheDir) {
  const path = join(cacheDir, 'pending', 'update-info.json')
  let text
  try {
    text = await readFile(path, 'utf8')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw new Error(`fife doctor: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const info = JSON.parse(text)
  if (typeof info !== 'object' || info === null || typeof info.fileName !== 'string') {
    throw new Error(`fife doctor: ${path} does not name a downloaded installer`)
  }
  return info.fileName
}
