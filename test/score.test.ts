import { describe, expect, it } from 'vitest';
import { percent, ratio, score, type PageResult } from '../scripts/score.ts';

const page = (over: Partial<PageResult>): PageResult => ({
  path: 'x.html',
  kind: 'bug',
  expect: [],
  allow: [],
  found: [],
  ...over,
});

describe('score', () => {
  it('counts a found expected rule as a true positive', () => {
    const s = score([page({ expect: ['bidi-order'], found: ['bidi-order'] })]);
    expect(s.overall).toMatchObject({ tp: 1, fp: 0, fn: 0, precision: 1, recall: 1 });
    expect(s.pages.passed).toBe(1);
  });

  it('counts a missed expected rule as a false negative', () => {
    const s = score([page({ path: 'a.html', expect: ['bidi-order'] })]);
    expect(s.overall).toMatchObject({ tp: 0, fn: 1, recall: 0 });
    expect(s.falseNegatives).toEqual([{ path: 'a.html', rule: 'bidi-order' }]);
    expect(s.pages.passed).toBe(0);
  });

  it('counts an unexpected rule as a false positive, on bug pages too', () => {
    const s = score([page({ path: 'a.html', expect: ['bidi-order'], found: ['bidi-order', 'text-clipped'] })]);
    expect(s.overall).toMatchObject({ tp: 1, fp: 1, precision: 0.5 });
    expect(s.perRule['text-clipped']).toMatchObject({ fp: 1, precision: 0 });
  });

  it('does not score allowed side effects either way', () => {
    const s = score([page({ expect: ['viewport-overflow'], allow: ['physical-css'], found: ['viewport-overflow', 'physical-css'] })]);
    expect(s.overall).toMatchObject({ tp: 1, fp: 0, fn: 0 });
    expect(s.perRule['physical-css']).toBeUndefined();
  });

  it('counts every rule that fires on a clean or fixed page as a false positive', () => {
    const s = score([
      page({ kind: 'clean', found: ['physical-css', 'bidi-order'] }),
      page({ kind: 'fixed', found: ['physical-css'] }),
    ]);
    expect(s.overall.fp).toBe(3);
    expect(s.overall.precision).toBe(0);
    expect(s.overall.recall).toBeNull();
    expect(s.pages).toMatchObject({ clean: 1, fixed: 1, passed: 0 });
  });

  it('counts one rule once per page however many findings it has', () => {
    const s = score([page({ expect: ['bidi-order'], found: ['bidi-order', 'bidi-order'] })]);
    expect(s.overall.tp).toBe(1);
  });
});

describe('helpers', () => {
  it('avoids dividing by zero', () => {
    expect(ratio(0, 0)).toBeNull();
    expect(percent(null)).toBe('n/a');
    expect(percent(0.9666)).toBe('96.7%');
  });
});
