/** Resolve the Desktop auto-update channel and its deployment destination. */

import { valid } from 'semver'

/** Environment variable that selects the Desktop update deployment. */
export const DESKTOP_AUTO_UPDATE_ENV = 'DSH_DESKTOP_AUTO_UPDATE_ENV'

/** Environment variable that carries the fife deployment's public updater feed URL. */
export const FIFE_DESKTOP_UPDATE_FEED_URL_ENV = 'FIFE_DESKTOP_UPDATE_FEED_URL'

/**
 * Resolve the channel embedded in the installer; omitted local settings retain nightly.
 * @param {NodeJS.ProcessEnv} env Packaging or upload settings.
 * @returns {'nightly' | 'latest'} Validated channel.
 */
export function resolveDesktopUpdateChannel(env) {
  const channel = env.DSH_DESKTOP_UPDATE_CHANNEL || 'nightly'
  if (channel !== 'nightly' && channel !== 'latest') throw new Error('desktop auto-update: invalid update channel')
  return channel
}

const UPDATE_ENVIRONMENTS = {
  test: {
    originEnvName: 'DOWNLOAD_TEST_ORIGIN',
    fixedOrigin: undefined,
    bucketEnvName: 'DOWNLOAD_TEST_COS_BUCKET',
    secretIdEnvName: 'DOWNLOAD_TEST_COS_SECRET_ID',
    secretKeyEnvName: 'DOWNLOAD_TEST_COS_SECRET_KEY',
  },
  production: {
    originEnvName: undefined,
    fixedOrigin: 'https://download.deepseek.com',
    bucketEnvName: 'DOWNLOAD_PROD_COS_BUCKET',
    secretIdEnvName: 'DOWNLOAD_PROD_COS_SECRET_ID',
    secretKeyEnvName: 'DOWNLOAD_PROD_COS_SECRET_KEY',
  },
}

const UPDATE_TARGETS = new Set(['mac-arm64', 'mac-x64', 'win-x64'])

/**
 * Resolve the update deployment, defaulting local release work to test.
 * @param {NodeJS.ProcessEnv} env - Packaging or upload environment.
 * @returns {'test' | 'production' | 'fife'} Validated deployment name.
 */
export function resolveDesktopAutoUpdateEnvironment(env) {
  const value = env[DESKTOP_AUTO_UPDATE_ENV]?.trim() || 'test'
  if (value !== 'test' && value !== 'production' && value !== 'fife') {
    throw new Error(`desktop auto-update: ${DESKTOP_AUTO_UPDATE_ENV} must be "test", "production", or "fife"`)
  }
  return value
}

/**
 * Resolve one supported platform and architecture to its update directory.
 * @param {NodeJS.Platform} platform - Target Node.js platform.
 * @param {string} arch - Target Node.js architecture.
 * @returns {'mac-arm64' | 'mac-x64' | 'win-x64'} Update target directory.
 */
export function resolveDesktopAutoUpdateTarget(platform, arch) {
  const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : platform
  const target = `${os}-${arch}`
  if (!UPDATE_TARGETS.has(target)) {
    throw new Error(`desktop auto-update: unsupported target ${target}`)
  }
  return target
}

/**
 * Return the local completion record filename for one packaged target.
 * @param {'mac-arm64' | 'mac-x64' | 'win-x64'} target - Supported release target.
 * @returns {string} Filename stored beside electron-builder artifacts.
 */
export function desktopBuildRecordFilename(target) {
  if (!UPDATE_TARGETS.has(target)) {
    throw new Error(`desktop auto-update: unsupported target ${target}`)
  }
  return `${target}-release.json`
}

/**
 * Return the electron-builder channel metadata filename for an application version.
 * @param {string} version - Desktop semantic version.
 * @param {NodeJS.Platform} platform - Target platform.
 * @param {'nightly' | 'latest'} channel - Selected channel; omitted means nightly.
 * @returns {string} Channel metadata filename emitted for the target.
 */
export function desktopUpdateMetadataFilename(version, platform, channel = 'nightly') {
  if (valid(version) === null) {
    throw new Error(`desktop auto-update: invalid Desktop version ${JSON.stringify(version)}`)
  }
  if (platform !== 'darwin' && platform !== 'win32') {
    throw new Error(`desktop auto-update: unsupported metadata platform ${platform}`)
  }
  resolveDesktopUpdateChannel({ DSH_DESKTOP_UPDATE_CHANNEL: channel })
  return `${channel}${platform === 'darwin' ? '-mac' : ''}.yml`
}

/**
 * Read one required release setting without accepting whitespace-only values.
 * @param {NodeJS.ProcessEnv} env - Packaging or upload environment.
 * @param {string} name - Environment variable to read.
 * @returns {string} Trimmed setting.
 */
function requiredEnvironmentValue(env, name) {
  const value = env[name]?.trim()
  if (value === undefined || value === '') {
    throw new Error(`desktop auto-update: ${name} must be set to a non-empty value`)
  }
  return value
}

/**
 * Normalize an HTTPS origin and reject paths or credentials.
 * @param {string} value - Candidate origin.
 * @param {string} name - Environment variable used in diagnostics.
 * @returns {string} Normalized HTTPS origin without a trailing slash.
 */
