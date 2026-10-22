/**
 * Ad-hoc M6 evidence: parse every edited fork profile overlay through the
 * product's own patch loader and report the rows that matter.
 * @module m6-overlays
 */

import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'

const files = [
  'C:/Users/barne/.dsh/profiles/desktop/cordis.patch.yml',
  'C:/Users/barne/.dsh/profiles/web/cordis.patch.yml',
  'Y:/deepseek-harness_fife/apps/desktop/.desktop-build/development/home/profiles/desktop/cordis.patch.yml',
]

type Row = { id?: string; config?: unknown }

function flatten(rows: readonly Row[]): Row[] {
  return rows.flatMap((row) => {
    const nested = Array.isArray(row.config) ? flatten(row.config as Row[]) : []
    return [row, ...nested]
  })
}

for (const file of files) {
  const rows = loadOverlayPatches('dsh', file)
  const ids = rows.map(row => row.id)
  const policy = rows.find(row => row.id === 'effort-policy')
  const preset = rows.find(row => row.id === 'preset-standard')
  const plugins = flatten((preset?.config as { plugins?: Row[] } | undefined)?.plugins ?? [])
  const flagged = plugins
    .filter(plugin => (plugin.config as { effortPolicy?: boolean } | undefined)?.effortPolicy === true)
    .map(plugin => plugin.id)
  process.stdout.write([
    file,
    `  rows: ${String(rows.length)}`,
    `  ids: ${ids.join(', ')}`,
    `  effort-policy: enabled=${String((policy?.config as { enabled?: boolean } | undefined)?.enabled)}`
      + ` baseLevel=${String((policy?.config as { baseLevel?: string } | undefined)?.baseLevel)}`,
    `  preset-standard entries: ${String(plugins.length)}; effortPolicy: ${flagged.join(', ')}`,
  ].join('\n') + '\n')
}
