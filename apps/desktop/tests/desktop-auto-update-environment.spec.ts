import { describe, expect, it } from 'vitest'
import {
  desktopBuildRecordFilename,
  desktopUpdateMetadataFilename,
  resolveDesktopAutoUpdateConfig,
  resolveDesktopAutoUpdateEnvironment,
  resolveDesktopAutoUpdateTarget,
  resolveDesktopUploadConfig,
  resolveFifeFeedUrl,
} from '../scripts/desktop-auto-update-environment.mjs'

const RELEASE_ID = '0123456789abcdef0123456789abcdef'

describe('desktop auto-update environment', () => {
  it.each([undefined, 'test'])('requires a release ID for deployment %s', (deployment) => {
    const environment = { DSH_DESKTOP_AUTO_UPDATE_ENV: deployment, DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com',
      DOWNLOAD_TEST_COS_BUCKET: 'test-bucket' }
    expect(() => resolveDesktopAutoUpdateConfig(environment, 'win32', 'x64')).toThrow(/DOWNLOAD_TEST_RELEASE_ID/u)
    expect(() => resolveDesktopUploadConfig(environment, 'win32', 'x64')).toThrow(/DOWNLOAD_TEST_RELEASE_ID/u)
  })

  it.each(['', ' ', 'release-1', 'a'.repeat(31), 'a'.repeat(33), 'A'.repeat(32), 'g'.repeat(32),
    '../feeds', '01234567-89ab-cdef-0123-456789abcdef', `${RELEASE_ID}/bin`])('rejects invalid test release ID %j', (id) => {
    const environment = { DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com', DOWNLOAD_TEST_RELEASE_ID: id }
    expect(() => resolveDesktopAutoUpdateConfig(environment, 'darwin', 'arm64')).toThrow(/DOWNLOAD_TEST_RELEASE_ID/u)
  })

  it.each([['darwin', 'arm64', 'mac-arm64'], ['darwin', 'x64', 'mac-x64'], ['win32', 'x64', 'win-x64']] as const)
  ('uses one test release directory for %s %s feeds and binaries', (platform, arch, target) => {
    expect(resolveDesktopAutoUpdateConfig({ DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID }, platform, arch)).toMatchObject({
      publicUrl: `https://updates.example.com/dsh-desk/${RELEASE_ID}/feeds/${target}/`,
      keyPrefix: `dsh-desk/${RELEASE_ID}/feeds/${target}`,
      binaryKeyPrefix: `dsh-desk/${RELEASE_ID}/bin/${target}`,
    })
  })

  it('defaults packages and uploads to the test deployment', () => {
    expect(resolveDesktopAutoUpdateEnvironment({})).toBe('test')
    expect(resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com/',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
    }, 'darwin', 'arm64')).toEqual({
      environment: 'test', channel: 'nightly',
      target: 'mac-arm64',
      origin: 'https://desktop-updates.example.com',
      publicUrl: `https://desktop-updates.example.com/dsh-desk/${RELEASE_ID}/feeds/mac-arm64/`,
      keyPrefix: `dsh-desk/${RELEASE_ID}/feeds/mac-arm64`,
      binaryKeyPrefix: `dsh-desk/${RELEASE_ID}/bin/mac-arm64`,
    })
    expect(resolveDesktopUploadConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com/',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
      DOWNLOAD_TEST_COS_BUCKET: 'test-download-bucket',
    }, 'darwin', 'arm64')).toMatchObject({
      bucket: 'test-download-bucket',
      secretIdEnvName: 'DOWNLOAD_TEST_COS_SECRET_ID',
      secretKeyEnvName: 'DOWNLOAD_TEST_COS_SECRET_KEY',
    })
  })

  it.each([undefined, RELEASE_ID, 'unused-test-value'])('keeps production paths independent of test release ID %s', (id) => {
    expect(resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
      DOWNLOAD_TEST_RELEASE_ID: id,
    }, 'win32', 'x64')).toMatchObject({
      environment: 'production',
      target: 'win-x64',
      publicUrl: 'https://download.deepseek.com/dsh-desk/feeds/win-x64/',
      binaryKeyPrefix: 'dsh-desk/bin/win-x64',
    })
    expect(resolveDesktopUploadConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
      DOWNLOAD_PROD_COS_BUCKET: 'production-download-bucket',
    }, 'win32', 'x64')).toMatchObject({
      bucket: 'production-download-bucket',
      secretIdEnvName: 'DOWNLOAD_PROD_COS_SECRET_ID',
      secretKeyEnvName: 'DOWNLOAD_PROD_COS_SECRET_KEY',
    })
  })

  it('requires the selected deployment origin for packages and bucket only for uploads', () => {
    expect(() => resolveDesktopAutoUpdateConfig({}, 'darwin', 'arm64'))
      .toThrow(/DOWNLOAD_TEST_ORIGIN/u)
    expect(resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
    }, 'darwin', 'arm64').publicUrl).toContain('/mac-arm64/')
    expect(() => resolveDesktopUploadConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
    }, 'darwin', 'arm64')).toThrow(/DOWNLOAD_TEST_COS_BUCKET/u)
    expect(() => resolveDesktopUploadConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
    }, 'win32', 'x64')).toThrow(/DOWNLOAD_PROD_COS_BUCKET/u)
  })

  it('rejects a test download URL that is not an HTTPS origin', () => {
    expect(() => resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com/releases',
    }, 'darwin', 'arm64')).toThrow(/HTTPS origin without a path/u)
    expect(() => resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'http://desktop-updates.example.com',
    }, 'darwin', 'arm64')).toThrow(/HTTPS origin/u)
  })

  it('rejects unknown deployments and targets', () => {
    expect(() => resolveDesktopAutoUpdateEnvironment({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'staging',
    })).toThrow(/test.*production.*fife/u)
    expect(() => resolveDesktopAutoUpdateTarget('linux', 'x64')).toThrow(/unsupported target/u)
    expect(() => desktopBuildRecordFilename('linux-x64' as 'mac-arm64')).toThrow(/unsupported target/u)
  })

  it('resolves the fife deployment to one flat feed without COS prefixes', () => {
    const feed = 'https://github.com/example/deepseek-harness-fife/releases/latest/download'
    expect(resolveDesktopAutoUpdateEnvironment({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'fife' })).toBe('fife')
    expect(resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'fife', FIFE_DESKTOP_UPDATE_FEED_URL: feed,
    }, 'win32', 'x64')).toEqual({
      environment: 'fife', channel: 'nightly', target: 'win-x64', origin: 'https://github.com',
      publicUrl: `${feed}/`, keyPrefix: '', binaryKeyPrefix: '',
    })
    expect(() => resolveDesktopAutoUpdateConfig({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'fife' }, 'win32', 'x64'))
      .toThrow(/FIFE_DESKTOP_UPDATE_FEED_URL/u)
    expect(() => resolveDesktopUploadConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'fife', FIFE_DESKTOP_UPDATE_FEED_URL: feed,
    }, 'win32', 'x64')).toThrow(/GitHub Releases/u)
  })

  it.each(['http://github.com/example/fife/releases/latest/download',
    'https://github.com/example/fife/releases/latest/download?token=secret',
    'https://token@github.com/example/fife/releases/latest/download',
    'https://github.com/example/fife/releases/latest/download#fragment',
    'https://github.com',
    'github.com/example/fife/releases/latest/download',
    'releases/latest/download',
    ''])('rejects an unusable fife feed URL %j', (url) => {
    expect(() => resolveFifeFeedUrl({ FIFE_DESKTOP_UPDATE_FEED_URL: url })).toThrow(/FIFE_DESKTOP_UPDATE_FEED_URL/u)
  })

  it('keeps one trailing slash on a fife feed URL', () => {
    const feed = 'https://github.com/example/fife/releases/latest/download'
    expect(resolveFifeFeedUrl({ FIFE_DESKTOP_UPDATE_FEED_URL: `${feed}/` })).toBe(`${feed}/`)
    expect(resolveFifeFeedUrl({ FIFE_DESKTOP_UPDATE_FEED_URL: feed })).toBe(`${feed}/`)
  })

  it('uses Nightly metadata for stable and prerelease Desktop versions', () => {
    expect(desktopUpdateMetadataFilename('1.2.3', 'darwin')).toBe('nightly-mac.yml')
    expect(desktopUpdateMetadataFilename('1.2.3-alpha.4', 'darwin')).toBe('nightly-mac.yml')
    expect(desktopUpdateMetadataFilename('1.2.3-beta.2', 'win32')).toBe('nightly.yml')
    expect(() => desktopUpdateMetadataFilename('not-semver', 'darwin')).toThrow(/invalid Desktop version/u)
    expect(() => desktopUpdateMetadataFilename('1.2.3', 'linux')).toThrow(/unsupported metadata platform/u)
  })
})
