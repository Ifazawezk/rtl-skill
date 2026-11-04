// Bundles the CLI, the library entry and the in-page runtime into dist/.
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: {
    'rtl-check': 'src/bin/rtl-check.ts',
    'rtl-skill': 'src/bin/rtl-skill.ts',
    index: 'src/index.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  logLevel: 'info',
});

await build({
  entryPoints: { 'page-runtime': 'src/page/index.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
});
