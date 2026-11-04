// Copies the skill into a project, or into the home folder with --global.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { generated } from './skill/files.ts';
import { mergeAgentsSection, type Target } from './skill/generate.ts';

export const TOOLS = ['claude', 'cursor', 'codex'] as const;
export type Tool = (typeof TOOLS)[number];

export interface InstallOptions {
  /** Project folder. Defaults to the current folder. */
  dir?: string;
  /** Install for the user instead of one project. */
  global?: boolean;
  /** Home folder, replaceable in tests. */
  home?: string;
}

export interface InstallResult {
  tool: Tool;
  path: string;
  action: 'created' | 'updated' | 'unchanged';
}

const TARGET: Record<Tool, Target> = { claude: 'skill', cursor: 'cursor', codex: 'agents' };

export function installPath(tool: Tool, options: InstallOptions = {}): string {
  const project = resolve(options.dir ?? '.');
  const home = options.home ?? homedir();
  if (tool === 'claude') return join(options.global ? home : project, '.claude', 'skills', 'rtl', 'SKILL.md');
  if (tool === 'cursor') {
    if (options.global) throw new Error('Cursor has no global rules folder. Install it per project, without --global.');
    return join(project, '.cursor', 'rules', 'rtl.mdc');
  }
  return options.global ? join(home, '.codex', 'AGENTS.md') : join(project, 'AGENTS.md');
}

export function install(tool: Tool, options: InstallOptions = {}): InstallResult {
  const path = installPath(tool, options);
  const existing = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
  const text = generated(TARGET[tool]);
  const next = tool === 'codex' ? mergeAgentsSection(existing, text) : text;
  if (existing === next) return { tool, path, action: 'unchanged' };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  return { tool, path, action: existing === null ? 'created' : 'updated' };
}
