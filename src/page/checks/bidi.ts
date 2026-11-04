// bidi-order: measures where each character of an LTR run actually landed.
// A run reads correctly only if its characters go left to right on screen.
import { MIRRORED, findLtrIslands, type Island } from '../../shared/islands.ts';
import type { RawFinding } from '../../types.ts';
import { cssPath, isVisible, isVisuallyHidden, snippet, style, textNodes, unionBox } from '../dom.ts';

interface Glyph {
  ch: string;
  x: number;
  rect: DOMRect;
}

function measure(node: Text, island: Island): Glyph[] | null {
  const range = document.createRange();
  const glyphs: Glyph[] = [];
  for (let i = island.start; i < island.end; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rects = range.getClientRects();
    if (rects.length === 0) continue;
    const rect = rects[rects.length - 1];
    if (rect.width === 0) continue;
    glyphs.push({ ch: node.data[i], x: rect.left + rect.width / 2, rect });
  }
  if (glyphs.length < 2) return null;
  // A run that wraps onto a second line has no single left-to-right order to test.
  const { top, height } = glyphs[0].rect;
  if (glyphs.some((g) => Math.abs(g.rect.top - top) > height / 2)) return null;
  return glyphs;
}

const isSpace = (ch: string) => /[\s ]/.test(ch);

export function isOutOfOrder(xs: number[]): boolean {
  for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1] - 0.5) return true;
  return false;
}

/** The run as a person sees it, read left to right, with mirrored brackets drawn mirrored. */
export function visualText(glyphs: { ch: string; x: number }[]): string {
  const solid = glyphs.filter((g) => !isSpace(g.ch));
  const reversed = new Set(
    solid.filter((g, i) => (i > 0 && solid[i - 1].x > g.x) || (i + 1 < solid.length && solid[i + 1].x < g.x)),
  );
  return [...glyphs]
    .sort((a, b) => a.x - b.x)
    .map((g) => (reversed.has(g) && MIRRORED[g.ch] ? MIRRORED[g.ch] : g.ch))
    .join('')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

export function checkBidi(): RawFinding[] {
  const findings: RawFinding[] = [];
  for (const node of textNodes()) {
    const parent = node.parentElement!;
    if (style(parent).direction !== 'rtl') continue;
    if (!isVisible(parent) || isVisuallyHidden(parent)) continue;
    const telContext = Boolean(parent.closest('a[href^="tel:"]'));
    for (const island of findLtrIslands(node.data, { telContext })) {
      const glyphs = measure(node, island);
      if (!glyphs) continue;
      if (!isOutOfOrder(glyphs.filter((g) => !isSpace(g.ch)).map((g) => g.x))) continue;
      const rendered = visualText(glyphs);
      findings.push({
        rule: 'bidi-order',
        severity: 'error',
        selector: cssPath(parent),
        box: unionBox(glyphs.map((g) => g.rect)),
        message: `"${snippet(island.text)}" renders as "${snippet(rendered)}". Wrap it in <bdi dir="ltr"> or <span dir="ltr">.`,
        evidence: { source: island.text, rendered, kind: island.kind === 'phone' ? 'phone number' : 'Latin run' },
      });
    }
  }
  return findings;
}
