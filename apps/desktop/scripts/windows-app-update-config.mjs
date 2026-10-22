/** Verify the updater configuration and channel metadata sealed into a Windows build. */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { load } from 'js-yaml'

const CONFIG_FILENAME = 'app-update.yml'
const CHANNELS = ['nightly', 'latest']

function object(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`desktop Windows update config: ${label} must be an object`)
  }
  return value
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`desktop Windows update config: ${label} must be a non-empty string`)
  }
  return value
}

function channel(value, label) {
  if (!CHANNELS.includes(value)) throw new Error(`desktop Windows update config: ${label} must be nightly or latest`)
  return value
}

/**
 * Compare two feed URLs without their trailing slashes.
 * @param {string} value - Feed URL.
 * @returns {string} Comparable URL.
 */
function feedIdentity(value) {
  return value.replace(/\/+$/u, '')
}

/**
 * Verify the update configuration electron-builder embedded beside the Windows application.
 * @param {string} resourcesDir - Assembled application resources directory.
 * @param {{ publicUrl: string, channel?: 'nightly' | 'latest' }} update - Expected feed and channel.
 * @returns {Promise<void>} Resolves when the packaged application can reach the expected feed.
 */
export async function verifyWindowsAppUpdateConfig(resourcesDir, update) {
  const path = join(resourcesDir, CONFIG_FILENAME)
  let parsed
  try {
    parsed = load(await readFile(path, 'utf8'))
  }
  catch (error) {
    throw new Error(`desktop Windows update config: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const config = object(parsed, CONFIG_FILENAME)
  const expectedFeed = feedIdentity(nonEmptyString(update.publicUrl, 'expected public URL'))
  if (config.provider !== 'generic') {
    throw new Error(`desktop Windows update config: ${path} must use the generic provider`)
  }
  if (feedIdentity(nonEmptyString(config.url, `${CONFIG_FILENAME}.url`)) !== expectedFeed) {
    throw new Error(`desktop Windows update config: ${path} does not match ${update.publicUrl}`)
  }
  const expectedChannel = update.channel === undefined ? 'nightly' : channel(update.channel, 'expected channel')
  if (config.channel !== expectedChannel) {
    throw new Error(`desktop Windows update config: ${path} declares channel ${String(config.channel)}; expected ${expectedChannel}`)
  }
  nonEmptyString(config.updaterCacheDirName, `${CONFIG_FILENAME}.updaterCacheDirName`)
}

/**
 * Verify the channel metadata names the built version and installer electron-updater will download.
 * @param {string} metadataPath - Emitted channel metadata file.
 * @param {{ version: string, installerName: string }} expected - Build version and installer filename.
 * @returns {Promise<void>} Resolves when the feed metadata and the installer agree.
 */
export async function verifyWindowsUpdateMetadata(metadataPath, expected) {
  const version = nonEmptyString(expected.version, 'expected version')
  const installerName = nonEmptyString(expected.installerName, 'expected installer')
  let parsed
  try {
    parsed = load(await readFile(metadataPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`desktop Windows update config: cannot read ${metadataPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const metadata = object(parsed, metadataPath)
  if (metadata.version !== version) {
    throw new Error(`desktop Windows update config: ${metadataPath} declares version ${String(metadata.version)}; expected ${version}`)
  }
  if (metadata.path !== installerName) {
    throw new Error(`desktop Windows update config: ${metadataPath} names ${String(metadata.path)}; expected ${installerName}`)
  }
  if (!Array.isArray(metadata.files) || metadata.files.length === 0) {
    throw new Error(`desktop Windows update config: ${metadataPath} must list the installer file`)
  }
  const file = object(metadata.files[0], `${metadataPath} files[0]`)
  if (file.url !== installerName) {
    throw new Error(`desktop Windows update config: ${metadataPath} names ${String(file.url)}; expected ${installerName}`)
  }
  nonEmptyString(file.sha512, `${metadataPath} files[0].sha512`)
}
