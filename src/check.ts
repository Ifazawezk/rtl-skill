// Runs the checks against one page in headless Chromium.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { renderMirror, screenshot, type Shot } from './annotate.ts';
import { RULES, RULE_IDS, type RuleId } from './rules.ts';
import { locateFindings } from './locate.ts';
import { runtimeSource } from './runtime.ts';
import type { Finding, RawFinding, Report } from './types.ts';

export const DOCS_BASE = 'https://github.com/Ifazawezk/rtl-skill/blob/main/skills/rtl/SKILL.md';

export interface CheckOptions {
  /** Only run these rules. Empty or missing means all rules. */
  rules?: RuleId[];
  /** Rules to leave out. */
  skip?: RuleId[];
  viewport?: { width: number; height: number };
  /** Set dir="rtl" (and lang) on <html> before checking, for apps that start LTR. */
  forceRtl?: boolean;
  /** Language to set together with forceRtl. */
  lang?: string;
  /** Wait for this selector after load. */
  waitFor?: string;
  /** Extra wait in milliseconds after load. */
  waitMs?: number;
  /** How long to wait for the page to load, in milliseconds. */
  timeoutMs?: number;
  /** Write report.json, annotated.png and mirror.png to this folder. */
  outDir?: string;
  /** Reuse a running browser instead of launching one. */
  browser?: Browser;
}

export const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
export const DEFAULT_TIMEOUT = 30_000;

/** Rules that compare the RTL render with an LTR render of the same page. */
const LAYOUT_RULES: RuleId[] = ['physical-css', 'mirror-mismatch'];

/** Rules that only mean something when the page renders right to left. */
const RTL_ONLY_RULES: RuleId[] = [...LAYOUT_RULES, 'bidi-order', 'ltr-input', 'icon-mirroring'];

/** Turns a file path or URL into a URL Chromium can open. */
export function resolveTarget(target: string): string {
  if (/^(https?|file|data|about):/i.test(target)) return target;
  if (/^localhost(:\d+)?(\/|$)/i.test(target)) return `http://${target}`;
  const abs = resolve(target);
  if (!existsSync(abs)) throw new Error(`No such file: ${target}`);
  return pathToFileURL(abs).href;
}

export function selectedRules(options: Pick<CheckOptions, 'rules' | 'skip'>): RuleId[] {
  const base = options.rules && options.rules.length ? options.rules : [...RULE_IDS];
  return base.filter((id) => !(options.skip ?? []).includes(id));
}

export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
      throw new Error('Chromium is not installed for Playwright. Run: npx playwright install chromium');
    }
    throw err;
  }
}

