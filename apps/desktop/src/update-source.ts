/** Resolve whether this process has a packaged Electron update source. */

import { join } from 'node:path'
import type { DesktopUpdateChannel } from './update-channel.ts'

/**
 * Category that decides whether a check can reach a feed.
 *
 * A development run and a packaged build without a configuration file are both
 * expected states that must never be reported as a failed check.
 */
export type DesktopUpdateSource =
  | { readonly kind: 'packaged'; readonly configPath: string; readonly appPath: string }
  | { readonly kind: 'development'; readonly appPath: string }
  | { readonly kind: 'missing-configuration'; readonly configPath: string; readonly appPath: string }

/** Process facts required to resolve the source. */
export interface DesktopUpdateSourceInputs {
  readonly isPackaged: boolean
  readonly resourcesPath: string
  readonly appPath: string
  readonly exists: (path: string) => boolean
}

/** Installed identity printed beside a resolved source. */
export interface DesktopUpdateSourceContext {
  readonly channel: DesktopUpdateChannel
  readonly version: string
}

/** Packaged updater configuration filename written by electron-builder. */
const CONFIG_FILENAME = 'app-update.yml'

/**
 * Resolve the source from process facts without touching Electron's updater.
 * @param inputs - Packaging state, the resources and application paths, and a path-existence probe.
 * @returns The packaged source with its configuration path, or why no feed can be read.
 */
export function resolveDesktopUpdateSource(inputs: DesktopUpdateSourceInputs): DesktopUpdateSource {
  if (!inputs.isPackaged) return { kind: 'development', appPath: inputs.appPath }
  const configPath = join(inputs.resourcesPath, CONFIG_FILENAME)
  return inputs.exists(configPath)
    ? { kind: 'packaged', configPath, appPath: inputs.appPath }
    : { kind: 'missing-configuration', configPath, appPath: inputs.appPath }
}

/**
 * Describe one resolved source for diagnostics; it never contains credentials or request data.
 * @param source - Resolved update source.
 * @param context - Installed channel and version that interpret the source.
 * @returns One line naming the source kind, channel, version, configuration path when one applies, and application path.
 */
export function describeDesktopUpdateSource(source: DesktopUpdateSource, context: DesktopUpdateSourceContext): string {
  const fields = [`source=${source.kind}`, `channel=${context.channel}`, `version=${context.version}`]
  if ('configPath' in source) fields.push(`config=${source.configPath}`)
  fields.push(`app=${source.appPath}`)
  return `desktop update: ${fields.join(' ')}`
}
