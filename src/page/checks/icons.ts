// icon-mirroring: resolves where an icon points on screen and compares that
// with where its meaning says it should point in RTL.
import {
  ARROW_GLYPHS,
  ARROW_RE,
  classifyIconName,
  classifyLabel,
  expectedPointing,
  opposite,
  rotatePropertyX,
  scalePropertyX,
  transformScaleX,
  type Meaning,
  type Pointing,
} from '../../shared/icons.ts';
import type { RawFinding } from '../../types.ts';
import { cssPath, docBox, isVisible, isVisuallyHidden, snippet, style, textNodes } from '../dom.ts';

const ICON_SELECTOR = [
  'svg',
  'img',
  'i',
  'ion-icon',
  '[class*="icon" i]',
  '[class*="material-" i]',
  '[class*="chevron" i]',
  '[class*="arrow" i]',
  '[class*="caret" i]',
  '[class*="fa-"]',
  '[class*="bi-"]',
  '[data-icon]',
  '[data-lucide]',
  '[data-feather]',
].join(',');

const INTERACTIVE = 'a, button, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
const MAX_ICON_SIZE = 96;

function urlBase(url: string): string {
  const m = /url\(["']?([^"')]+)["']?\)/.exec(url);
  const path = m ? m[1] : url;
  if (path.startsWith('data:')) return '';
  return decodeURIComponent(path.split(/[?#]/)[0].split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
}

const isLigatureIcon = (el: Element) => /material-(icons|symbols)/i.test(el.getAttribute('class') || '');

function iconName(el: Element): string {
  const cs = style(el);
  const use = el.querySelector('use');
  const useHref = use?.getAttribute('href') || use?.getAttribute('xlink:href') || '';
  return [
    el.getAttribute('class'),
    el.id,
    el.getAttribute('data-icon'),
    el.getAttribute('data-lucide'),
    el.getAttribute('data-feather'),
    el.localName === 'ion-icon' ? el.getAttribute('name') : '',
    useHref.split('#').pop(),
    el.localName === 'img' ? urlBase(el.getAttribute('src') || '') : '',
    cs.maskImage && cs.maskImage !== 'none' ? urlBase(cs.maskImage) : '',
    cs.backgroundImage && cs.backgroundImage !== 'none' ? urlBase(cs.backgroundImage) : '',
    isLigatureIcon(el) ? (el.textContent || '').trim() : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function looksLikeIcon(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width > MAX_ICON_SIZE || r.height > MAX_ICON_SIZE) return false;
  if (el.localName === 'svg' || el.localName === 'img' || isLigatureIcon(el)) return true;
  return !(el.textContent || '').trim();
}

/** Is the element drawn mirrored? Null when a rotation leaves it pointing up or down. */
export function isFlipped(el: Element): boolean | null {
  let factor = 1;
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
    const cs = style(e);
    factor *= transformScaleX(cs.transform) * scalePropertyX(cs.scale) * rotatePropertyX(cs.rotate);
  }
  if (Math.abs(factor) < 0.3) return null;
  return factor < 0;
}

function label(el: Element): string {
  const own = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt')];
  const host = el.closest(INTERACTIVE);
  if (host) own.push(host.getAttribute('aria-label'), host.getAttribute('title'), (host.textContent || '').slice(0, 80));
  return own.filter(Boolean).join(' ');
}

function directionalFinding(
  el: Element,
  box: RawFinding['box'],
  what: string,
  pointing: Pointing,
  meaning: Meaning,
  fromLabel: boolean,
): RawFinding {
  return {
    rule: 'icon-mirroring',
    severity: fromLabel ? 'error' : 'warning',
    selector: cssPath(el),
    box,
    message: `${what} points ${pointing}, but ${meaning === 'forward' ? 'forward' : 'back'} is ${expectedPointing(meaning)} in RTL. Mirror it with transform: scaleX(-1) under [dir="rtl"] or use the opposite icon.`,
    evidence: {
      meaning: fromLabel ? `${meaning}, from the label` : `${meaning}, assumed from the icon name`,
    },
  };
}

export function checkIcons(): RawFinding[] {
  const findings: RawFinding[] = [];
  const claimed = new Set<Element>();

  for (const el of Array.from(document.querySelectorAll(ICON_SELECTOR))) {
    if (claimed.has(el) || !el.parentElement) continue;
    if (!isVisible(el) || isVisuallyHidden(el) || !looksLikeIcon(el)) continue;
    if (style(el.parentElement).direction !== 'rtl') continue;
    const name = iconName(el);
    const icon = classifyIconName(name);
    if (!icon) continue;
    el.querySelectorAll('*').forEach((child) => claimed.add(child));
    const flipped = isFlipped(el);
    if (flipped === null) continue;
    const box = docBox(el.getBoundingClientRect());
    if (icon.kind === 'fixed') {
      if (flipped) {
        findings.push({
          rule: 'icon-mirroring',
          severity: 'warning',
          selector: cssPath(el),
          box,
          message: `This icon is mirrored but should not be: ${icon.reason}. Limit the RTL flip to directional icons.`,
          evidence: { icon: snippet(name, 60) },
        });
      }
      continue;
    }
    const fromLabel = classifyLabel(label(el));
    const meaning = fromLabel ?? icon.meaning;
    const pointing = flipped ? opposite(icon.pointing) : icon.pointing;
    if (pointing !== expectedPointing(meaning)) {
      const finding = directionalFinding(el, box, 'This icon', pointing, meaning, fromLabel !== null);
      finding.evidence!.icon = snippet(name, 60);
      findings.push(finding);
    }
  }

  for (const node of textNodes()) {
    const parent = node.parentElement!;
    if (style(parent).direction !== 'rtl' || !isVisible(parent)) continue;
    for (const m of node.data.matchAll(ARROW_RE)) {
      const glyph = m[0];
      const flipped = isFlipped(parent);
      if (flipped === null) continue;
      const host = parent.closest(INTERACTIVE) ?? parent;
      const text = (host.getAttribute('aria-label') || '') + ' ' + (host.textContent || '').slice(0, 80);
      const fromLabel = classifyLabel(text);
      const drawn = ARROW_GLYPHS[glyph];
      const pointing = flipped ? opposite(drawn) : drawn;
      // A lone left arrow in RTL text is most likely right already, so only a right arrow is assumed forward.
      const meaning = fromLabel ?? (drawn === 'right' ? 'forward' : null);
      if (!meaning || pointing === expectedPointing(meaning)) continue;
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + glyph.length);
      const finding = directionalFinding(
        parent,
        docBox(range.getBoundingClientRect()),
        `The arrow character "${glyph}"`,
        pointing,
        meaning,
        fromLabel !== null,
      );
      finding.message = `The arrow character "${glyph}" points ${pointing}, but ${meaning === 'forward' ? 'forward' : 'back'} is ${expectedPointing(meaning)} in RTL. Arrow characters are not mirrored by the bidi algorithm, so write the opposite arrow or use a mirrored icon.`;
      findings.push(finding);
    }
  }
  return findings;
}
