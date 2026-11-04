import { describe, expect, it } from 'vitest';
import { RULES, RULE_IDS, getRule, parseRuleList } from '../src/rules.ts';

describe('rule registry', () => {
  it('has one entry per id, keyed by its own id', () => {
    expect(Object.keys(RULES).sort()).toEqual([...RULE_IDS].sort());
    for (const id of RULE_IDS) expect(RULES[id].id).toBe(id);
  });

  it('uses kebab-case ids and fills every field', () => {
    for (const rule of Object.values(RULES)) {
      expect(rule.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(['error', 'warning']).toContain(rule.severity);
      for (const field of ['title', 'summary', 'how', 'fix', 'skillSection'] as const) {
        expect(rule[field].length, `${rule.id}.${field}`).toBeGreaterThan(3);
      }
    }
  });

  it('parses rule lists and rejects unknown ids', () => {
    expect(parseRuleList('bidi-order, physical-css')).toEqual(['bidi-order', 'physical-css']);
    expect(() => parseRuleList('bidi-order,nope')).toThrow(/Unknown rule "nope"/);
    expect(getRule('nope')).toBeUndefined();
  });
});
