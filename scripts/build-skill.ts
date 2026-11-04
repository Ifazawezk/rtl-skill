// Regenerates skills/rtl/SKILL.md, cursor/rtl.mdc and codex/AGENTS.md.
//   node scripts/build-skill.ts          write the files
//   node scripts/build-skill.ts --check  exit 1 if a file is out of date
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OUTPUT_PATHS, TARGETS, render } from '../src/skill/generate.ts';
import { packageRoot, readSource } from '../src/skill/files.ts';

const root = packageRoot();
const check = process.argv.includes('--check');
const { guide, meta } = readSource(root);
let stale = 0;

for (const target of TARGETS) {
  const file = join(root, OUTPUT_PATHS[target]);
  const text = render(target, guide, meta);
  const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (check) {
    if (current !== text) {
      stale++;
      console.error(`out of date: ${OUTPUT_PATHS[target]}`);
    }
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(`wrote ${OUTPUT_PATHS[target]} (${Buffer.byteLength(text)} bytes)`);
}

if (check && stale) {
  console.error('Run "npm run skill" and commit the result.');
  process.exit(1);
}
if (check) console.log('skill files are up to date');
