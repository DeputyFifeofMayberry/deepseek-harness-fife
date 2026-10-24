import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyWindowsAppUpdateConfig, verifyWindowsUpdateMetadata } from '../scripts/windows-app-update-config.mjs'

const roots: string[] = []
const feed = { publicUrl: 'https://github.com/example/fork/releases/latest/download/', channel: 'nightly' as const }
const config = [
  'provider: generic',
  'url: https://github.com/example/fork/releases/latest/download/',
  'channel: nightly',
  "updaterCacheDirName: '@example-updater'",
  '',
].join('\n')
const metadata = (version: string, installer: string) => [
  `version: ${version}`,
  'files:',
  `  - url: ${installer}`,
  '    sha512: E0CLL4Pn2su6QTAsgQMkzN65qk1ILMnSjm0jlmw3o8J4yLRPsWFs1mTqLfaAZ84oLp+uEeESghQWBNEzXvsN8Q==',
  '    size: 287853351',
  `path: ${installer}`,
  'sha512: E0CLL4Pn2su6QTAsgQMkzN65qk1ILMnSjm0jlmw3o8J4yLRPsWFs1mTqLfaAZ84oLp+uEeESghQWBNEzXvsN8Q==',
  "releaseDate: '2026-10-20T23:03:56.551Z'",
  '',
].join('\n')

async function fixture(): Promise<{ resources: string; metadataPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'desktop-windows-update-config-'))
  roots.push(root)
  const resources = join(root, 'win-unpacked', 'resources')
  await mkdir(resources, { recursive: true })
  await writeFile(join(resources, 'app-update.yml'), config)
  const metadataPath = join(root, 'nightly.yml')
  await writeFile(metadataPath, metadata('1.2.3', 'app-1.2.3.exe'))
  return { resources, metadataPath }
}

afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

describe('windows packaged update source', () => {
  it('accepts the expected feed and channel regardless of trailing slashes', async () => {
    const { resources } = await fixture()
    await expect(verifyWindowsAppUpdateConfig(resources, feed)).resolves.toBeUndefined()
    await expect(verifyWindowsAppUpdateConfig(resources,
      { publicUrl: 'https://github.com/example/fork/releases/latest/download', channel: 'nightly' })).resolves.toBeUndefined()
  })

  it('rejects a missing configuration without hiding the path', async () => {
    const { resources } = await fixture()
    await rm(join(resources, 'app-update.yml'))
    await expect(verifyWindowsAppUpdateConfig(resources, feed)).rejects.toThrow(/cannot read .*app-update\.yml/u)
  })

  it('rejects another feed, another channel, and another provider', async () => {
    const { resources } = await fixture()
    await writeFile(join(resources, 'app-update.yml'), config.replace('example/fork', 'deepseek-ai/deepseek-harness'))
    await expect(verifyWindowsAppUpdateConfig(resources, feed)).rejects.toThrow(/does not match/u)
    await writeFile(join(resources, 'app-update.yml'), config.replace('channel: nightly', 'channel: latest'))
    await expect(verifyWindowsAppUpdateConfig(resources, feed)).rejects.toThrow(/declares channel latest/u)
    await writeFile(join(resources, 'app-update.yml'), config.replace('provider: generic', 'provider: github'))
    await expect(verifyWindowsAppUpdateConfig(resources, feed)).rejects.toThrow(/generic provider/u)
  })

  it('rejects metadata that names another version, installer, or hash', async () => {
    const { metadataPath } = await fixture()
    const expected = { version: '1.2.3', installerName: 'app-1.2.3.exe' }
    await expect(verifyWindowsUpdateMetadata(metadataPath, expected)).resolves.toBeUndefined()
    await writeFile(metadataPath, metadata('1.2.4', 'app-1.2.4.exe'))
    await expect(verifyWindowsUpdateMetadata(metadataPath, expected)).rejects.toThrow(/declares version 1\.2\.4/u)
    await writeFile(metadataPath, metadata('1.2.3', 'app-1.2.3.exe').replace(/^ {4}sha512: .*$/mu, '    sha512:'))
    await expect(verifyWindowsUpdateMetadata(metadataPath, expected)).rejects.toThrow(/sha512/u)
    await writeFile(metadataPath, metadata('1.2.3', 'app-1.2.3.exe').replace('path: app-1.2.3.exe', 'path: app-1.2.2.exe'))
    await expect(verifyWindowsUpdateMetadata(metadataPath, expected)).rejects.toThrow(/names app-1\.2\.2\.exe/u)
    await expect(verifyWindowsUpdateMetadata(join(metadataPath, '..', 'absent.yml'), expected)).rejects.toThrow(/cannot read/u)
  })
})
