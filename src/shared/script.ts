// Script and language helpers. Pure functions: they run in Node for tests and
// in the page as part of the checker runtime.

/** Letters of scripts written right to left. */
const RTL_LETTER =
  /(?=\p{L})(?:\p{Script=Arabic}|\p{Script=Hebrew}|\p{Script=Syriac}|\p{Script=Thaana}|\p{Script=Nko}|\p{Script=Adlam}|\p{Script=Samaritan}|\p{Script=Mandaic}|\p{Script=Hanifi_Rohingya})/u;
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/u;
const HEBREW_LETTER = /(?=\p{L})\p{Script=Hebrew}/u;
/** Scripts whose letters join, where letter-spacing breaks words apart. */
const JOINING_LETTER = /(?=\p{L})(?:\p{Script=Arabic}|\p{Script=Syriac}|\p{Script=Nko}|\p{Script=Adlam}|\p{Script=Mandaic}|\p{Script=Hanifi_Rohingya})/u;
const ANY_LETTER = /\p{L}/u;

export interface LetterCounts {
  rtl: number;
  ltr: number;
  arabic: number;
  hebrew: number;
}

export function countLetters(text: string): LetterCounts {
  const counts: LetterCounts = { rtl: 0, ltr: 0, arabic: 0, hebrew: 0 };
  for (const ch of text) {
    if (!ANY_LETTER.test(ch)) continue;
    if (RTL_LETTER.test(ch)) {
      counts.rtl++;
      if (ARABIC_LETTER.test(ch)) counts.arabic++;
      else if (HEBREW_LETTER.test(ch)) counts.hebrew++;
    } else {
      counts.ltr++;
    }
  }
  return counts;
}

/** Share of letters that belong to RTL scripts, 0 when there are no letters. */
export function rtlShare(counts: LetterCounts): number {
  const total = counts.rtl + counts.ltr;
  return total === 0 ? 0 : counts.rtl / total;
}

export function hasRtlLetters(text: string): boolean {
  for (const ch of text) if (RTL_LETTER.test(ch)) return true;
  return false;
}

export function hasJoiningLetters(text: string): boolean {
  for (const ch of text) if (JOINING_LETTER.test(ch)) return true;
  return false;
}

export type RtlScript = 'arabic' | 'hebrew' | 'other';

// Letters used in Urdu or Persian but not in standard Arabic.
const URDU_ONLY = /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/gu;
const PERSIAN_OR_URDU = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/gu;

/** Names a language that fits the text better than Arabic, or null when Arabic fits. */
export function notArabicLanguage(text: string): 'ur' | 'fa' | null {
  const letters = countLetters(text).arabic;
  if (letters < 20) return null;
  const urdu = text.match(URDU_ONLY)?.length ?? 0;
  const other = text.match(PERSIAN_OR_URDU)?.length ?? 0;
  if (urdu / letters >= 0.02) return 'ur';
  return other / letters >= 0.04 ? 'fa' : null;
}

/** The RTL script with the most letters, or null when RTL letters are a minority. */
export function dominantRtlScript(counts: LetterCounts): RtlScript | null {
  if (counts.rtl === 0 || counts.rtl < counts.ltr) return null;
  if (counts.arabic >= counts.hebrew && counts.arabic > 0) return 'arabic';
  if (counts.hebrew > 0) return 'hebrew';
  return 'other';
}

// Languages written in Arabic script by default.
const ARABIC_SCRIPT_LANGS = new Set([
  'ar', 'arz', 'apc', 'ajp', 'acm', 'ary', 'arq', 'aeb', 'afb', 'ayl', 'fa', 'prs', 'ur', 'ps',
  'sd', 'ug', 'ckb', 'ks', 'pnb', 'skr', 'bal', 'bqi', 'glk', 'lrc', 'mzn', 'khw', 'bgn', 'hno', 'azb',
]);
const HEBREW_SCRIPT_LANGS = new Set(['he', 'iw', 'yi', 'ji', 'lad', 'jrb']);
const OTHER_RTL_LANGS = new Set(['dv', 'syr', 'arc', 'nqo', 'sam', 'mid', 'rhg', 'ff-Adlm']);
const RTL_SCRIPT_SUBTAGS = new Set(['arab', 'hebr', 'syrc', 'thaa', 'nkoo', 'adlm', 'samr', 'mand', 'rohg']);

interface ParsedLang {
  primary: string;
  script: string | null;
}

function parseLang(tag: string): ParsedLang | null {
  const parts = tag.trim().replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length === 0) return null;
  const primary = parts[0].toLowerCase();
  if (!/^[a-z]{2,8}$/.test(primary)) return null;
  const script = parts.slice(1).find((p) => /^[a-z]{4}$/i.test(p)) ?? null;
  return { primary, script: script ? script.toLowerCase() : null };
}

export function isArabicTag(tag: string): boolean {
  return parseLang(tag)?.primary === 'ar';
}

/** True when a BCP 47 tag names a language normally written right to left. */
export function isRtlLanguage(tag: string | null | undefined): boolean {
  if (!tag) return false;
  const lang = parseLang(tag);
  if (!lang) return false;
  if (lang.script) return RTL_SCRIPT_SUBTAGS.has(lang.script);
  return (
    ARABIC_SCRIPT_LANGS.has(lang.primary) ||
    HEBREW_SCRIPT_LANGS.has(lang.primary) ||
    OTHER_RTL_LANGS.has(lang.primary)
  );
}

/**
 * Does the lang tag fit the dominant script? Returns null when we cannot tell,
 * for example for a script we do not track.
 */
export function langMatchesScript(tag: string, script: RtlScript): boolean | null {
  const lang = parseLang(tag);
  if (!lang) return false;
  if (script === 'other') return isRtlLanguage(tag) ? null : false;
  if (lang.script) {
    if (script === 'arabic') return lang.script === 'arab';
    return lang.script === 'hebr';
  }
  if (script === 'arabic') return ARABIC_SCRIPT_LANGS.has(lang.primary);
  return HEBREW_SCRIPT_LANGS.has(lang.primary);
}
