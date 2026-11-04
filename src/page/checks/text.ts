// viewport-overflow, text-clipped and arabic-letter-spacing: problems you can
// read off the rendered boxes and computed styles of a single render.
import { hasJoiningLetters, hasRtlLetters } from '../../shared/script.ts';
import type { RawFinding } from '../../types.ts';
import { allElements, cssPath, docBox, isVisible, isVisuallyHidden, snippet, style, textNodes } from '../dom.ts';

const CLIPS = /hidden|clip/;

function hasClippingAncestor(el: Element): boolean {
  const stop: Element[] = [document.body, document.documentElement];
  for (let p = el.parentElement; p && !stop.includes(p); p = p.parentElement) {
    if (style(p).overflowX !== 'visible') return true;
  }
  return false;
}

function isFixed(el: Element): boolean {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    if (style(e).position === 'fixed') return true;
  }
  return false;
}

export function checkOverflow(): RawFinding[] {
  const html = document.documentElement;
  const vw = html.clientWidth;
  const pageScrolls = html.scrollWidth > vw + 1;
  const findings: RawFinding[] = [];
  const reported: Element[] = [];
  for (const el of allElements()) {
    if (!isVisible(el) || isVisuallyHidden(el)) continue;
    const r = el.getBoundingClientRect();
    const overLeft = -r.left;
    const overRight = r.right - vw;
    if (overLeft <= 1 && overRight <= 1) continue;
    const offscreen = r.right <= 0 || r.left >= vw;
    if (offscreen && (!pageScrolls || isFixed(el))) continue; // parked out of sight, nothing to scroll to
    if (hasClippingAncestor(el)) continue;
    if (reported.some((p) => p.contains(el))) continue;
    reported.push(el);
    const side = overLeft > overRight ? 'left' : 'right';
    const by = Math.round(Math.max(overLeft, overRight));
    findings.push({
      rule: 'viewport-overflow',
      severity: pageScrolls ? 'error' : 'warning',
      selector: cssPath(el),
      box: docBox(r),
      message: `This box sticks out ${by}px past the ${side} edge of the ${vw}px viewport${pageScrolls ? ' and gives the page a horizontal scrollbar' : ''}.`,
      evidence: {
        box: `x ${Math.round(r.left)} to ${Math.round(r.right)}, width ${Math.round(r.width)}`,
        position: style(el).position,
      },
    });
  }
  if (pageScrolls && findings.length === 0) findings.push(overflowingText(vw));
  return findings;
}

