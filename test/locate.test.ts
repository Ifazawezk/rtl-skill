import { describe, expect, it } from 'vitest';
import { findDeclarationOffset, lineOf, styleBlocks } from '../src/locate.ts';
import { isSymmetricShorthand, logicalFor } from '../src/page/checks/layout.ts';

describe('findDeclarationOffset', () => {
  const css = '.a { color: red; }\n.btn > .icon {\n  margin-right: 8px;\n}\n@media (min-width: 600px) {\n  .a{margin-left:4px}\n}\n';

  it('finds a declaration under a selector written with different spacing', () => {
    const off = findDeclarationOffset(css, '.btn > .icon', 'margin-right');
    expect(lineOf(css, off)).toBe(3);
    expect(css.slice(off, off + 12)).toBe('margin-right');
  });

  it('finds rules nested in @media', () => {
    expect(lineOf(css, findDeclarationOffset(css, '.a', 'margin-left'))).toBe(6);
  });

  it('matches attribute selectors with or without quotes', () => {
    const text = '[dir=rtl] .x { padding-left: 2px }';
    expect(findDeclarationOffset(text, '[dir="rtl"] .x', 'padding-left')).toBe(15);
  });

  it('returns -1 when the selector is not there', () => {
    expect(findDeclarationOffset(css, '.nope', 'margin-left')).toBe(-1);
  });
});

describe('styleBlocks', () => {
  it('returns the offset of each style element body', () => {
    const html = '<head>\n<style>\n.a{}\n</style><style media="print">.b{}</style>';
    const blocks = styleBlocks(html);
    expect(blocks).toHaveLength(2);
    expect(html.slice(blocks[1].start, blocks[1].start + 4)).toBe('.b{}');
  });
});

describe('isSymmetricShorthand', () => {
  it.each([
    ['padding', '16px 20px', true],
    ['margin', '0px auto', true],
    ['padding', '8px', true],
    ['padding', '4px 8px 12px', true],
    ['margin', '0px 16px 0px 0px', false],
    ['padding-left', '8px', false],
  ])('%s: %s -> %s', (property, value, expected) => {
    expect(isSymmetricShorthand(property, value)).toBe(expected);
  });
});

describe('logicalFor', () => {
  it.each([
    ['margin-right', '8px', 'margin-inline-end: 8px'],
    ['left', '0px', 'inset-inline-start: 0px'],
    ['text-align', 'left', 'text-align: start'],
    ['float', 'right', 'float: inline-end'],
    ['margin', '0px 16px 0px 0px', 'margin-block: 0px; margin-inline: 0px 16px'],
    ['padding', '4px 8px', 'padding-block: 4px; padding-inline: 8px'],
  ])('%s: %s -> %s', (prop, value, expected) => {
    expect(logicalFor(prop, value)).toBe(expected);
  });
});
