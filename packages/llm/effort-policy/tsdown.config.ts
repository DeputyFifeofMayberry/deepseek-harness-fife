import { defineConfig } from 'tsdown'

/** Build the package entry and the portable `./core` entry as separate bundles. */
export default defineConfig([
  {
    entry: ['lib/types/index.js', 'lib/types/core.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