export async function checkPage(target: string, options: CheckOptions = {}): Promise<Report> {
  const started = Date.now();
  const browser = options.browser ?? (await launchBrowser());
  const context = await browser.newContext({
    viewport: options.viewport ?? DEFAULT_VIEWPORT,
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    const url = resolveTarget(target);
    const notes: string[] = [];
    const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT;
    await page.goto(url, { waitUntil: 'commit', timeout });
    // Ads and trackers can hold these events back forever. Check what rendered instead of giving up.
    const deadline = Date.now() + timeout;
    try {
      await page.waitForLoadState('domcontentloaded', { timeout });
      await page.waitForLoadState('load', { timeout: Math.max(1, deadline - Date.now()) });
    } catch {
      notes.push(`The page did not finish loading within ${timeout} ms, so this checks what had rendered by then.`);
    }
    if (options.waitFor) await page.waitForSelector(options.waitFor);
    if (options.waitMs) await page.waitForTimeout(options.waitMs);
    await settle(page, options);
    await page.addScriptTag({ content: await runtimeSource() });

    const rules = selectedRules(options);
    const unreadable = await readBlockedSheets(page);
    if (unreadable.length) {
      notes.push(`${unreadable.length} stylesheet(s) could not be read, so physical-css cannot name rules from them: ${unreadable.join(', ')}`);
    }
    const info = await page.evaluate(() => window.__rtlCheck.info());
    const raw: RawFinding[] = await page.evaluate((r) => window.__rtlCheck.checks(r), rules);
    const skipped: Report['skipped'] = [];
    let rtlShot: Shot | undefined;
    let ltrShot: Shot | undefined;

    if (info.direction !== 'rtl') {
      for (const rule of rules.filter((r) => RTL_ONLY_RULES.includes(r))) {
        skipped.push({ rule, reason: 'the page does not render right to left (use --force-rtl to check it as RTL)' });
      }
    }
    const layoutRules = rules.filter((r) => LAYOUT_RULES.includes(r));
    if (layoutRules.length && info.direction === 'rtl') {
      await page.evaluate(() => window.__rtlCheck.snapshotRtl());
      if (options.outDir) rtlShot = await screenshot(page);
      await page.evaluate(() => window.__rtlCheck.flip());
      await page.evaluate(() => window.__rtlCheck.snapshotLtr());
      if (options.outDir) ltrShot = await screenshot(page);
      await page.evaluate(() => window.__rtlCheck.unflip());
      raw.push(...(await page.evaluate((r) => window.__rtlCheck.layoutChecks(r), layoutRules)));
    }

    const findings = locateFindings(finalize(raw), url);
    const report: Report = {
      target,
      page: { url, ...info },
      findings,
      summary: {
        errors: findings.filter((f) => f.severity === 'error').length,
        warnings: findings.filter((f) => f.severity === 'warning').length,
      },
      skipped,
      notes,
      screenshots: {},
      durationMs: 0,
    };

    if (options.outDir) {
      mkdirSync(options.outDir, { recursive: true });
      await page.evaluate((f) => window.__rtlCheck.drawOverlay(f), findings);
      report.screenshots.annotated = join(options.outDir, 'annotated.png');
      writeFileSync(report.screenshots.annotated, (await screenshot(page)).png);
      await page.evaluate(() => window.__rtlCheck.clearOverlay());
      if (rtlShot && ltrShot) {
        report.screenshots.mirror = join(options.outDir, 'mirror.png');
        writeFileSync(report.screenshots.mirror, await renderMirror(context, rtlShot, ltrShot, findings, info.viewport.width));
      }
    }
    report.durationMs = Date.now() - started;
    if (options.outDir) writeFileSync(join(options.outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally {
    await context.close();
    if (!options.browser) await browser.close();
  }
}

/**
 * Browsers hide the rules of cross-origin stylesheets from page scripts, and
 * every file:// stylesheet counts as cross-origin. Node fetches those itself
 * and hands the text to the page. Returns the ones it could not get.
 */
async function readBlockedSheets(page: Page): Promise<string[]> {
  const unreadable: string[] = [];
  for (const href of await page.evaluate(() => window.__rtlCheck.blockedSheets())) {
    try {
      let css: string;
      if (href.startsWith('file:')) {
        css = readFileSync(fileURLToPath(href), 'utf8');
      } else {
        const response = await page.context().request.get(href, { timeout: 10_000 });
        if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
        css = await response.text();
      }
      await page.evaluate(([h, c]) => window.__rtlCheck.addSheetCopy(h, c), [href, css]);
    } catch {
      unreadable.push(href);
    }
  }
  return unreadable;
}

/** Waits for fonts, stops transitions and applies --force-rtl. */
async function settle(page: Page, options: CheckOptions): Promise<void> {
  await page.evaluate(() =>
    Promise.race([document.fonts.ready.then(() => true), new Promise((done) => setTimeout(() => done(false), 3000))]),
  );
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation-play-state:paused!important;scroll-behavior:auto!important;caret-color:transparent!important}',
  });
  if (options.forceRtl) {
    await page.evaluate((lang) => {
      document.documentElement.setAttribute('dir', 'rtl');
      if (lang) document.documentElement.setAttribute('lang', lang);
    }, options.lang ?? 'ar');
  }
}

/** Sorts findings (errors first, then top to bottom) and numbers them. */
export function finalize(raw: RawFinding[]): Finding[] {
  const rank = (f: RawFinding) => (f.severity === 'error' ? 0 : 1);
  return [...raw]
    .sort((a, b) => rank(a) - rank(b) || (a.box?.y ?? -1) - (b.box?.y ?? -1) || (a.box?.x ?? 0) - (b.box?.x ?? 0))
    .map((f, i) => ({ ...f, id: i + 1, docs: `${DOCS_BASE}#${RULES[f.rule].skillSection}` }));
}
