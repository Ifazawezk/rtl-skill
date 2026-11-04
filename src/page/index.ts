// Entry point of the in-page runtime. esbuild bundles this file into one
// script that the checker injects into the page under test.
import type { RuleId } from '../rules.ts';
import type { RawFinding } from '../types.ts';
import { checkBidi } from './checks/bidi.ts';
import { checkDir, checkLang, pageLetters } from './checks/document.ts';
import { checkInputs } from './checks/inputs.ts';
import { checkIcons } from './checks/icons.ts';
import { flip, layoutChecks, snapshotLtr, snapshotRtl, unflip } from './checks/layout.ts';
import { checkClipped, checkLetterSpacing, checkOverflow } from './checks/text.ts';
import { resetCssCache } from './css.ts';
import { allElements } from './dom.ts';
import { clearOverlay, drawOverlay } from './overlay.ts';

function info() {
  const html = document.documentElement;
  const counts = pageLetters();
  const rtl = getComputedStyle(html).direction === 'rtl' || (document.body && getComputedStyle(document.body).direction === 'rtl');
  return {
    title: document.title,
    dir: html.getAttribute('dir'),
    lang: html.getAttribute('lang'),
    direction: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    rtlLetters: counts.rtl,
    ltrLetters: counts.ltr,
    viewport: { width: html.clientWidth, height: window.innerHeight },
    elements: allElements().length,
  };
}

/** Checks that need only the page as rendered. */
function checks(rules: RuleId[]): RawFinding[] {
  const on = (id: RuleId) => rules.length === 0 || rules.includes(id);
  resetCssCache();
  const counts = pageLetters();
  const findings: RawFinding[] = [];
  if (on('dir-attribute')) findings.push(...checkDir(counts));
  if (on('lang-attribute')) findings.push(...checkLang(counts));
  if (on('bidi-order')) findings.push(...checkBidi());
  if (on('ltr-input')) findings.push(...checkInputs());
  if (on('icon-mirroring')) findings.push(...checkIcons());
  if (on('viewport-overflow')) findings.push(...checkOverflow());
  if (on('text-clipped')) findings.push(...checkClipped());
  if (on('arabic-letter-spacing')) findings.push(...checkLetterSpacing());
  return findings;
}

const api = {
  version: 1,
  info,
  checks,
  snapshotRtl,
  flip,
  snapshotLtr,
  unflip,
  layoutChecks,
  drawOverlay,
  clearOverlay,
};

export type RuntimeApi = typeof api;

declare global {
  interface Window {
    __rtlCheck: RuntimeApi;
  }
}

window.__rtlCheck = api;
