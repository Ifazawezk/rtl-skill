import { join } from 'node:path';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkPage, launchBrowser } from '../src/check.ts';
import { packageRoot } from '../src/skill/files.ts';
import { loadFixtures } from '../scripts/fixtures.ts';

const root = packageRoot();
const fixtures = loadFixtures(root);
let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

describe('fixture pages', () => {
  it('every bug page has a fixed twin and states what it expects', () => {
    const paths = new Set(fixtures.map((f) => f.path));
    for (const f of fixtures.filter((x) => x.kind === 'bug')) {
      expect(f.expect.length, f.path).toBeGreaterThan(0);
      expect(paths.has(f.path.replace('.bug.html', '.fixed.html')), f.path).toBe(true);
    }
    for (const f of fixtures.filter((x) => x.kind !== 'bug')) expect(f.expect, f.path).toEqual([]);
  });

  it.each(fixtures.map((f) => [f.path, f] as const))('%s', async (_name, fixture) => {
    const report = await checkPage(join(root, fixture.path), { browser, viewport: fixture.viewport });
    const found = new Set(report.findings.map((f) => f.rule));
    const summary = report.findings.map((f) => `${f.rule} ${f.selector}: ${f.message}`).join('\n');
    for (const rule of fixture.expect) expect(found.has(rule), `missing ${rule}\n${summary}`).toBe(true);
    const allowed = new Set([...fixture.expect, ...fixture.allow]);
    for (const rule of found) expect(allowed.has(rule), `unexpected ${rule}\n${summary}`).toBe(true);
  });
});
