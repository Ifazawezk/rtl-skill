// Draws numbered boxes over the page for the annotated screenshot. Everything
// lives in one element outside <body>, so it is easy to remove again.
import type { Finding } from '../types.ts';
import { OVERLAY_ID } from './dom.ts';

const COLORS = { error: '#dc2626', warning: '#d97706' } as const;

const TAG_STYLE =
  'position:absolute;font:700 12px/18px Arial,sans-serif;color:#fff;padding:0 6px;border-radius:4px;white-space:nowrap;direction:ltr;unicode-bidi:isolate;';

export function drawOverlay(findings: Finding[]): void {
  clearOverlay();
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.dir = 'ltr';
  root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;letter-spacing:0;';

  const pageLevel = findings.filter((f) => !f.box);
  if (pageLevel.length) {
    const banner = document.createElement('div');
    banner.style.cssText = `position:fixed;left:0;right:0;top:0;background:${COLORS.error};color:#fff;font:700 13px/20px Arial,sans-serif;padding:6px 10px;direction:ltr;text-align:left;`;
    banner.textContent = pageLevel.map((f) => `#${f.id} ${f.rule}: ${f.selector}`).join('   ');
    root.append(banner);
  }

  const html = document.documentElement;
  const rtl = getComputedStyle(html).direction === 'rtl' || (document.body && getComputedStyle(document.body).direction === 'rtl');
  // The screenshot covers the scrollable area. Boxes past its edge are drawn at the edge.
  const minX = rtl ? html.clientWidth - html.scrollWidth : 0;
  const maxX = rtl ? html.clientWidth : html.scrollWidth;
  const seen = new Map<string, number>();
  for (const f of findings) {
    if (!f.box) continue;
    const color = COLORS[f.severity];
    const x = Math.max(minX, Math.min(f.box.x, maxX - 8));
    const right = Math.max(x + 8, Math.min(f.box.x + f.box.width, maxX));
    // The padding around the box must not widen the page the screenshot is about.
    const left = Math.max(minX, x - 2);
    const boxRight = Math.min(maxX, right + 2);
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;box-sizing:border-box;left:${left}px;top:${f.box.y - 2}px;width:${boxRight - left}px;height:${f.box.height + 4}px;border:2px solid ${color};border-radius:3px;background:${color}14;`;
    // Findings on the same box stack their labels instead of covering each other.
    const key = `${Math.round(left)},${Math.round(f.box.y)}`;
    const stacked = seen.get(key) ?? 0;
    seen.set(key, stacked + 1);
    const tag = document.createElement('div');
    tag.style.cssText = `${TAG_STYLE}background:${color};left:-2px;top:${(f.box.y < 24 ? 0 : -20) + stacked * 20}px;`;
    tag.textContent = `${f.id} ${f.rule}`;
    box.append(tag);
    root.append(box);
  }
  document.documentElement.append(root);
}

export function clearOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}
