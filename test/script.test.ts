import { describe, expect, it } from 'vitest';
import {
  countLetters,
  dominantRtlScript,
  hasJoiningLetters,
  isRtlLanguage,
  langMatchesScript,
  notArabicLanguage,
  rtlShare,
} from '../src/shared/script.ts';

describe('countLetters', () => {
  it('counts Arabic, Hebrew and Latin letters and ignores digits and spaces', () => {
    const c = countLetters('مرحبا Hello שלום 123');
    expect(c).toEqual({ rtl: 9, ltr: 5, arabic: 5, hebrew: 4 });
    expect(rtlShare(c)).toBeCloseTo(9 / 14);
  });

  it('treats Persian and Urdu letters as Arabic script', () => {
    expect(countLetters('گچپژ').arabic).toBe(4);
    expect(countLetters('ٹڈڑ').arabic).toBe(3);
  });

  it('does not count Arabic-Indic digits as letters', () => {
    expect(countLetters('١٢٣٤٥').rtl).toBe(0);
  });
});

describe('dominantRtlScript', () => {
  it('returns null when Latin dominates', () => {
    expect(dominantRtlScript(countLetters('Welcome to Doha مرحبا'))).toBeNull();
  });
  it('finds Arabic and Hebrew', () => {
    expect(dominantRtlScript(countLetters('أهلا وسهلا في الدوحة'))).toBe('arabic');
    expect(dominantRtlScript(countLetters('ברוכים הבאים'))).toBe('hebrew');
  });
});

describe('hasJoiningLetters', () => {
  it('is true for Arabic script and false for Hebrew', () => {
    expect(hasJoiningLetters('سلام')).toBe(true);
    expect(hasJoiningLetters('שלום')).toBe(false);
    expect(hasJoiningLetters('SALE 50%')).toBe(false);
  });
});

describe('isRtlLanguage', () => {
  it.each([
    ['ar', true],
    ['ar-QA', true],
    ['fa-IR', true],
    ['ur', true],
    ['he', true],
    ['iw', true],
    ['ckb', true],
    ['ku', false],
    ['ku-Arab', true],
    ['pa-Arab-PK', true],
    ['az-Latn', false],
    ['en', false],
    ['en-US', false],
    ['', false],
  ])('%s -> %s', (tag, rtl) => {
    expect(isRtlLanguage(tag)).toBe(rtl);
  });
});

describe('notArabicLanguage', () => {
  it('recognizes Urdu and Persian text marked as Arabic', () => {
    expect(notArabicLanguage('آپ کا آرڈر دو دن میں پہنچ جائے گا اور ہم آپ کو پیغام بھیجیں گے')).toBe('ur');
    expect(notArabicLanguage('سفارش شما تا دو روز کاری به دست شما می‌رسد و پیگیری می‌کنیم')).toBe('fa');
  });
  it('accepts Arabic, including the odd loan letter', () => {
    expect(notArabicLanguage('مرحبا بكم في متجر الدوحة للإلكترونيات، نتمنى لكم تسوقا ممتعا')).toBeNull();
    expect(notArabicLanguage('سافر محمد إلى باريس ثم إلى براغ لزيارة صديقه القديم هناك')).toBeNull();
    expect(notArabicLanguage('قصير')).toBeNull();
  });
});

describe('langMatchesScript', () => {
  it('matches Arabic-script languages with Arabic text', () => {
    expect(langMatchesScript('ar-QA', 'arabic')).toBe(true);
    expect(langMatchesScript('fa', 'arabic')).toBe(true);
    expect(langMatchesScript('en', 'arabic')).toBe(false);
    expect(langMatchesScript('he', 'arabic')).toBe(false);
  });
  it('matches Hebrew-script languages with Hebrew text', () => {
    expect(langMatchesScript('he-IL', 'hebrew')).toBe(true);
    expect(langMatchesScript('ar', 'hebrew')).toBe(false);
  });
});
