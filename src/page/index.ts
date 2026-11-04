// Entry point of the in-page runtime. esbuild bundles this file into one
// script that the checker injects into the page under test.
import type { RuleId } from '../rules.ts';
import type { RawFinding } from '../types.ts';
import { checkDir, checkLang, pageLetters } from './checks/document.ts';
import { allElements } from './dom.ts';

function info() {
  const html = document.documentElement;
  const counts = pageLetters();
  return {
    title: document.title,
    dir: html.getAttribute('dir'),
    lang: html.getAttribute('lang'),
    direction: (getComputedStyle(html).direction === 'rtl' || (document.body && getComputedStyle(document.body).direction === 'rtl')
      ? 'rtl'
      : 'ltr') as 'rtl' | 'ltr',
    rtlLetters: counts.rtl,
    ltrLetters: counts.ltr,
    viewport: { width: html.clientWidth, height: window.innerHeight },
    elements: allElements().length,
  };
}

/** Checks that need only the page as rendered. */
function checks(rules: RuleId[]): RawFinding[] {
  const on = (id: RuleId) => rules.length === 0 || rules.includes(id);
  const counts = pageLetters();
  const findings: RawFinding[] = [];
  if (on('dir-attribute')) findings.push(...checkDir(counts));
  if (on('lang-attribute')) findings.push(...checkLang(counts));
  return findings;
}

const api = { version: 1, info, checks };

export type RuntimeApi = typeof api;

declare global {
  interface Window {
    __rtlCheck: RuntimeApi;
  }
}

window.__rtlCheck = api;
