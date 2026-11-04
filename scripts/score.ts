// Scores checker output against fixture expectations.
//
// The unit is one rule on one page. On a bug page, an expected rule that fires
// is a true positive and one that stays silent is a false negative. Any rule
// that fires and is neither expected nor allowed is a false positive. Fixed and
// clean pages expect nothing, so every rule that fires there is a false positive.
// Rules listed as allowed are real side effects of the bug and are not scored.
import type { RuleId } from '../src/rules.ts';

export interface PageResult {
  path: string;
  kind: 'bug' | 'fixed' | 'clean';
  expect: RuleId[];
  allow: RuleId[];
  found: RuleId[];
}

export interface Tally {
  tp: number;
  fp: number;
  fn: number;
}

export interface Score extends Tally {
  precision: number | null;
  recall: number | null;
}

export function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

const withRates = (t: Tally): Score => ({
  ...t,
  precision: ratio(t.tp, t.tp + t.fp),
  recall: ratio(t.tp, t.tp + t.fn),
});

export interface Scored {
  overall: Score;
  perRule: Record<string, Score>;
  falsePositives: { path: string; rule: RuleId }[];
  falseNegatives: { path: string; rule: RuleId }[];
  pages: { bug: number; fixed: number; clean: number; passed: number };
}

export function score(results: PageResult[]): Scored {
  const tallies = new Map<string, Tally>();
  const tally = (rule: string) => {
    let t = tallies.get(rule);
    if (!t) tallies.set(rule, (t = { tp: 0, fp: 0, fn: 0 }));
    return t;
  };
  const overall: Tally = { tp: 0, fp: 0, fn: 0 };
  const falsePositives: Scored['falsePositives'] = [];
  const falseNegatives: Scored['falseNegatives'] = [];
  const pages = { bug: 0, fixed: 0, clean: 0, passed: 0 };

  for (const page of results) {
    pages[page.kind]++;
    const found = new Set(page.found);
    let ok = true;
    for (const rule of page.expect) {
      if (found.has(rule)) {
        tally(rule).tp++;
        overall.tp++;
      } else {
        tally(rule).fn++;
        overall.fn++;
        falseNegatives.push({ path: page.path, rule });
        ok = false;
      }
    }
    const allowed = new Set([...page.expect, ...page.allow]);
    for (const rule of found) {
      if (allowed.has(rule)) continue;
      tally(rule).fp++;
      overall.fp++;
      falsePositives.push({ path: page.path, rule });
      ok = false;
    }
    if (ok) pages.passed++;
  }

  const perRule: Record<string, Score> = {};
  for (const [rule, t] of [...tallies].sort(([a], [b]) => a.localeCompare(b))) perRule[rule] = withRates(t);
  return { overall: withRates(overall), perRule, falsePositives, falseNegatives, pages };
}

export const percent = (r: number | null) => (r === null ? 'n/a' : `${(r * 100).toFixed(1)}%`);