function httpsOrigin(value, name) {
  let parsed
  try {
    parsed = new URL(value)
  }
  catch {
    throw new Error(`desktop auto-update: ${name} must be an absolute HTTPS origin`)
  }
  if (parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.pathname !== '/'
    || parsed.search !== ''
    || parsed.hash !== '') {
    throw new Error(`desktop auto-update: ${name} must be an absolute HTTPS origin without a path, credentials, query, or fragment`)
  }
  return parsed.origin
}

/**
 * Resolve the fife deployment's public updater feed URL.
 *
 * Unlike the COS deployments, the fife feed lives behind a full URL path (a GitHub
 * Releases `latest/download` address), so the value is a URL rather than a bare origin.
 * The path must be nonempty because a bare origin would serve no channel file.
 * @param {NodeJS.ProcessEnv} env - Packaging environment.
 * @returns {string} HTTPS feed URL with exactly one trailing slash.
 * @throws {Error} When the feed URL is missing, relative, non-HTTPS, or carries credentials, query, or fragment.
 */
export function resolveFifeFeedUrl(env) {
  const value = requiredEnvironmentValue(env, FIFE_DESKTOP_UPDATE_FEED_URL_ENV)
  let parsed
  try {
    parsed = new URL(value)
  }
  catch {
    throw new Error(`desktop auto-update: ${FIFE_DESKTOP_UPDATE_FEED_URL_ENV} must be an absolute HTTPS URL`)
  }
  if (parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.pathname === '/'
    || parsed.search !== ''
    || parsed.hash !== '') {
    throw new Error(`desktop auto-update: ${FIFE_DESKTOP_UPDATE_FEED_URL_ENV} must be an absolute HTTPS URL with a path and without credentials, query, or fragment`)
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/u, '')}/`
}

/**
 * Resolve the public updater URL and object prefixes for one release target.
 * @param {NodeJS.ProcessEnv} env - Packaging or upload environment.
 * @param {NodeJS.Platform} platform - Target Node.js platform.
 * @param {string} arch - Target Node.js architecture.
 * @returns {{ environment: 'test' | 'production' | 'fife', channel: 'nightly' | 'latest', target: 'mac-arm64' | 'mac-x64' | 'win-x64', origin: string, publicUrl: string, keyPrefix: string, binaryKeyPrefix: string }} Resolved updater configuration; the fife deployment serves one flat feed and leaves the object prefixes empty.
 * @throws {Error} When the test deployment lacks a valid HTTPS origin or a 32-character lowercase hexadecimal release ID, or the fife deployment lacks a valid feed URL.
 */
export function resolveDesktopAutoUpdateConfig(env, platform, arch) {
  const channel = resolveDesktopUpdateChannel(env)
  const environment = resolveDesktopAutoUpdateEnvironment(env)
  const target = resolveDesktopAutoUpdateTarget(platform, arch)
  if (environment === 'fife') {
    const publicUrl = resolveFifeFeedUrl(env)
    return { environment, channel, target, origin: new URL(publicUrl).origin, keyPrefix: '', binaryKeyPrefix: '', publicUrl }
  }
  const deployment = UPDATE_ENVIRONMENTS[environment]
  let origin = deployment.fixedOrigin
  if (origin === undefined) {
    const { originEnvName } = deployment
    if (originEnvName === undefined) throw new Error('desktop auto-update: selected deployment has no origin')
    origin = httpsOrigin(requiredEnvironmentValue(env, originEnvName), originEnvName)
  }
  let releasePrefix = 'dsh-desk'
  if (environment === 'test') {
    const releaseId = requiredEnvironmentValue(env, 'DOWNLOAD_TEST_RELEASE_ID')
    if (!/^[a-f0-9]{32}$/u.test(releaseId)) {
      throw new Error('desktop auto-update: DOWNLOAD_TEST_RELEASE_ID must contain 32 lowercase hexadecimal characters')
    }
    releasePrefix += `/${releaseId}`
  }
  const keyPrefix = `${releasePrefix}/feeds/${target}`
  return {
    environment,
    channel,
    target,
    origin,
    keyPrefix,
    binaryKeyPrefix: `${releasePrefix}/bin/${target}${channel === 'latest' ? '/latest' : ''}`,
    publicUrl: `${origin}/${keyPrefix}/`,
  }
}

/**
 * Resolve the public updater URL and private COS destination for one upload target.
 * @param {NodeJS.ProcessEnv} env - Upload environment.
 * @param {NodeJS.Platform} platform - Target Node.js platform.
 * @param {string} arch - Target Node.js architecture.
 * @returns {{ environment: 'test' | 'production', channel: 'nightly' | 'latest', target: 'mac-arm64' | 'mac-x64' | 'win-x64', origin: string, publicUrl: string, keyPrefix: string, binaryKeyPrefix: string, bucket: string, secretIdEnvName: string, secretKeyEnvName: string }} Resolved upload configuration.
 * @throws {Error} When the selected deployment lacks a bucket or valid updater configuration, or is the fife deployment.
 */
export function resolveDesktopUploadConfig(env, platform, arch) {
  const update = resolveDesktopAutoUpdateConfig(env, platform, arch)
  if (update.environment === 'fife') {
    throw new Error('desktop auto-update: the fife deployment publishes through GitHub Releases; the COS upload path does not apply')
  }
  const deployment = UPDATE_ENVIRONMENTS[update.environment]
  return {
    ...update,
    bucket: requiredEnvironmentValue(env, deployment.bucketEnvName),
    secretIdEnvName: deployment.secretIdEnvName,
    secretKeyEnvName: deployment.secretKeyEnvName,
  }
}