/** The page scrolls but no box sticks out, so long unbreakable text must be doing it. */
function overflowingText(vw: number): RawFinding {
  const by = document.documentElement.scrollWidth - vw;
  for (const node of textNodes()) {
    const parent = node.parentElement!;
    if (!isVisible(parent) || hasClippingAncestor(parent)) continue;
    const text = textBounds(node);
    if (!text || (text.left >= -1 && text.right <= vw + 1)) continue;
    return {
      rule: 'viewport-overflow',
      severity: 'error',
      selector: cssPath(parent),
      box: docBox(parent.getBoundingClientRect()),
      message: `Text "${snippet(node.data)}" cannot wrap and gives the page a horizontal scrollbar. Use overflow-wrap: anywhere on long URLs and codes.`,
      evidence: { overflow: `${by}px wider than the ${vw}px viewport` },
    };
  }
  // Invisible is not gone: visibility: hidden and opacity: 0 boxes still count toward the scroll area.
  for (const el of allElements()) {
    if (style(el).display === 'none' || isFixed(el) || hasClippingAncestor(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.width === 0 && r.height === 0) || (r.left >= -1 && r.right <= vw + 1)) continue;
    return {
      rule: 'viewport-overflow',
      severity: 'error',
      selector: cssPath(el),
      box: docBox(r),
      message: `This box is invisible but still gives the page a horizontal scrollbar. visibility: hidden and opacity: 0 keep it in the scroll area, so use display: none or do not park it off-screen.`,
      evidence: { overflow: `${by}px wider than the ${vw}px viewport`, box: `x ${Math.round(r.left)} to ${Math.round(r.right)}` },
    };
  }
  return {
    rule: 'viewport-overflow',
    severity: 'error',
    selector: 'html',
    message: `The page is ${by}px wider than the ${vw}px viewport and has a horizontal scrollbar, but no element box explains it. Look at pseudo-elements and transforms.`,
    evidence: { overflow: `${by}px` },
  };
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function textBounds(node: Text): Bounds | null {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

function innerBounds(el: Element): Bounds {
  const r = el.getBoundingClientRect();
  const left = r.left + el.clientLeft;
  const top = r.top + el.clientTop;
  return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
}

const overlap = (a: Bounds, b: Bounds) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Was this truncation asked for, with an ellipsis or a line clamp? */
function intentional(from: Element, to: Element, axis: 'x' | 'y'): boolean {
  for (let e: Element | null = from; e; e = e === to ? null : e.parentElement) {
    const cs = style(e);
    if (axis === 'x' && cs.textOverflow === 'ellipsis') return true;
    if (axis === 'y' && cs.webkitLineClamp && cs.webkitLineClamp !== 'none') return true;
  }
  return false;
}

function contentSize(el: Element, axis: 'x' | 'y'): number {
  const cs = style(el);
  return axis === 'x'
    ? el.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight)
    : el.clientHeight - Number.parseFloat(cs.paddingTop) - Number.parseFloat(cs.paddingBottom);
}

function nearestBlock(el: Element): Element {
  let e: Element = el;
  while (style(e).display === 'inline' && e.parentElement) e = e.parentElement;
  return e;
}

export function checkClipped(): RawFinding[] {
  const findings: RawFinding[] = [];
  const reported = new Set<Element>();
  const stop: Element[] = [document.body, document.documentElement];

  for (const node of textNodes()) {
    const parent = node.parentElement!;
    if (!hasRtlLetters(node.data) && style(parent).direction !== 'rtl') continue;
    if (!isVisible(parent) || isVisuallyHidden(parent)) continue;
    const text = textBounds(node);
    if (!text) continue;

    let clipped = false;
    let hidden = false;
    for (let a: Element | null = parent; a && !stop.includes(a); a = a.parentElement) {
      const cs = style(a);
      const clipX = CLIPS.test(cs.overflowX);
      const clipY = CLIPS.test(cs.overflowY);
      if (!clipX && !clipY) continue;
      if (isVisuallyHidden(a) || a.clientWidth < 2 || a.clientHeight < 2) {
        hidden = true;
        break;
      }
      const box = innerBounds(a);
      if (!overlap(text, box)) {
        hidden = true; // a closed panel or an off-screen slide, not cut-off text
        break;
      }
      const overX = Math.max(box.left - text.left, text.right - box.right);
      const overY = Math.max(box.top - text.top, text.bottom - box.bottom);
      const overflowsX = clipX && overX > 2;
      const overflowsY = clipY && overY > 2;
      // Text narrower than the box is sitting past its edge (a carousel peek), not too long for it.
      const hitX = overflowsX && text.right - text.left > contentSize(a, 'x') && !intentional(parent, a, 'x');
      const hitY = overflowsY && text.bottom - text.top > contentSize(a, 'y') && !intentional(parent, a, 'y');
      if (!hitX && !hitY) {
        if (overflowsX || overflowsY) {
          hidden = true; // truncated on purpose, so it cannot spill either
          break;
        }
        continue;
      }
      clipped = true;
      if (reported.has(a)) break;
      reported.add(a);
      const needs = hitX
        ? `it needs ${Math.round(text.right - text.left)}px but the box is ${a.clientWidth}px wide`
        : `it needs ${Math.round(text.bottom - text.top)}px but the box is ${a.clientHeight}px tall`;
      findings.push({
        rule: 'text-clipped',
        severity: 'error',
        selector: cssPath(a),
        box: docBox(a.getBoundingClientRect()),
        message: `Text "${snippet(node.data)}" is cut off: ${needs}.`,
        evidence: { overflow: `${cs.overflowX} ${cs.overflowY}`, size: `${a.clientWidth}x${a.clientHeight}` },
      });
      break;
    }
    if (clipped || hidden || !hasRtlLetters(node.data)) continue;

    const block = nearestBlock(parent);
    if (stop.includes(block) || reported.has(block)) continue;
    const r = block.getBoundingClientRect();
    const fontSize = Number.parseFloat(style(parent).fontSize) || 16;
    const spillX = Math.max(r.left - text.left, text.right - r.right);
    const spillY = Math.max(r.top - text.top, text.bottom - r.bottom);
    if (spillX <= 2 && spillY <= fontSize / 2) continue;
    if (hasClippingAncestor(block)) continue;
    reported.add(block);
    findings.push({
      rule: 'text-clipped',
      severity: 'warning',
      selector: cssPath(block),
      box: docBox(r),
      message: `Text "${snippet(node.data)}" spills out of its box by ${Math.round(Math.max(spillX, spillY))}px and can run into its neighbors.`,
      evidence: { size: `${Math.round(r.width)}x${Math.round(r.height)}` },
    });
  }
  return findings;
}

export function checkLetterSpacing(): RawFinding[] {
  const bySource = new Map<Element, RawFinding>();
  for (const node of textNodes()) {
    if (!hasJoiningLetters(node.data)) continue;
    const parent = node.parentElement!;
    if (!isVisible(parent)) continue;
    const value = style(parent).letterSpacing;
    if (value === 'normal' || Math.abs(Number.parseFloat(value)) < 0.01) continue;
    let source = parent;
    for (let p = parent.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (style(p).letterSpacing !== value) break;
      source = p;
    }
    if (bySource.has(source)) continue;
    bySource.set(source, {
      rule: 'arabic-letter-spacing',
      severity: 'error',
      selector: cssPath(source),
      box: docBox(parent.getBoundingClientRect()),
      message: `letter-spacing: ${value} on Arabic-script text "${snippet(node.data)}". Safari draws the letters disconnected, even though Chromium ignores the spacing.`,
      evidence: { 'letter-spacing': value, 'set on': cssPath(source) },
    });
  }
  return [...bySource.values()];
}
