// dir-attribute and lang-attribute: is the document set up as RTL at all?
import { countLetters, dominantRtlScript, isArabicTag, langMatchesScript, notArabicLanguage, rtlShare, type LetterCounts } from '../../shared/script.ts';
import type { RawFinding } from '../../types.ts';
import { allElements, cssPath, docBox, isVisible, ownText, snippet, style } from '../dom.ts';

/** Below this many RTL letters a page is not treated as RTL content. */
const MIN_RTL_LETTERS = 20;

export function pageLetters(): LetterCounts {
  return countLetters(document.body ? document.body.innerText : '');
}

export function isRtlContent(counts: LetterCounts): boolean {
  return counts.rtl >= MIN_RTL_LETTERS && rtlShare(counts) >= 0.5;
}

const SCRIPT_NAME = { arabic: 'Arabic-script', hebrew: 'Hebrew', other: 'right-to-left' } as const;

export function checkDir(counts: LetterCounts): RawFinding[] {
  const findings: RawFinding[] = [];
  const html = document.documentElement;
  const body = document.body;
  if (!body) return findings;
  const rootDir = (html.getAttribute('dir') || '').trim().toLowerCase();
  const share = Math.round(rtlShare(counts) * 100);
  const script = dominantRtlScript(counts);

  if (isRtlContent(counts) && rootDir !== 'rtl') {
    const what = `${share}% of the letters on this page are ${SCRIPT_NAME[script ?? 'other']}`;
    if ((body.getAttribute('dir') || '').toLowerCase() === 'rtl') {
      findings.push({
        rule: 'dir-attribute',
        severity: 'warning',
        selector: 'body',
        message: `dir="rtl" is on <body> but not on <html>. Put it on <html> so the whole document, including :root styles and content outside <body>, is RTL.`,
        evidence: { html: `<html${rootDir ? ` dir="${rootDir}"` : ''}>`, body: '<body dir="rtl">' },
      });
    } else if (rootDir === 'auto') {
      findings.push({
        rule: 'dir-attribute',
        severity: 'warning',
        selector: 'html',
        message: `<html dir="auto"> makes the browser guess the direction from the first strong letter. ${what}; set dir="rtl".`,
        evidence: { html: '<html dir="auto">' },
      });
    } else if (style(body).direction === 'rtl' || style(html).direction === 'rtl') {
      findings.push({
        rule: 'dir-attribute',
        severity: 'warning',
        selector: 'html',
        message: `The page is RTL only through CSS direction. Add dir="rtl" to <html>: [dir] selectors, Tailwind rtl: variants and screen readers do not see CSS direction.`,
        evidence: { html: rootDir ? `<html dir="${rootDir}">` : '<html> without dir', css: 'direction: rtl' },
      });
    } else {
      findings.push({
        rule: 'dir-attribute',
        severity: 'error',
        selector: 'html',
        message: `${what}, but the document is left-to-right. Add dir="rtl" to <html>.`,
        evidence: { html: rootDir ? `<html dir="${rootDir}">` : '<html> without dir', rtlShare: `${share}%` },
      });
    }
  }

  // RTL paragraphs inside LTR blocks, on pages that are otherwise RTL.
  if (style(html).direction === 'rtl' || style(body).direction === 'rtl') {
    const reported = new Set<Element>();
    for (const el of allElements()) {
      const own = ownText(el);
      if (!own.trim()) continue;
      const c = countLetters(own);
      if (c.rtl < 8 || rtlShare(c) < 0.7) continue;
      if (style(el).direction !== 'ltr' || !isVisible(el)) continue;
      const source = ltrSource(el);
      if (reported.has(source)) continue;
      reported.add(source);
      findings.push({
        rule: 'dir-attribute',
        severity: 'error',
        selector: cssPath(source),
        box: docBox(source.getBoundingClientRect()),
        message: `RTL text "${snippet(own)}" is inside a left-to-right block, so it aligns left and its punctuation lands on the wrong side.`,
        evidence: { direction: describeLtrSource(source) },
      });
    }
  }
  return findings;
}

/** The outermost element that made this element LTR (a dir attribute or a CSS direction change). */
function ltrSource(el: Element): Element {
  let source = el;
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
    if (style(e).direction !== 'ltr') break;
    source = e;
    if (e.hasAttribute('dir')) break;
  }
  return source;
}

function describeLtrSource(el: Element): string {
  const dir = el.getAttribute('dir');
  return dir ? `dir="${dir}" on ${cssPath(el)}` : `direction: ltr from CSS on ${cssPath(el)}`;
}

export function checkLang(counts: LetterCounts): RawFinding[] {
  const script = dominantRtlScript(counts);
  if (!script || counts.rtl < MIN_RTL_LETTERS) return [];
  const html = document.documentElement;
  const lang = (html.getAttribute('lang') || html.getAttribute('xml:lang') || '').trim();
  const suggestion = script === 'hebrew' ? 'he' : 'ar';
  if (!lang) {
    return [
      {
        rule: 'lang-attribute',
        severity: 'error',
        selector: 'html',
        message: `<html> has no lang attribute. Set lang="${suggestion}" (or the exact language, such as fa, ur or ${suggestion}-QA) so fonts, hyphenation and screen readers pick the right language.`,
        evidence: { html: '<html> without lang' },
      },
    ];
  }
  if (langMatchesScript(lang, script) === false) {
    return [
      {
        rule: 'lang-attribute',
        severity: 'error',
        selector: 'html',
        message: `lang="${lang}" does not match the page text, which is mostly ${SCRIPT_NAME[script]}. Use a matching language such as lang="${suggestion}".`,
        evidence: { html: `<html lang="${lang}">`, script: SCRIPT_NAME[script] },
      },
    ];
  }
  const better = isArabicTag(lang) ? notArabicLanguage(document.body.innerText) : null;
  if (better) {
    return [
      {
        rule: 'lang-attribute',
        severity: 'warning',
        selector: 'html',
        message: `lang="${lang}" says Arabic, but the text uses letters of ${better === 'ur' ? 'Urdu' : 'Persian'}. Use lang="${better}" so fonts and screen readers treat it correctly.`,
        evidence: { html: `<html lang="${lang}">`, suggestion: `lang="${better}"` },
      },
    ];
  }
  return [];
}
