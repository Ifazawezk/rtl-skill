// Reads the fixture pages and the expectations stored in their <meta> tags.
//   <meta name="rtl-check-expect" content="bidi-order">        rules that must fire
//   <meta name="rtl-check-allow" content="mirror-mismatch">    rules that may also fire
//   <meta name="rtl-check-viewport" content="390x844">         viewport to use
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { RuleId } from '../src/rules.ts';

export interface Fixture {
  /** Path relative to the repository root, with forward slashes. */
  path: string;
  kind: 'bug' | 'fixed' | 'clean';
  expect: RuleId[];
  allow: RuleId[];
  viewport?: { width: number; height: number };
}

function meta(html: string, name: string): string | null {
  const m = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i').exec(html);
  return m ? m[1] : null;
}

const list = (s: string | null) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean) as RuleId[];

export function loadFixtures(root: string): Fixture[] {
  const dir = join(root, 'fixtures');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) files.push(full);
    }
  };
  walk(dir);
  return files.sort().map((file) => {
    const html = readFileSync(file, 'utf8');
    const path = relative(root, file).replace(/\\/g, '/');
    const kind = file.endsWith('.bug.html') ? 'bug' : file.endsWith('.fixed.html') ? 'fixed' : 'clean';
    const vp = meta(html, 'rtl-check-viewport');
    const m = vp ? /^(\d+)x(\d+)$/.exec(vp) : null;
    return {
      path,
      kind,
      expect: list(meta(html, 'rtl-check-expect')),
      allow: list(meta(html, 'rtl-check-allow')),
      viewport: m ? { width: Number(m[1]), height: Number(m[2]) } : undefined,
    };
  });
}
