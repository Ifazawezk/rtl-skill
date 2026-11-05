// bidi-order: measures where each character of an LTR run actually landed.
// A run reads correctly only if its characters go left to right on screen.
import { MIRRORED, findLtrIslands, isPhoneLike, type Island } from '../../shared/islands.ts';
import type { RawFinding } from '../../types.ts';
import { OVERLAY_ID, cssPath, isVisible, isVisuallyHidden, snippet, style, textNodes, unionBox } from '../dom.ts';

interface Glyph {
  ch: string;
  x: number;
  rect: DOMRect;
}

/** Text the browser lays out as one line of inline content, which may be several text nodes. */
interface Flow {
  text: string;
  nodes: Text[];
  starts: number[];
}

/** Elements that end a flow and whose content is not part of it. */
const OPAQUE = new Set(['br', 'hr', 'img', 'svg', 'math', 'input', 'select', 'textarea', 'video', 'canvas', 'iframe', 'object']);
const SKIP = new Set(['script', 'style', 'noscript', 'template']);

/**
 * Runs of inline text that span more than one text node: "+974 <b>5555</b> 1234",
 * or the separate nodes React writes for "{code} {number}". Blocks, inline-blocks,
 * flex items and line breaks all start a new flow.
 */
function inlineFlows(root: Element | null = document.body): Flow[] {
  const flows: Flow[] = [];
  let flow: Flow = { text: '', nodes: [], starts: [] };
  const end = () => {
    if (flow.nodes.length > 1) flows.push(flow);
    flow = { text: '', nodes: [], starts: [] };
  };
  const walk = (el: Element) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        flow.starts.push(flow.text.length);
        flow.nodes.push(child as Text);
        flow.text += (child as Text).data;
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const c = child as Element;
      if (SKIP.has(c.localName) || c.id === OVERLAY_ID) continue;
      if (OPAQUE.has(c.localName)) {
        end();
        continue;
      }
      const display = style(c).display;
      if (display === 'none') continue;
      const inline = display === 'inline' || display === 'contents';
      if (!inline) end();
      walk(c);
      if (!inline) end();
    }
  };
  if (root) walk(root);
  end();
  return flows;
}

/** The text nodes an island covers, with the part of each it covers. */
function pieces(flow: Flow, island: Island): { node: Text; start: number; end: number }[] {
  const out = [];
  for (let k = 0; k < flow.nodes.length; k++) {
    const start = Math.max(island.start, flow.starts[k]) - flow.starts[k];
    const end = Math.min(island.end, flow.starts[k] + flow.nodes[k].data.length) - flow.starts[k];
    if (end > start) out.push({ node: flow.nodes[k], start, end });
  }
  return out;
}

function measure(flow: Flow, island: Island): Glyph[] | null {
  const range = document.createRange();
  const glyphs: Glyph[] = [];
  for (const { node, start, end } of pieces(flow, island)) {
    for (let i = start; i < end; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rects = range.getClientRects();
      if (rects.length === 0) continue;
      const rect = rects[rects.length - 1];
      if (rect.width === 0) continue;
      glyphs.push({ ch: node.data[i], x: rect.left + rect.width / 2, rect });
    }
  }
  if (glyphs.length < 2) return null;
  // A run that wraps onto a second line has no single left-to-right order to test.
  const { top, height } = glyphs[0].rect;
  if (glyphs.some((g) => Math.abs(g.rect.top - top) > height / 2)) return null;
  return glyphs;
}

const isSpace = (ch: string) => /[\s\u00A0]/.test(ch);

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
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
}

function finding(island: Island, glyphs: Glyph[], el: Element): RawFinding {
  const rendered = visualText(glyphs);
  return {
    rule: 'bidi-order',
    severity: 'error',
    selector: cssPath(el),
    box: unionBox(glyphs.map((g) => g.rect)),
    message: `"${snippet(island.text)}" renders as "${snippet(rendered)}". Wrap it in <bdi dir="ltr"> or <span dir="ltr">.`,
    evidence: { source: island.text, rendered, kind: island.kind === 'phone' ? 'phone number' : 'Latin run' },
  };
}

const outOfOrder = (glyphs: Glyph[]) => isOutOfOrder(glyphs.filter((g) => !isSpace(g.ch)).map((g) => g.x));
const inTelLink = (node: Text) => Boolean(node.parentElement?.closest('a[href^="tel:"]'));

export function checkBidi(): RawFinding[] {
  const findings: RawFinding[] = [];
  // Islands already found inside a single text node, so the flow pass below doesn't report them twice.
  const seen = new Map<Text, Island[]>();
  for (const node of textNodes()) {
    const parent = node.parentElement!;
    if (style(parent).direction !== 'rtl') continue;
    if (!isVisible(parent) || isVisuallyHidden(parent)) continue;
    const islands = findLtrIslands(node.data, { telContext: inTelLink(node) });
    seen.set(node, islands);
    for (const island of islands) {
      const glyphs = measure({ text: node.data, nodes: [node], starts: [0] }, island);
      if (glyphs && outOfOrder(glyphs)) findings.push(finding(island, glyphs, parent));
    }
  }
  // Runs split across nodes, which no single node shows in full.
  for (const flow of inlineFlows()) {
    const tel = flow.nodes.some(inTelLink);
    for (const island of findLtrIslands(flow.text, { telContext: tel })) {
      const parts = pieces(flow, island);
      if (parts.length < 2) continue;
      if (parts.some((p) => seen.get(p.node)?.some((s) => s.start < p.end && p.start < s.end))) continue;
      if (island.kind === 'phone' && !parts.every((p) => inTelLink(p.node)) && !isPhoneLike(island.text)) continue;
      const parents = parts.map((p) => p.node.parentElement!);
      if (style(parents[0]).direction !== 'rtl') continue;
      if (parents.some((el) => !isVisible(el) || isVisuallyHidden(el))) continue;
      const glyphs = measure(flow, island);
      if (!glyphs || !outOfOrder(glyphs)) continue;
      let common = parents[0];
      while (common.parentElement && !parents.every((el) => common.contains(el))) common = common.parentElement;
      findings.push(finding(island, glyphs, common));
    }
  }
  return findings;
}
