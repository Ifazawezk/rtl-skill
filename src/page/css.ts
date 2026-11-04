// Finds the author CSS declaration that sets a property on an element, so a
// finding can say ".card .icon { margin-right: 8px }" instead of only "margin".

export interface Declaration {
  selector: string;
  /** The property as written, for example "margin" for a shorthand. */
  property: string;
  value: string;
  /** "<style> #1", "style attribute" or the stylesheet file name. */
  source: string;
  /** Index of the <style> element among all <style> elements, when relevant. */
  styleIndex?: number;
  href?: string;
}

interface Candidate extends Declaration {
  important: boolean;
  specificity: number;
  order: number;
}

/** Shorthands we prefer to report when the longhand came from one of them. */
const SHORTHANDS: Record<string, string[]> = {
  'margin-left': ['margin'],
  'margin-right': ['margin'],
  'padding-left': ['padding'],
  'padding-right': ['padding'],
  'border-left-width': ['border-left', 'border-width', 'border'],
  'border-right-width': ['border-right', 'border-width', 'border'],
  'border-top-left-radius': ['border-radius'],
  'border-top-right-radius': ['border-radius'],
  'border-bottom-left-radius': ['border-radius'],
  'border-bottom-right-radius': ['border-radius'],
  left: ['inset'],
  right: ['inset'],
};

interface RuleEntry {
  rule: CSSStyleRule;
  selector: string;
  source: string;
  styleIndex?: number;
  href?: string;
  order: number;
}

let ruleCache: RuleEntry[] | null = null;

export function resetCssCache(): void {
  ruleCache = null;
}

/** Copies of stylesheets the page may not read itself, parsed but never applied. */
const readableCopies = new Map<string, CSSStyleSheet>();

/** Stylesheets whose rules are blocked: anything cross-origin, and every file:// stylesheet. */
export function blockedSheets(): string[] {
  const hrefs: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      void sheet.cssRules;
    } catch {
      if (sheet.href) hrefs.push(sheet.href);
    }
  }
  return hrefs;
}

export function addSheetCopy(href: string, css: string): void {
  const copy = new CSSStyleSheet();
  copy.replaceSync(css);
  readableCopies.set(href, copy);
  ruleCache = null;
}

function collectRules() {
  if (ruleCache) return ruleCache;
  const out: RuleEntry[] = [];
  const styleEls = Array.from(document.querySelectorAll('style'));
  let order = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      rules = sheet.href ? readableCopies.get(sheet.href)?.cssRules : undefined;
    }
    if (!rules) continue;
    const owner = sheet.ownerNode as Element | null;
    let source = 'stylesheet';
    let styleIndex: number | undefined;
    let href: string | undefined;
    if (owner && owner.localName === 'style') {
      styleIndex = styleEls.indexOf(owner as HTMLStyleElement);
      source = `<style> #${styleIndex + 1}`;
    } else if (sheet.href) {
      href = sheet.href;
      source = decodeURIComponent(sheet.href.split(/[?#]/)[0].split('/').pop() || sheet.href);
    }
    const walk = (list: CSSRuleList, parentSelector: string | null) => {
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSMediaRule && !matchMedia(rule.media.mediaText).matches) continue;
        if (rule instanceof CSSStyleRule) {
          let selector = rule.selectorText;
          if (parentSelector) {
            selector = selector.includes('&')
              ? selector.replace(/&/g, `:is(${parentSelector})`)
              : `:is(${parentSelector}) ${selector}`;
          }
          out.push({ rule, selector, source, styleIndex, href, order: order++ });
          if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules, selector);
        } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
          walk((rule as CSSGroupingRule).cssRules, parentSelector);
        }
      }
    };
    walk(rules, null);
  }
  ruleCache = out;
  return out;
}

/** Rough specificity as one number: ids * 10000 + classes * 100 + types. */
export function specificity(selector: string): number {
  const s = selector
    .replace(/:(is|where|not|has)\(/g, ' (')
    .replace(/"[^"]*"|'[^']*'/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const types = (s.match(/(^|[\s>+~(])[a-z][\w-]*/gi) || []).length;
  return ids * 10000 + classes * 100 + types;
}

function matchingSpecificity(el: Element, selectorList: string): number | null {
  let best: number | null = null;
  for (const part of splitSelectorList(selectorList)) {
    try {
      if (el.matches(part)) best = Math.max(best ?? 0, specificity(part));
    } catch {
      // selector the browser cannot match from here
    }
  }
  return best;
}

function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * The declaration that wins for `longhand` on `el`, following importance,
 * then specificity, then source order. Returns null when only the user agent
 * stylesheet or presentational attributes set it.
 */
export function findDeclaration(el: Element, longhand: string): Declaration | null {
  const candidates: Candidate[] = [];
  const inline = (el as HTMLElement).style;
  if (inline && inline.getPropertyValue(longhand)) {
    const shorthand = (SHORTHANDS[longhand] || []).find((p) => inline.getPropertyValue(p));
    const property = shorthand ?? longhand;
    candidates.push({
      selector: 'style attribute',
      property,
      value: inline.getPropertyValue(property),
      source: 'style attribute',
      important: inline.getPropertyPriority(longhand) === 'important',
      specificity: 1_000_000,
      order: Number.MAX_SAFE_INTEGER,
    });
  }
  for (const entry of collectRules()) {
    const value = entry.rule.style.getPropertyValue(longhand);
    if (!value) continue;
    const spec = matchingSpecificity(el, entry.selector);
    if (spec === null) continue;
    const shorthand = (SHORTHANDS[longhand] || []).find((p) => entry.rule.style.getPropertyValue(p));
    const property = shorthand ?? longhand;
    candidates.push({
      selector: entry.rule.selectorText,
      property,
      value: entry.rule.style.getPropertyValue(property),
      source: entry.source,
      styleIndex: entry.styleIndex,
      href: entry.href,
      important: entry.rule.style.getPropertyPriority(longhand) === 'important',
      specificity: spec,
      order: entry.order,
    });
  }
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      Number(b.important) - Number(a.important) || b.specificity - a.specificity || b.order - a.order,
  );
  const { important: _i, specificity: _s, order: _o, ...decl } = candidates[0];
  return decl;
}
