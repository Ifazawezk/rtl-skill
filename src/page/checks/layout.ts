// physical-css and mirror-mismatch. The page is measured in RTL, flipped to
// LTR, measured again and flipped back. Logical CSS swaps sides between the
// two renders; physical CSS does not, and neither do boxes placed by
// transforms or by scripts.
import type { RuleId } from '../../rules.ts';
import type { Box, RawFinding } from '../../types.ts';
import { hasRtlLetters } from '../../shared/script.ts';
import { findDeclaration, type Declaration } from '../css.ts';
import { allElements, cssPath, docBox, isVisible, style } from '../dom.ts';

interface Snap {
  box: Box;
  direction: string;
  display: string;
  ml: number;
  mr: number;
  pl: number;
  pr: number;
  bl: number;
  br: number;
  radius: [string, string, string, string]; // top-left, top-right, bottom-right, bottom-left
  textAlign: string;
  float: string;
  clear: string;
  position: string;
  left: number | null;
  right: number | null;
}

const state = {
  elements: [] as Element[],
  rtl: new Map<Element, Snap>(),
  ltr: new Map<Element, Snap>(),
  flipped: [] as Element[],
  forced: null as HTMLStyleElement | null,
};

const px = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const pxOrNull = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function snap(el: Element): Snap | null {
  if (!isVisible(el)) return null;
  const cs = style(el);
  return {
    box: docBox(el.getBoundingClientRect()),
    direction: cs.direction,
    display: cs.display,
    ml: px(cs.marginLeft),
    mr: px(cs.marginRight),
    pl: px(cs.paddingLeft),
    pr: px(cs.paddingRight),
    bl: px(cs.borderLeftWidth),
    br: px(cs.borderRightWidth),
    radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
    textAlign: cs.textAlign,
    float: cs.float,
    clear: cs.clear,
    position: cs.position,
    left: cs.position === 'static' ? null : pxOrNull(cs.left),
    right: cs.position === 'static' ? null : pxOrNull(cs.right),
  };
}

/** Measures every visible element in an RTL context. Call before flip(). */
export function snapshotRtl(): number {
  state.elements = allElements().filter((el) => isVisible(el) && style(el).direction === 'rtl');
  state.rtl = new Map();
  for (const el of state.elements) {
    const s = snap(el);
    if (s) state.rtl.set(el, s);
  }
  return state.rtl.size;
}

export function snapshotLtr(): number {
  state.ltr = new Map();
  for (const el of state.elements) {
    const s = snap(el);
    if (s) state.ltr.set(el, s);
  }
  return state.ltr.size;
}

/** Renders the page left to right: dir="rtl" becomes dir="ltr", CSS direction is overridden. */
export function flip(): void {
  state.flipped = [];
  for (const el of Array.from(document.querySelectorAll('[dir]'))) {
    if ((el.getAttribute('dir') || '').toLowerCase() === 'rtl') {
      el.setAttribute('dir', 'ltr');
      state.flipped.push(el);
    }
  }
  if (style(document.documentElement).direction === 'rtl' || (document.body && style(document.body).direction === 'rtl')) {
    state.forced = document.createElement('style');
    state.forced.textContent = 'html, body { direction: ltr !important; }';
    document.head.append(state.forced);
  }
}

export function unflip(): void {
  for (const el of state.flipped) el.setAttribute('dir', 'rtl');
  state.flipped = [];
  state.forced?.remove();
  state.forced = null;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 0.5;

interface Physical {
  el: Element;
  group: string;
  longhands: string[];
}

/** Elements whose left/right values did not swap when the direction flipped. */
function physicalCandidates(): Physical[] {
  const out: Physical[] = [];
  for (const el of state.elements) {
    const r = state.rtl.get(el);
    const l = state.ltr.get(el);
    if (!r || !l || l.direction !== 'ltr') continue;
    const unchanged = (a: number, b: number, c: number, d: number) => close(a, c) && close(b, d);
    if (!close(r.ml, r.mr) && unchanged(r.ml, r.mr, l.ml, l.mr)) {
      out.push({ el, group: 'margin', longhands: sides('margin', r.ml, r.mr) });
    } else if (r.display !== 'inline' && !unchanged(r.ml, r.mr, l.mr, l.ml) && !usesAutoMargin(el)) {
      out.push({ el, group: 'margin', longhands: ['margin-left', 'margin-right'] });
    }
    if (!close(r.pl, r.pr) && unchanged(r.pl, r.pr, l.pl, l.pr)) {
      out.push({ el, group: 'padding', longhands: sides('padding', r.pl, r.pr) });
    } else if (!unchanged(r.pl, r.pr, l.pr, l.pl)) {
      // Neither kept nor swapped: a physical reset is fighting a logical default on one side.
      out.push({ el, group: 'padding', longhands: ['padding-left', 'padding-right'] });
    }
    if (!close(r.bl, r.br) && unchanged(r.bl, r.br, l.bl, l.br)) {
      out.push({
        el,
        group: 'border',
        longhands: [r.bl ? 'border-left-width' : '', r.br ? 'border-right-width' : ''].filter(Boolean),
      });
    }
    const [tl, tr, brr, blr] = r.radius;
    if ((tl !== tr || blr !== brr) && r.radius.join() === l.radius.join()) {
      const names = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];
      out.push({ el, group: 'radius', longhands: names.filter((_, i) => px(r.radius[i]) !== 0) });
    }
    if (/^(-webkit-)?(left|right)$/.test(r.textAlign) && r.textAlign === l.textAlign && textAlignSource(el) === el) {
      out.push({ el, group: 'text-align', longhands: ['text-align'] });
    }
    if ((r.float === 'left' || r.float === 'right') && r.float === l.float) {
      out.push({ el, group: 'float', longhands: ['float'] });
    }
    if ((r.clear === 'left' || r.clear === 'right') && r.clear === l.clear) {
      out.push({ el, group: 'clear', longhands: ['clear'] });
    }
    if (
      r.left !== null &&
      r.right !== null &&
      l.left !== null &&
      l.right !== null &&
      !close(r.left, r.right) &&
      unchanged(r.left, r.right, l.left, l.right) &&
      !isCentered(el)
    ) {
      out.push({ el, group: 'inset', longhands: ['left', 'right'] });
    }
  }
  return out;
}

