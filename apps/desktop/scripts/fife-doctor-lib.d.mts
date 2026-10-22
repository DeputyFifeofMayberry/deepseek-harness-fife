/** Packaged feed facts of an installed Desktop build. */
export interface InstalledUpdateConfig {
  readonly provider: string
  readonly url: string
  readonly channel: string
  readonly updaterCacheDirName: string
}

/** One channel metadata document. */
export interface UpdateMetadata {
  readonly version: string
  readonly fileName: string
}

/** Read the feed electron-updater reads from an installed application. */
export function readInstalledUpdateConfig(resourcesDir: string): Promise<InstalledUpdateConfig>

/** Read the channel metadata filename the nightly or latest feed serves for Windows. */
export function windowsMetadataFilename(channel: string): string

/** Extract the GitHub repository that hosts a Releases feed. */
export function feedRepository(url: string): string | undefined

/** Parse one channel metadata document. */
export function parseUpdateMetadata(text: string): UpdateMetadata

/** Read the installer an update already downloaded and left waiting for installation. */
export function pendingUpdateInstaller(cacheDir: string): Promise<string | undefined>
