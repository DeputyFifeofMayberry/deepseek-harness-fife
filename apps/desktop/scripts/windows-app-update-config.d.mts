/** Expected updater feed sealed into a Windows application. */
export interface WindowsAppUpdateFeed {
  readonly publicUrl: string
  readonly channel?: 'nightly' | 'latest'
}

/** Build identity the emitted channel metadata must name. */
export interface WindowsUpdateMetadataExpectation {
  readonly version: string
  readonly installerName: string
}

/** Verify the update configuration electron-builder embedded beside the Windows application. */
export function verifyWindowsAppUpdateConfig(resourcesDir: string, update: WindowsAppUpdateFeed): Promise<void>

/** Verify the channel metadata names the built version and installer electron-updater will download. */
export function verifyWindowsUpdateMetadata(
  metadataPath: string,
  expected: WindowsUpdateMetadataExpectation,
): Promise<void>
