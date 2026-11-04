import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { pngSize } from '../src/annotate.ts';
import { main, parseViewport, slug, type CliIO } from '../src/cli.ts';
import { formatText } from '../src/report.ts';
import { packageRoot } from '../src/skill/files.ts';
import type { Report } from '../src/types.ts';

const root = packageRoot();
const fixture = (name: string) => join(root, 'fixtures', name);
const temp = mkdtempSync(join(tmpdir(), 'rtl-skill-'));

afterAll(() => rmSync(temp, { recursive: true, force: true }));

async function run(args: string[], bin = 'rtl-check') {
  let out = '';
  let err = '';
  const io: CliIO = { out: (s) => (out += s), err: (s) => (err += s), isTTY: false };
  const code = await main(args, io, bin);
  return { code, out, err };
}

describe('exit codes', () => {
  it('is 1 when a page has errors', async () => {
    const { code, out } = await run([fixture('bidi-order/phone-in-sentence.bug.html')]);
    expect(code).toBe(1);
    expect(out).toContain('renders as "1234 5555 974+"');
  });

  it('is 0 on a clean page', async () => {
    const { code, out } = await run([fixture('bidi-order/phone-in-sentence.fixed.html')]);
    expect(code).toBe(0);
    expect(out).toContain('no RTL problems found');
  });

  it('treats warnings as passing unless --fail-on warning is set', async () => {
    const page = fixture('physical-css/badge-position.bug.html');
    expect((await run([page])).code).toBe(0);
    expect((await run([page, '--fail-on', 'warning'])).code).toBe(1);
  });

  it('never fails with --fail-on never', async () => {
    expect((await run([fixture('dir-attribute/no-dir.bug.html'), '--fail-on', 'never'])).code).toBe(0);
  });

  it.each([
    [['--rules', 'nope', 'x.html']],
    [['--viewport', 'big', 'x.html']],
    [['--fail-on', 'sometimes', 'x.html']],
    [['--no-such-flag', 'x.html']],
    [[]],
  ])('is 2 for bad usage: %j', async (args) => {
    expect((await run(args)).code).toBe(2);
  });

  it('is 2 when the file does not exist', async () => {
    const { code, err } = await run([join(temp, 'missing.html')]);
    expect(code).toBe(2);
    expect(err).toContain('No such file');
  });
});