/** Auto margins resolve to used lengths that move with the layout, so they prove nothing here. */
function usesAutoMargin(el: Element): boolean {
  return ['margin-left', 'margin-right'].some((p) => findDeclaration(el, p)?.value.includes('auto'));
}

function sides(prop: string, left: number, right: number): string[] {
  return [left ? `${prop}-left` : '', right ? `${prop}-right` : ''].filter(Boolean);
}

/** text-align inherits; report the element where it is set, not every child. */
function textAlignSource(el: Element): Element {
  let source = el;
  const value = style(el).textAlign;
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    if (style(p).textAlign !== value || style(p).direction !== 'rtl') break;
    source = p;
  }
  return source;
}

/** Boxes centered with left: 50% and a transform look physical but mirror fine. */
function isCentered(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const parent = (el as HTMLElement).offsetParent ?? null;
  const cb = parent ? parent.getBoundingClientRect() : { left: 0, width: document.documentElement.clientWidth };
  return Math.abs(r.left + r.width / 2 - (cb.left + cb.width / 2)) < 2;
}

const LOGICAL: Record<string, string> = {
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-left-width': 'border-inline-start-width',
  'border-right-width': 'border-inline-end-width',
  'border-top-left-radius': 'border-start-start-radius',
  'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius',
  'border-bottom-right-radius': 'border-end-end-radius',
  left: 'inset-inline-start',
  right: 'inset-inline-end',
};

/** Suggests the logical replacement for a physical declaration (written for LTR). */
export function logicalFor(property: string, value: string): string {
  const v = value.trim();
  if (property === 'text-align') return `text-align: ${/left/.test(v) ? 'start' : 'end'}`;
  if (property === 'float' || property === 'clear') return `${property}: ${v === 'left' ? 'inline-start' : 'inline-end'}`;
  if (property === 'margin' || property === 'padding' || property === 'inset') {
    const parts = v.split(/\s+/);
    const [t, r = t, b = t, l = r] = parts;
    const block = t === b ? t : `${t} ${b}`;
    const inline = l === r ? l : `${l} ${r}`;
    const prefix = property === 'inset' ? 'inset' : property;
    return `${prefix}-block: ${block}; ${prefix}-inline: ${inline}`;
  }
  if (property === 'border-radius') return 'border-start-start-radius, border-start-end-radius, border-end-end-radius, border-end-start-radius';
  return LOGICAL[property] ? `${LOGICAL[property]}: ${v}` : `a logical property instead of ${property}`;
}

/** Can you see the alignment? Not on Latin text, and not in a box that hugs its text. */
function alignmentShows(el: Element): boolean {
  if (!hasRtlLetters(el.textContent ?? '')) return false;
  const range = document.createRange();
  range.selectNodeContents(el);
  return el.getBoundingClientRect().width - range.getBoundingClientRect().width > 8;
}

function describeSide(group: string, decl: Declaration, visibleBug: boolean): string {
  if (visibleBug) return 'aligns RTL text to the left (its end)';
  if (group === 'text-align' && /right/.test(decl.value)) return 'stays right-aligned in LTR too';
  return 'stays on the same side in both directions';
}

