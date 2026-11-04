// Screenshot output. The annotated image comes from an overlay drawn in the
// page; the mirror image places the RTL render next to the flipped LTR render.
import type { BrowserContext, Page } from 'playwright';
import type { Finding } from './types.ts';

/** Very tall pages are cut here, so a screenshot stays a readable size. */
const MAX_HEIGHT = 4000;

export interface Shot {
  png: Buffer;
  /**
   * Document x of the left edge of the image. In an RTL page that overflows,
   * the scrollable area starts left of 0, and a full-page image starts there.
   */
  originX: number;
}

export async function screenshot(page: Page): Promise<Shot> {
  const size = await page.evaluate(() => {
    const html = document.documentElement;
    const rtl = getComputedStyle(html).direction === 'rtl' || (document.body && getComputedStyle(document.body).direction === 'rtl');
    return {
      width: html.scrollWidth,
      height: Math.max(html.scrollHeight, window.innerHeight),
      originX: rtl ? html.clientWidth - html.scrollWidth : 0,
    };
  });
  const png = await page.screenshot({
    fullPage: true,
    clip: { x: 0, y: 0, width: size.width, height: Math.min(size.height, MAX_HEIGHT) },
  });
  return { png, originX: size.originX };
}

/** Reads the pixel size from a PNG header. */
export function pngSize(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export function mirrorHtml(rtl: Shot, ltr: Shot, findings: Finding[], width: number): string {
  const color = (f: Finding) => (f.severity === 'error' ? '#dc2626' : '#d97706');
  const box = (f: Finding, x: number, y: number, w: number, h: number) =>
    `<div class="box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${color(f)}"><b style="background:${color(f)}">${f.id}</b></div>`;
  const layout = findings.filter((f) => f.box && f.ltrBox);
  const rtlBoxes = layout.map((f) => box(f, f.box!.x, f.box!.y, f.box!.width, f.box!.height)).join('');
  const ltrBoxes = layout
    .map((f) => box(f, width - f.ltrBox!.x - f.ltrBox!.width, f.ltrBox!.y, f.ltrBox!.width, f.ltrBox!.height))
    .join('');
  const rtlSize = pngSize(rtl.png);
  const ltrSize = pngSize(ltr.png);
  const height = Math.max(rtlSize.height, ltrSize.height);
  const src = (s: Shot) => `data:image/png;base64,${s.png.toString('base64')}`;
  // Both images are placed so that document x 0 lines up with the panel, cutting off any overflow.
  const rtlImg = `<img src="${src(rtl)}" style="left:${rtl.originX}px;width:${rtlSize.width}px">`;
  const ltrImg = `<img src="${src(ltr)}" style="right:0;width:${ltrSize.width}px;transform:scaleX(-1)">`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:16px;background:#111827;color:#f9fafb;font:600 15px/1.4 Arial,sans-serif}
  .row{display:flex;gap:16px;align-items:flex-start}
  .panel{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#fff}
  .title{width:${width}px;margin-bottom:8px}
  img{position:absolute;top:0;display:block}
  .box{position:absolute;box-sizing:border-box;border:2px solid}
  .box b{position:absolute;left:-2px;top:-2px;color:#fff;font:700 12px/16px Arial,sans-serif;padding:0 5px}
  </style></head><body>
  <div class="row"><div class="title">RTL render</div><div class="title">LTR render, flipped: boxes should line up with the RTL render</div></div>
  <div class="row"><div class="panel">${rtlImg}${rtlBoxes}</div><div class="panel">${ltrImg}${ltrBoxes}</div></div>
  </body></html>`;
}

export async function renderMirror(
  context: BrowserContext,
  rtl: Shot,
  ltr: Shot,
  findings: Finding[],
  width: number,
): Promise<Buffer> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: width * 2 + 48, height: 800 });
    await page.setContent(mirrorHtml(rtl, ltr, findings, width), { waitUntil: 'load' });
    return await page.screenshot({ fullPage: true });
  } finally {
    await page.close();
  }
}
