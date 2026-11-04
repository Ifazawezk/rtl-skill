// Rebuilds the images in docs/: the banner, the demo screenshots and the
// before/after comparison. Run it with: npm run docs
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { pngSize, screenshot } from '../src/annotate.ts';
import { checkPage } from '../src/check.ts';
import { formatText } from '../src/report.ts';
import { packageRoot } from '../src/skill/files.ts';

const root = packageRoot();
const docs = join(root, 'docs');
const demo = join(docs, 'demo');
const scratch = join(root, 'out', 'docs');
mkdirSync(demo, { recursive: true });
mkdirSync(scratch, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 420 } });

await page.goto(pathToFileURL(join(docs, 'banner.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready.then(() => true));
await page.screenshot({ path: join(docs, 'banner.png') });

process.chdir(root);
for (const name of ['buggy', 'fixed']) {
  const target = relative(root, join(root, 'demo', name, 'index.html')).replace(/\\/g, '/');
  const outDir = join(scratch, name);
  const report = await checkPage(target, { browser, outDir });
  report.screenshots = {};
  writeFileSync(join(demo, `${name}-report.txt`), formatText(report).replace(/, \d+ ms$/m, ''));
  copyFileSync(join(outDir, 'annotated.png'), join(demo, `${name}-annotated.png`));
  copyFileSync(join(outDir, 'mirror.png'), join(demo, `${name}-mirror.png`));
}

// Before and after: the first screen a visitor sees, not annotated. A plain viewport
// capture is shifted when an RTL page overflows left, so crop the full page instead.
const shots: Record<string, string> = {};
const sharp = await browser.newContext({ viewport: { width: 1280, height: 680 }, deviceScaleFactor: 2 });
const shotPage = await sharp.newPage();
const panelWidth = 636;
const scale = panelWidth / 1280;
for (const name of ['buggy', 'fixed']) {
  await shotPage.goto(pathToFileURL(join(root, 'demo', name, 'index.html')).href);
  const shot = await screenshot(shotPage);
  const width = (pngSize(shot.png).width / 2) * scale;
  shots[name] = `<div class="panel"><img style="left:${shot.originX * scale}px;width:${width}px" src="data:image/png;base64,${shot.png.toString('base64')}"></div>`;
}
const compare = await sharp.newPage();
await compare.setViewportSize({ width: 1320, height: 400 });
await compare.setContent(`<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:16px;background:#0b1220;color:#f8fafc;font:700 20px Arial,sans-serif}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:1288px}
  .panel{position:relative;width:${panelWidth}px;height:${680 * scale}px;overflow:hidden;border-radius:8px;background:#fff}
  img{position:absolute;top:0;display:block}
  p{margin:0 0 10px}.b{color:#fda4af}.g2{color:#5eead4}</style>
  <div class="g"><div><p class="b">Before: common RTL bugs on one page</p>${shots.buggy}</div>
  <div><p class="g2">After: the same page, fixed</p>${shots.fixed}</div></div>`);
await compare.screenshot({ path: join(docs, 'before-after.png'), fullPage: true });
await browser.close();

// Letter-spacing on Arabic in the two engines, the one bug Chromium hides.
const letters: Record<string, string> = {};
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  const p = await b.newPage({ viewport: { width: 520, height: 90 } });
  await p.setContent(`<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;padding:18px;background:#fff;font:36px Arial,sans-serif;letter-spacing:6px;text-align:center">العروض الجديدة</body></html>`);
  letters[engine.name()] = (await p.screenshot()).toString('base64');
  await b.close();
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 150 } });
await p.setContent(`<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:16px;background:#0b1220;color:#f8fafc;font:700 18px Arial,sans-serif}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{display:block;width:100%;border-radius:8px}p{margin:0 0 8px}</style>
  <div class="g"><div><p>Chromium ignores it</p><img src="data:image/png;base64,${letters.chromium}"></div>
  <div><p>WebKit (Safari) breaks the letters apart</p><img src="data:image/png;base64,${letters.webkit}"></div></div>`);
await p.screenshot({ path: join(docs, 'letter-spacing.png'), fullPage: true });
await b.close();

rmSync(scratch, { recursive: true, force: true });
console.log('docs images written', readFileSync(join(demo, 'buggy-report.txt'), 'utf8').trim().split('\n').slice(-1)[0]);
