// Finds runs of left-to-right content (Latin words with symbols, phone
// numbers) inside text, so the checker can measure whether each run renders
// left to right. Pure function: unit-tested in Node, bundled into the page.

export type IslandKind = 'latin' | 'phone';

export interface Island {
  start: number;
  end: number;
  text: string;
  kind: IslandKind;
}

const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;
const ISLAND_CHAR = /[A-Za-z\u00C0-\u024F0-9\u0660-\u0669\u06F0-\u06F9 \u00A0.,:;/\\\-+_@#%&*=~^|()[\]{}<>!?'"$\u20AC\u00A3]/;
/** Symbols that can be glued to the front of a Latin token: #tag, .NET, @user, $var, +1. */
const PREFIX = /[#.@$+\-_~/\\]/;
/** A trailing @ is an author compensating for bidi: "BBCArabic@" displays as @BBCArabic. */
const SENTENCE_END = /[.,;:!?'"@\s\u00A0]/;
const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };

/** Normalizes Arabic-Indic and Persian digits to ASCII. */
export function latinDigits(s: string): string {
  return s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

function balanced(s: string): boolean {
  const stack: string[] = [];
  for (const ch of s) {
    if (OPENERS[ch]) stack.push(ch);
    else if (CLOSERS[ch]) {
      if (stack.pop() !== CLOSERS[ch]) return false;
    }
  }
  return stack.length === 0;
}

/** Trims spaces, sentence punctuation and unpaired brackets from both ends. */
function trimRun(text: string, start: number, end: number): [number, number] {
  let s = start;
  let e = end;
  for (let changed = true; changed && s < e; ) {
    changed = false;
    const first = text[s];
    const last = text[e - 1];
    // Leading space, quote or punctuation. A dot stays when glued to a word (.NET).
    if (/[\s\u00A0'",;:!?]/.test(first) || (first === '.' && !/[A-Za-z0-9]/.test(text[s + 1] ?? ''))) {
      s++;
      changed = true;
      continue;
    }
    if (SENTENCE_END.test(last)) {
      e--;
      changed = true;
      continue;
    }
    if (OPENERS[last] || (OPENERS[first] && !balanced(text.slice(s, e)))) {
      if (OPENERS[last]) e--;
      else s++;
      changed = true;
      continue;
    }
    if (CLOSERS[last] && !balanced(text.slice(s, e))) {
      e--;
      changed = true;
      continue;
    }
    // A pair that wraps the whole run, like (PDF), is laid out correctly by the bidi algorithm.
    if (OPENERS[first] && OPENERS[first] === last && balanced(text.slice(s + 1, e - 1))) {
      s++;
      e--;
      changed = true;
    }
  }
  return [s, e];
}

/** Does the run contain anything besides letters and digits that bidi can move around? */
function hasWeakChars(s: string): boolean {
  return /[^A-Za-z\u00C0-\u024F0-9\u0660-\u0669\u06F0-\u06F9]/.test(s);
}

const CLOCK = /\d{1,2}:\d{2}\s*$/;
const YEAR = /^(1[3-9]|20)\d\d$/;
const ISO_DATE = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\d{1,2}-\d{4})$/;

/** Digit-only runs that look like phone numbers (not ranges, dates, times or amounts). */
export function isPhoneLike(run: string, telContext = false): boolean {
  const s = latinDigits(run).trim();
  if (/[:/,.]/.test(s) || ISO_DATE.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  const groups = s.split(/[\s\u00A0\-()]+/).filter(Boolean);
  if (!groups.every((g) => /^\+?\d+$/.test(g))) return false;
  if (telContext) return s.startsWith('+') || groups.length >= 2 || digits.length >= 7;
  // "+500 customers" is a count, so a plus sign needs a full number behind it.
  if (s.startsWith('+')) return digits.length >= 7;
  if (s.startsWith('00') && digits.length >= 8) return true;
  if (groups.length >= 3) return digits.length >= 7;
  if (groups.length === 2) {
    const spaced = /^\d+[\s\u00A0]+\d+$/.test(s);
    const years = YEAR.test(groups[0]) && YEAR.test(groups[1]);
    return spaced && digits.length >= 7 && !years;
  }
  return false;
}

/**
 * LTR runs inside a piece of text that can render out of order in an RTL
 * paragraph. Single words without symbols are skipped: they always render fine.
 */
export function findLtrIslands(text: string, options: { telContext?: boolean } = {}): Island[] {
  const islands: Island[] = [];
  let i = 0;
  while (i < text.length) {
    if (!ISLAND_CHAR.test(text[i]) || /[\s\u00A0]/.test(text[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < text.length && ISLAND_CHAR.test(text[j])) j++;
    const runEnd = j;
    const [s, e] = trimRun(text, i, runEnd);
    i = runEnd;
    if (e - s < 2) continue;
    const run = text.slice(s, e);
    const firstLetter = run.search(LATIN_LETTER);
    if (firstLetter === -1) {
      if (isPhoneLike(run, options.telContext)) islands.push({ start: s, end: e, text: run, kind: 'phone' });
      continue;
    }
    // Start at the first Latin letter, keeping symbols glued to it (#A-1029, .NET).
    // Leading numbers with spaces ("2 GB") read right to left and are left alone.
    let start = s + firstLetter;
    const clock = CLOCK.exec(run.slice(0, firstLetter));
    if (clock && /^(am|pm)\b/i.test(run.slice(firstLetter))) start = s + clock.index;
    while (start > s && PREFIX.test(text[start - 1])) start--;
    const latin = text.slice(start, e);
    if (latin.length >= 2 && hasWeakChars(latin)) islands.push({ start, end: e, text: latin, kind: 'latin' });
  }
  return islands;
}

/** Characters the bidi algorithm draws mirrored inside RTL runs. */
export const MIRRORED: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
};
