// Loads the in-page runtime. The published build ships dist/page-runtime.js;
// from a source checkout we bundle src/page/index.ts with esbuild on first use.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageRoot } from './skill/files.ts';

let cached: Promise<string> | undefined;

export function runtimeSource(): Promise<string> {
  cached ??= load();
  return cached;
}

async function load(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const built = join(here, 'page-runtime.js');
  if (existsSync(built)) return readFileSync(built, 'utf8');
  const entry = join(packageRoot(), 'src', 'page', 'index.ts');
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}
