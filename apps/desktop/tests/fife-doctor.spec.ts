import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  feedRepository,
  parseUpdateMetadata,
  pendingUpdateInstaller,
  readInstalledUpdateConfig,
  windowsMetadataFilename,
} from '../scripts/fife-doctor-lib.mjs'

const roots: string[] = []
const config = [
  'provider: generic',
  'url: https://github.com/example/fork/releases/latest/download/',
  'channel: nightly',
  "updaterCacheDirName: '@example-updater'",
  '',
].join('\n')
const metadata = [
  'version: 1.2.3.20261020.1',
  'files:',
  '  - url: app-1.2.3.20261020.1.exe',
  '    sha512: E0CLL4Pn2su6QTAsgQMkzN65qk1ILMnSjm0jlmw3o8J4yLRPsWFs1mTqLfaAZ84oLp+uEeESghQWBNEzXvsN8Q==',
  'path: app-1.2.3.20261020.1.exe',
  '',
].join('\n')

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'desktop-fife-doctor-'))
  roots.push(root)
  await mkdir(join(root, 'resources'), { recursive: true })
  await writeFile(join(root, 'resources', 'app-update.yml'), config)
  return root
}

afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

describe('installed feed facts', () => {
  it('reads the packaged generic feed and its cache directory', async () => {
    const root = await fixture()
    await expect(readInstalledUpdateConfig(join(root, 'resources'))).resolves.toEqual({
      provider: 'generic',
      url: 'https://github.com/example/fork/releases/latest/download/',
      channel: 'nightly',
      updaterCacheDirName: '@example-updater',
    })
  })

  it('names the unreadable path and rejects an incomplete feed', async () => {
    const root = await fixture()
    await expect(readInstalledUpdateConfig(join(root, 'absent'))).rejects.toThrow(/cannot read .*app-update\.yml/u)
    await writeFile(join(root, 'resources', 'app-update.yml'), config.replace('provider: generic', 'provider: github'))
    await expect(readInstalledUpdateConfig(join(root, 'resources'))).rejects.toThrow(/generic provider/u)
    await writeFile(join(root, 'resources', 'app-update.yml'), config.replace(/^url: .*$/mu, 'url: '))
    await expect(readInstalledUpdateConfig(join(root, 'resources'))).rejects.toThrow(/no feed URL/u)
    await writeFile(join(root, 'resources', 'app-update.yml'), config.replace(/^channel: .*$/mu, 'channel: 0'))
    await expect(readInstalledUpdateConfig(join(root, 'resources'))).rejects.toThrow(/no channel/u)
    await writeFile(join(root, 'resources', 'app-update.yml'), config.replace(/^updaterCacheDirName: .*$/mu, ''))
    await expect(readInstalledUpdateConfig(join(root, 'resources'))).rejects.toThrow(/no updater cache directory/u)
  })

  it('requests the channel metadata filename for Windows', () => {
    expect(windowsMetadataFilename('nightly')).toBe('nightly.yml')
    expect(windowsMetadataFilename('latest')).toBe('latest.yml')
  })
})

describe('feed repository and metadata', () => {
  it('recognizes only GitHub Releases feeds', () => {
    expect(feedRepository('https://github.com/example/fork/releases/latest/download/')).toBe('example/fork')
    expect(feedRepository('https://download.example.com/dsh-desk/feeds/win-x64/')).toBeUndefined()
    expect(feedRepository('not a url')).toBeUndefined()
    expect(feedRepository('https://github.com/example/fork/archive/main.zip')).toBeUndefined()
  })

  it('reads the offered version and installer, rejecting incomplete documents', () => {
    expect(parseUpdateMetadata(metadata)).toEqual({
      version: '1.2.3.20261020.1', fileName: 'app-1.2.3.20261020.1.exe',
    })
    expect(() => parseUpdateMetadata(metadata.replace(/^version: .*$/mu, ''))).toThrow(/no version/u)
    expect(() => parseUpdateMetadata(metadata.replace(/^path: .*$/mu, ''))).toThrow(/no installer path/u)
    expect(() => parseUpdateMetadata(metadata.replace(/^files:/mu, 'others:'))).toThrow(/lists no file/u)
    expect(() => parseUpdateMetadata('[]')).toThrow(/must contain an object/u)
  })
})

describe('pending update evidence', () => {
  it('reports the downloaded installer or nothing pending', async () => {
    const root = await fixture()
    const cache = join(root, 'cache')
    await expect(pendingUpdateInstaller(cache)).resolves.toBeUndefined()
    await mkdir(join(cache, 'pending'), { recursive: true })
    await writeFile(join(cache, 'pending', 'update-info.json'),
      JSON.stringify({ fileName: 'app-1.2.3.exe', sha512: 'hash' }))
    await expect(pendingUpdateInstaller(cache)).resolves.toBe('app-1.2.3.exe')
    await writeFile(join(cache, 'pending', 'update-info.json'), '{}')
    await expect(pendingUpdateInstaller(cache)).rejects.toThrow(/does not name a downloaded installer/u)
  })
})
