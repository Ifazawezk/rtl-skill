import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES } from '../src/rules.ts';
import {
  AGENTS_END,
  AGENTS_START,
  OUTPUT_PATHS,
  TARGETS,
  demoteHeadings,
  filterForTarget,
  headingSlugs,
  mergeAgentsSection,
  render,
  slugify,
} from '../src/skill/generate.ts';
import { packageRoot, readSource } from '../src/skill/files.ts';

const root = packageRoot();
const { guide, meta } = readSource(root);
const onDisk = (target: (typeof TARGETS)[number]) =>
  readFileSync(join(root, OUTPUT_PATHS[target]), 'utf8').replace(/\r\n/g, '\n');

describe('generated skill files', () => {
  it.each(TARGETS)('%s file matches skill-src (run npm run skill if this fails)', (target) => {
    expect(onDisk(target)).toBe(render(target, guide, meta));
  });

  it('SKILL.md has valid Claude Code frontmatter', () => {
    const text = onDisk('skill');
    const m = /^---\nname: ([a-z0-9-]+)\ndescription: (".*")\n---\n/.exec(text);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('rtl');
    const description = JSON.parse(m![2]) as string;
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toMatch(/Arabic/);
  });

  it('the Cursor rule has description, globs and alwaysApply', () => {
    const head = onDisk('cursor').split('---')[1];
    expect(head).toMatch(/\ndescription: .+\n/);
    expect(head).toMatch(/\nglobs: \*\*\/\*\.html, .*\*\*\/\*\.tsx/);
    expect(head).toMatch(/\nalwaysApply: false\n/);
  });

  it('the AGENTS.md section is wrapped in markers and stays small', () => {
    const text = onDisk('agents');
    expect(text.startsWith(AGENTS_START)).toBe(true);
    expect(text.trimEnd().endsWith(AGENTS_END)).toBe(true);
    expect(text).toMatch(/\n## Right-to-left \(RTL\) interfaces\n/);
    expect(text).not.toMatch(/\n# /);
    // Codex reads at most 32 KiB of AGENTS.md by default; leave room for the project's own notes.
    expect(Buffer.byteLength(text)).toBeLessThan(24 * 1024);
  });

  it('every checker rule links to a section that exists in each output', () => {
    for (const target of TARGETS) {
      const slugs = new Set(headingSlugs(onDisk(target)));
      for (const rule of Object.values(RULES)) {
        expect(slugs.has(rule.skillSection), `${target}: ${rule.id} -> #${rule.skillSection}`).toBe(true);
      }
    }
  });

  it('keeps code samples readable: no invisible direction characters', () => {
    for (const text of [guide, ...TARGETS.map(onDisk)]) {
      expect(text).not.toMatch(/[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\u00A0]/);
    }
  });

  it('keeps the house style: no em dashes, en dashes or emoji', () => {
    for (const text of [guide, ...TARGETS.map(onDisk)]) {
      expect(text).not.toMatch(/[–—]/);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('generator helpers', () => {
  it('filters only-blocks per target', () => {
    const src = 'a\n<!-- only: skill, cursor -->\nb\n<!-- end only -->\nc\n';
    expect(filterForTarget(src, 'skill')).toBe('a\nb\nc\n');
    expect(filterForTarget(src, 'agents')).toBe('a\nc\n');
    expect(() => filterForTarget('<!-- only: web -->\nx\n<!-- end only -->', 'skill')).toThrow(/unknown target/);
    expect(() => filterForTarget('<!-- only: skill -->\nx\n', 'skill')).toThrow(/not closed/);
  });

  it('demotes headings but not comments inside code fences', () => {
    expect(demoteHeadings('# A\n```sh\n# comment\n```\n## B')).toBe('## A\n```sh\n# comment\n```\n### B');
  });

  it('builds GitHub-style slugs', () => {
    expect(slugify('Icons: mirror or not')).toBe('icons-mirror-or-not');
    expect(slugify('Numbers, phone numbers, code and URLs inside RTL text')).toBe(
      'numbers-phone-numbers-code-and-urls-inside-rtl-text',
    );
  });

  it('merges the AGENTS.md section without touching other text', () => {
    const section = `${AGENTS_START}\nnew\n${AGENTS_END}\n`;
    expect(mergeAgentsSection(null, section)).toBe(section);
    const appended = mergeAgentsSection('# Project\n\nUse pnpm.\n', section);
    expect(appended).toBe(`# Project\n\nUse pnpm.\n\n${section}`);
    const old = `# Project\n\n${AGENTS_START}\nold\n${AGENTS_END}\n\nMore notes.\n`;
    const replaced = mergeAgentsSection(old, section);
    expect(replaced).toBe(`# Project\n\n${AGENTS_START}\nnew\n${AGENTS_END}\n\nMore notes.\n`);
    expect(mergeAgentsSection(replaced, section)).toBe(replaced);
  });
});
