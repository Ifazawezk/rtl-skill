import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUT_PATHS, render, type SkillMeta, type Target } from './generate.ts';

/** Finds the package root (the folder with our package.json) from any module. */
export function packageRoot(from: string = fileURLToPath(import.meta.url)): string {
  let dir = dirname(from);
  for (;;) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === 'rtl-skill') return dir;
      } catch {
        // not ours, keep walking up
      }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Could not find the rtl-skill package root');
    dir = parent;
  }
}

export function readSource(root = packageRoot()): { guide: string; meta: SkillMeta } {
  const guide = readFileSync(join(root, 'skill-src', 'guide.md'), 'utf8');
  const meta = JSON.parse(readFileSync(join(root, 'skill-src', 'meta.json'), 'utf8')) as SkillMeta;
  return { guide, meta };
}

/** The generated text for a target. Falls back to the shipped file when the source is absent. */
export function generated(target: Target, root = packageRoot()): string {
  if (existsSync(join(root, 'skill-src', 'guide.md'))) {
    const { guide, meta } = readSource(root);
    return render(target, guide, meta);
  }
  return readFileSync(join(root, OUTPUT_PATHS[target]), 'utf8').replace(/\r\n/g, '\n');
}