export function comparePhysical(): { findings: RawFinding[]; elements: Element[] } {
  const groups = new Map<string, { decl: Declaration; group: string; els: Element[] }>();
  for (const cand of physicalCandidates()) {
    for (const longhand of cand.longhands) {
      const decl = findDeclaration(cand.el, longhand);
      if (!decl) continue;
      const key = `${decl.source}|${decl.selector}|${decl.property}|${decl.value}`;
      const entry = groups.get(key);
      if (entry) {
        if (!entry.els.includes(cand.el)) entry.els.push(cand.el);
      } else groups.set(key, { decl, group: cand.group, els: [cand.el] });
    }
  }
  const findings: RawFinding[] = [];
  const flagged: Element[] = [];
  for (const { decl, group, els } of groups.values()) {
    const el = els[0];
    flagged.push(...els);
    const css = `${decl.property}: ${decl.value}`;
    const visibleBug = group === 'text-align' && /left/.test(decl.value) && alignmentShows(el);
    const evidence: Record<string, string> = {
      css: decl.selector === 'style attribute' ? `style="${css}"` : `${decl.selector} { ${css} }`,
      source: decl.source,
      fix: logicalFor(decl.property, decl.value),
    };
    if (decl.styleIndex !== undefined) evidence.styleIndex = String(decl.styleIndex);
    if (decl.href) evidence.href = decl.href;
    if (els.length > 1) evidence.elements = `${els.length} elements use this rule`;
    findings.push({
      rule: 'physical-css',
      severity: visibleBug ? 'error' : 'warning',
      selector: cssPath(el),
      box: state.rtl.get(el)?.box,
      ltrBox: state.ltr.get(el)?.box,
      message: `${css} is physical and ${describeSide(group, decl, visibleBug)}. Use ${logicalFor(decl.property, decl.value)}.`,
      evidence,
    });
  }
  return { findings, elements: flagged };
}

/** Boxes that are not where the mirrored LTR layout puts them. */
export function compareMirror(explained: Element[]): RawFinding[] {
  const W = document.documentElement.clientWidth;
  const tol = Math.max(4, W * 0.005);
  const moved: { el: Element; dx: number }[] = [];
  for (const el of state.elements) {
    const r = state.rtl.get(el);
    const l = state.ltr.get(el);
    if (!r || !l || l.direction !== 'ltr') continue;
    if (r.display === 'inline' || r.display === 'contents' || r.display.startsWith('table-')) continue;
    if (Math.abs(r.box.y - l.box.y) > tol || Math.abs(r.box.height - l.box.height) > tol) continue;
    if (Math.abs(r.box.width - l.box.width) > tol || r.box.width >= W - 2 * tol) continue;
    const mirroredX = W - (l.box.x + l.box.width);
    const dx = r.box.x - mirroredX;
    if (Math.abs(dx) > tol) moved.push({ el, dx });
  }
  const byEl = new Map(moved.map((m) => [m.el, m.dx]));
  const groups = new Map<Element, { el: Element; dx: number }[]>();
  for (const { el, dx } of moved) {
    let sharedWithAncestor = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const pdx = byEl.get(p);
      if (pdx !== undefined && Math.abs(pdx - dx) <= tol) {
        sharedWithAncestor = true;
        break;
      }
    }
    if (sharedWithAncestor) continue;
    if (explained.some((p) => (p.parentElement ?? p).contains(el))) continue;
    // One width difference shifts everything after it, so a row counts as one problem.
    const key = el.parentElement?.closest('ul, ol, nav, menu, [role="menu"], [role="tablist"]') ?? el.parentElement ?? el;
    const group = groups.get(key);
    if (group) group.push({ el, dx });
    else groups.set(key, [{ el, dx }]);
  }

  const findings: RawFinding[] = [];
  for (const group of groups.values()) {
    const { el, dx } = group.reduce((a, b) => (Math.abs(b.dx) > Math.abs(a.dx) ? b : a));
    const r = state.rtl.get(el)!;
    const l = state.ltr.get(el)!;
    const evidence: Record<string, string> = {
      rtl: `x ${Math.round(r.box.x)} to ${Math.round(r.box.x + r.box.width)}`,
      'mirrored ltr': `x ${Math.round(W - l.box.x - l.box.width)} to ${Math.round(W - l.box.x)}`,
    };
    if (group.length > 1) evidence.boxes = `${group.length} boxes in this group are off, this is the largest`;
    const cause = transformCause(el);
    if (cause) Object.assign(evidence, cause);
    findings.push({
      rule: 'mirror-mismatch',
      severity: 'warning',
      selector: cssPath(el),
      box: r.box,
      ltrBox: l.box,
      message: `This box does not mirror: it sits ${Math.round(Math.abs(dx))}px to the ${dx > 0 ? 'right' : 'left'} of where the mirrored LTR layout puts it. Check transforms, transform-origin and scripts that set left or right.`,
      evidence,
    });
  }
  return findings;
}

/** Transform details on the element or its nearest transformed ancestor. */
function transformCause(el: Element): Record<string, string> | null {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    const cs = style(e);
    const parts: Record<string, string> = {};
    if (cs.transform !== 'none') parts.transform = cs.transform;
    if (cs.translate !== 'none') parts.translate = cs.translate;
    if (Object.keys(parts).length) {
      parts['transform-origin'] = cs.transformOrigin;
      if (e !== el) parts.on = cssPath(e);
      return parts;
    }
  }
  return null;
}

export function layoutChecks(rules: RuleId[]): RawFinding[] {
  const on = (id: RuleId) => rules.length === 0 || rules.includes(id);
  const physical = comparePhysical();
  const findings: RawFinding[] = [];
  if (on('physical-css')) findings.push(...physical.findings);
  if (on('mirror-mismatch')) findings.push(...compareMirror(physical.elements));
  return findings;
}
