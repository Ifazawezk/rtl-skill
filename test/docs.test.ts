import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_IDS } from '../src/rules.ts';
import { packageRoot } from '../src/skill/files.ts';

const root = packageRoot();
const read = (name: string) => readFileSync(join(root, name), 'utf8');
const readme = read('README.md');
const contributing = read('CONTRIBUTING.md');

describe('README', () => {
  it('lists every rule', () => {
    for (const id of RULE_IDS) expect(readme, id).toContain(`\`${id}\``);
    expect(readme).not.toContain('{{');
  });

  it('points at files that exist', () => {
    const links = [...readme.matchAll(/(?:src="|\]\()((?:docs|demo|bench|skills|cursor|codex)[^")#]*)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(8);
    for (const link of links) expect(existsSync(join(root, link)), link).toBe(true);
  });

  it('quotes the measured numbers exactly', () => {
    const first = read('bench/holdout-first-run.md');
    const second = read('bench/holdout-2-first-run.md');
    const results = JSON.parse(read('bench/results.json'));
    expect(first).toContain('**16** | **1** | **9** | **94.1%** | **64.0%**');
    expect(second).toContain('**19** | **0** | **1** | **100.0%** | **95.0%**');
    expect(readme).toContain('| 40 | 16 | 1 | 9 | **94.1%** | **64.0%** |');
    expect(readme).toContain('| 36 | 19 | 0 | 1 | **100.0%** | **95.0%** |');
    const pages = results.pages.bug + results.pages.fixed + results.pages.clean;
    expect(readme).toContain(`| ${pages} | ${results.overall.tp} | 0 | 0 | 100.0% | 100.0% |`);
  });

  it('quotes the demo result exactly', () => {
    const summary = read('docs/demo/buggy-report.txt').trim().split('\n').pop();
    expect(summary).toBe('9 errors, 10 warnings');
    expect(readme).toContain('9 errors and 10 warnings');
    const report = read('docs/demo/buggy-report.txt');
    const sample = /```text\n(rtl-check[\s\S]*?)```/.exec(readme)![1];
    for (const line of sample.split('\n').filter((l) => /^ {6}\S|^ +\d+ {2}(error|warning)/.test(l))) {
      expect(report, line).toContain(line);
    }
    expect(read('docs/demo/fixed-report.txt')).toContain('no RTL problems found');
  });
});

describe('project text', () => {
  it.each(['README.md', 'CONTRIBUTING.md'])('%s keeps the house style', (name) => {
    const text = read(name);
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('carries the license notice', () => {
    expect(read('LICENSE')).toContain('Copyright (c) 2026 Mohaned Elhagar');
    expect(contributing).toContain('Every commit leaves tests passing');
  });
});
