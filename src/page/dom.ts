// DOM helpers used by every check. This code runs inside the page.
import type { Box } from '../types.ts';

export const OVERLAY_ID = '__rtl_check_overlay';

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'base']);

/** Every element under <body> that a check may look at, in document order. */
export function allElements(): Element[] {
  const out: Element[] = [];
  const body = document.body;
  if (!body) return out;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.localName) || el.id === OVERLAY_ID) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Element);
  return out;
}

/** Non-empty text nodes under <body>, skipping script, style and form controls. */
export function textNodes(root: Node = document.body): Text[] {
  const out: Text[] = [];
  if (!root) return out;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.localName) || parent.localName === 'textarea' || parent.closest(`#${OVERLAY_ID}`)) {
        return NodeFilter.FILTER_REJECT;
      }
      return /\S/.test((node as Text).data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

export function style(el: Element): CSSStyleDeclaration {
  return getComputedStyle(el);
}

/** Is the element drawn on screen at all (size, display, visibility, opacity)? */
export function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  }
  const cs = style(el);
  return cs.display !== 'none' && cs.visibility === 'visible' && cs.opacity !== '0';
}

/** The "visually hidden" pattern used for screen-reader-only text. */
export function isVisuallyHidden(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 2 || r.height <= 2) return true;
  const cs = style(el);
  if (cs.clip && cs.clip !== 'auto' && /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip)) return true;
  return /inset\((50|100)%\)/.test(cs.clipPath);
}

export function isRtlContext(el: Element): boolean {
  return style(el).direction === 'rtl';
}

export function docBox(r: DOMRect | { left: number; top: number; width: number; height: number }): Box {
  return {
    x: round(r.left + window.scrollX),
    y: round(r.top + window.scrollY),
    width: round(r.width),
    height: round(r.height),
  };
}

export function unionBox(rects: ArrayLike<DOMRect>): Box | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of Array.from(rects)) {
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (left === Infinity) return undefined;
  return docBox({ left, top, width: right - left, height: bottom - top });
}

export function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A short CSS selector that matches only this element, for reports. */
export function cssPath(el: Element): string {
  if (el === document.documentElement) return 'html';
  if (el === document.body) return 'body';
  const unique = (sel: string) => {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };
  if (el.id && unique(`#${CSS.escape(el.id)}`)) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let e: Element | null = el;
  while (e && e !== document.documentElement && e !== document.body && parts.length < 6) {
    let part = e.localName;
    if (e.id && unique(`#${CSS.escape(e.id)}`)) {
      parts.unshift(`#${CSS.escape(e.id)}`);
      break;
    }
    const classes = Array.from(e.classList).slice(0, 2);
    if (classes.length) part += '.' + classes.map((c) => CSS.escape(c)).join('.');
    const parent: Element | null = e.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.localName === e!.localName);
      const sameSel = sameTag.filter((c) => classes.every((cl) => c.classList.contains(cl)));
      if (sameSel.length > 1) part += `:nth-of-type(${sameTag.indexOf(e) + 1})`;
    }
    parts.unshift(part);
    const sel = parts.join(' > ');
    if (unique(sel)) return sel;
    e = parent;
  }
  return parts.join(' > ');
}

/** The first characters of an element's text, for messages. */
export function snippet(text: string, max = 40): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '...' : t;
}

/** Text of an element's own child text nodes (not descendants). */
export function ownText(el: Element): string {
  let s = '';
  for (const n of Array.from(el.childNodes)) if (n.nodeType === Node.TEXT_NODE) s += (n as Text).data;
  return s;
}

/** Is `a` an ancestor of (or the same as) `b`? */
export function contains(a: Element, b: Element): boolean {
  return a === b || a.contains(b);
}