describe('options', () => {
  it('--json prints a report with findings and links', async () => {
    const { out } = await run([fixture('physical-css/badge-position.bug.html'), '--json']);
    const report = JSON.parse(out) as Report;
    expect(report.summary).toEqual({ errors: 0, warnings: 1 });
    expect(report.findings[0]).toMatchObject({ id: 1, rule: 'physical-css', selector: 'span.badge' });
    expect(report.findings[0].docs).toMatch(/SKILL\.md#logical-css-properties$/);
    expect(report.findings[0].evidence?.at).toMatch(/badge-position\.bug\.html:\d+$/);
    expect(report.findings[0].box?.width).toBeGreaterThan(0);
  });

  it('--rules and --skip limit the checks', async () => {
    const page = fixture('viewport-overflow/offcanvas-drawer.bug.html');
    const only = JSON.parse((await run([page, '--json', '--rules', 'physical-css'])).out) as Report;
    expect(new Set(only.findings.map((f) => f.rule))).toEqual(new Set(['physical-css']));
    const skip = JSON.parse((await run([page, '--json', '--skip', 'physical-css'])).out) as Report;
    expect(new Set(skip.findings.map((f) => f.rule))).toEqual(new Set(['viewport-overflow']));
  });

  it('skips RTL-only rules on an LTR page and says why', async () => {
    const { out } = await run([fixture('dir-attribute/no-dir.bug.html'), '--json']);
    const report = JSON.parse(out) as Report;
    expect(report.skipped.map((s) => s.rule)).toContain('physical-css');
    expect(report.skipped[0].reason).toContain('--force-rtl');
  });

  it('--force-rtl checks an LTR page as RTL', async () => {
    const { out } = await run([fixture('dir-attribute/no-dir.bug.html'), '--force-rtl', '--json']);
    const report = JSON.parse(out) as Report;
    expect(report.page.dir).toBe('rtl');
    expect(report.skipped).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it('rates text-align: left as an error only when the alignment shows', async () => {
    const arabic = JSON.parse((await run([fixture('physical-css/text-align-left.bug.html'), '--json'])).out) as Report;
    const latin = JSON.parse((await run([fixture('physical-css/text-align-latin.bug.html'), '--json'])).out) as Report;
    expect(arabic.findings[0].severity).toBe('error');
    expect(latin.findings[0].severity).toBe('warning');
  });

  it('reports a row that drifts as one finding', async () => {
    const { out } = await run([fixture('mirror-mismatch/row-drift.bug.html'), '--json']);
    const report = JSON.parse(out) as Report;
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].evidence?.boxes).toMatch(/^\d+ boxes/);
  });

  it('--mobile uses a phone viewport', async () => {
    const page = fixture('viewport-overflow/fixed-width-card.bug.html');
    const desktop = JSON.parse((await run([page, '--json'])).out) as Report;
    const phone = JSON.parse((await run([page, '--json', '--mobile'])).out) as Report;
    expect(desktop.findings).toEqual([]);
    expect(phone.page.viewport.width).toBe(390);
    expect(phone.findings[0].rule).toBe('viewport-overflow');
  });

  it('--out writes the report and the screenshots', async () => {
    const dir = join(temp, 'single');
    await run([fixture('physical-css/badge-position.bug.html'), '--out', dir]);
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as Report;
    expect(report.screenshots.annotated).toBe(join(dir, 'annotated.png'));
    for (const name of ['annotated.png', 'mirror.png']) {
      expect(readFileSync(join(dir, name)).subarray(1, 4).toString()).toBe('PNG');
    }
  });

  it('--out keeps the whole page when an RTL page overflows to the left', async () => {
    const dir = join(temp, 'overflow');
    await run([fixture('viewport-overflow/offcanvas-drawer.bug.html'), '--out', dir]);
    expect(pngSize(readFileSync(join(dir, 'annotated.png'))).width).toBe(1580);
  });

  it('--out gives each target its own folder', async () => {
    const dir = join(temp, 'many');
    await run([fixture('bidi-order/tel-link.bug.html'), fixture('bidi-order/tel-link.fixed.html'), '--out', dir]);
    const report = JSON.parse(readFileSync(join(dir, slug(fixture('bidi-order/tel-link.bug.html')), 'report.json'), 'utf8'));
    expect(report.findings[0].rule).toBe('bidi-order');
    expect(existsSync(join(dir, slug(fixture('bidi-order/tel-link.fixed.html'))))).toBe(true);
  });
});

describe('rtl-skill command', () => {
  it('lists rules', async () => {
    const { code, out } = await run(['rules'], 'rtl-skill');
    expect(code).toBe(0);
    expect(out).toContain('bidi-order');
    expect(out.trim().split('\n')).toHaveLength(10);
  });

  it('runs check as a subcommand', async () => {
    expect((await run(['check', fixture('bidi-order/tel-link.bug.html')], 'rtl-skill')).code).toBe(1);
  });
});

describe('helpers', () => {
  it('parses viewports', () => {
    expect(parseViewport('390x844')).toEqual({ width: 390, height: 844 });
    expect(() => parseViewport('390')).toThrow(/--viewport/);
  });

  it('builds folder names from targets', () => {
    expect(slug('https://example.qa/ar/shop?x=1')).toBe('example.qa-ar-shop-x-1');
    expect(slug('pages/home.html')).toBe('pages-home');
  });

  it('formats a clean report without color codes', () => {
    const report: Report = {
      target: 'a.html',
      page: { url: 'file:///a.html', title: '', dir: 'rtl', lang: 'ar', direction: 'rtl', rtlLetters: 30, ltrLetters: 0, viewport: { width: 1280, height: 800 }, elements: 3 },
      findings: [],
      summary: { errors: 0, warnings: 0 },
      skipped: [],
      screenshots: {},
      durationMs: 5,
    };
    const text = formatText(report);
    expect(text).toContain('0 errors, 0 warnings, no RTL problems found');
    expect(text).not.toContain('\x1b[');
  });
});
