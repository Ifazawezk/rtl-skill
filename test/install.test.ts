import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { main, type CliIO } from '../src/cli.ts';
import { install, installPath } from '../src/install.ts';
import { AGENTS_END, AGENTS_START } from '../src/skill/generate.ts';

const root = mkdtempSync(join(tmpdir(), 'rtl-install-'));
let n = 0;
const project = () => {
  const dir = join(root, `p${n++}`);
  mkdirSync(dir);
  return dir;
};

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('install', () => {
  it('puts the Claude Code skill where Claude Code looks for it', () => {
    const dir = project();
    const result = install('claude', { dir });
    expect(result.action).toBe('created');
    expect(result.path).toBe(join(dir, '.claude', 'skills', 'rtl', 'SKILL.md'));
    expect(readFileSync(result.path, 'utf8')).toMatch(/^---\nname: rtl\n/);
  });

  it('puts the Cursor rule in .cursor/rules', () => {
    const dir = project();
    const result = install('cursor', { dir });
    expect(result.path).toBe(join(dir, '.cursor', 'rules', 'rtl.mdc'));
    expect(readFileSync(result.path, 'utf8')).toMatch(/^---\ndescription: /);
  });

  it('creates AGENTS.md for Codex', () => {
    const dir = project();
    const result = install('codex', { dir });
    expect(result.path).toBe(join(dir, 'AGENTS.md'));
    expect(readFileSync(result.path, 'utf8').startsWith(AGENTS_START)).toBe(true);
  });

  it('keeps the notes already in AGENTS.md and does not duplicate the section', () => {
    const dir = project();
    const file = join(dir, 'AGENTS.md');
    writeFileSync(file, '# Project\n\nUse pnpm.\n');
    expect(install('codex', { dir }).action).toBe('updated');
    const first = readFileSync(file, 'utf8');
    expect(first.startsWith('# Project\n\nUse pnpm.\n\n')).toBe(true);
    expect(first.split(AGENTS_START)).toHaveLength(2);
    expect(install('codex', { dir }).action).toBe('unchanged');
    expect(readFileSync(file, 'utf8')).toBe(first);
  });

  it('replaces an old section in place and keeps what follows it', () => {
    const dir = project();
    const file = join(dir, 'AGENTS.md');
    writeFileSync(file, `# Project\n\n${AGENTS_START}\nSTALE-SECTION\n${AGENTS_END}\n\nFooter.\n`);
    install('codex', { dir });
    const text = readFileSync(file, 'utf8');
    expect(text).not.toContain('STALE-SECTION');
    expect(text.endsWith('\n\nFooter.\n')).toBe(true);
  });

  it('reports an up-to-date install as unchanged', () => {
    const dir = project();
    install('claude', { dir });
    expect(install('claude', { dir }).action).toBe('unchanged');
  });

  it('installs into the home folder with --global', () => {
    const home = project();
    expect(installPath('claude', { global: true, home })).toBe(join(home, '.claude', 'skills', 'rtl', 'SKILL.md'));
    expect(installPath('codex', { global: true, home })).toBe(join(home, '.codex', 'AGENTS.md'));
    expect(() => installPath('cursor', { global: true, home })).toThrow(/per project/);
  });
});

describe('rtl-skill install command', () => {
  const run = async (args: string[]) => {
    let out = '';
    let err = '';
    const io: CliIO = { out: (s) => (out += s), err: (s) => (err += s), isTTY: false };
    return { code: await main(args, io, 'rtl-skill'), out, err };
  };

  it('installs and says where', async () => {
    const dir = project();
    const { code, out } = await run(['install', 'claude', '--dir', dir]);
    expect(code).toBe(0);
    expect(out).toContain('created');
    expect(existsSync(join(dir, '.claude', 'skills', 'rtl', 'SKILL.md'))).toBe(true);
  });

  it('rejects unknown tools and impossible requests', async () => {
    expect((await run(['install', 'emacs'])).code).toBe(2);
    expect((await run(['install'])).code).toBe(2);
    expect((await run(['install', 'cursor', '--global'])).code).toBe(2);
  });
});
