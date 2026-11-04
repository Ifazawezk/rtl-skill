// Turns "<style> #1, .card .icon, margin-right" into "page.html:23" for local
// files, so a finding points at the line to change.
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Finding } from './types.ts';

const normalize = (s: string) =>
  s
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([>+~,])\s*/g, '$1')
    .trim()
    .toLowerCase();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Offset of the declaration inside a CSS text, or -1. */
export function findDeclarationOffset(css: string, selector: string, property: string): number {
  const want = normalize(selector);
  const block = /([^{}]+)\{([^{}]*)\}/g;
  const prop = new RegExp(`(^|[;\\s{])${escapeRe(property)}\\s*:`, 'i');
  let fallback = -1;
  for (let m = block.exec(css); m; m = block.exec(css)) {
    if (normalize(m[1]) !== want) continue;
    const bodyStart = m.index + m[1].length + 1;
    const p = prop.exec(m[2]);
    if (p) return bodyStart + p.index + p[1].length;
    if (fallback === -1) fallback = m.index + (m[1].length - m[1].trimStart().length);
  }
  return fallback;
}

export function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Offsets of the contents of each <style> element in an HTML source. */
export function styleBlocks(html: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    out.push({ start: m.index + m[0].indexOf('>') + 1, text: m[1] });
  }
  return out;
}

function localPath(url: string): string | null {
  if (!url.startsWith('file:')) return null;
  try {
    const p = fileURLToPath(url);
    return existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

/**
 * Adds `at: file:line` to CSS findings when the page and its stylesheets are
 * local files, and drops the internal fields the page runtime used to find them.
 */
export function locateFindings(findings: Finding[], pageUrl: string, cwd = process.cwd()): Finding[] {
  const pagePath = localPath(pageUrl);
  const pageHtml = pagePath ? readFileSync(pagePath, 'utf8') : null;
  const blocks = pageHtml ? styleBlocks(pageHtml) : [];
  return findings.map((f) => {
    const ev = f.evidence;
    if (!ev || (ev.styleIndex === undefined && ev.href === undefined)) return f;
    const { styleIndex, href, ...rest } = ev;
    const m = /^(.*) \{ ([\w-]+): /.exec(ev.css ?? '');
    if (m) {
      const [, selector, property] = m;
      if (styleIndex !== undefined && pagePath && pageHtml) {
        const block = blocks[Number(styleIndex)];
        const off = block ? findDeclarationOffset(block.text, selector, property) : -1;
        if (off !== -1) {
          rest.at = `${rel(pagePath, cwd)}:${lineOf(pageHtml, block.start + off)}`;
          delete rest.source;
        }
      } else if (href) {
        const cssPath = localPath(href);
        if (cssPath) {
          const css = readFileSync(cssPath, 'utf8');
          const off = findDeclarationOffset(css, selector, property);
          if (off !== -1) {
            rest.at = `${rel(cssPath, cwd)}:${lineOf(css, off)}`;
            delete rest.source;
          }
        }
      }
    }
    return { ...f, evidence: rest };
  });
}

function rel(path: string, cwd: string): string {
  const r = relative(cwd, path);
  return (r.startsWith('..') ? path : r).replace(/\\/g, '/');
}
