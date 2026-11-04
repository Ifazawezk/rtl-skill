// Works out what an icon means and which way its artwork points, from its
// name and the label around it. Pure functions: tested in Node, bundled into the page.

export type Pointing = 'left' | 'right';
export type Meaning = 'forward' | 'backward';

export type IconClass =
  | { kind: 'directional'; pointing: Pointing; meaning: Meaning }
  | { kind: 'fixed'; reason: string };

const B = '(?:^|[-_:/.])';
const E = '(?:[-_.]|$)';

const FIXED: { re: RegExp; reason: string }[] = [
  {
    re: new RegExp(
      `${B}(play|pause|stop|rewind|fast[-_]?forward|fast[-_]?rewind|skip[-_]?(next|previous|prev|forward|back))${E}`,
    ),
    reason: 'media controls follow tape direction, not reading direction',
  },
  { re: new RegExp(`${B}(check|checkmark|tick|done)${E}`), reason: 'a check mark means the same in both directions' },
  { re: new RegExp(`${B}(clock|schedule|alarm|timer|history)${E}`), reason: 'clocks run clockwise in every language' },
  {
    re: new RegExp(
      `${B}(logo|brand|whatsapp|youtube|twitter|facebook|instagram|github|linkedin|telegram|tiktok|snapchat|apple|google)${E}`,
    ),
    reason: 'logos and brand marks are never mirrored',
  },
];

const SHAPE = '(?:arrows?|chevrons?|carets?|angles?|triangle|navigate)';
const RIGHT = new RegExp(`${SHAPE}(?:[a-z_-]{0,12}?[-_])?(?:right|forward|next)(?:[-_.]|$)`);
const LEFT = new RegExp(`${SHAPE}(?:[a-z_-]{0,12}?[-_])?(?:left|back|before|prev|previous)(?:[-_.]|$)`);
const PLAIN_RIGHT = new RegExp(`${B}(next|forward|send|redo|logout|log-out|signout|sign-out|login|sign-in|exit)${E}`);
const PLAIN_LEFT = new RegExp(`${B}(back|previous|prev|reply|reply-all|undo|return)${E}`);
const DIAGONAL = /[-_](up|down)[-_]/;

/** Classifies an icon from its name tokens (classes, ids, file names, sprite ids). */
export function classifyIconName(name: string): IconClass | null {
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    for (const { re, reason } of FIXED) if (re.test(token)) return { kind: 'fixed', reason };
  }
  for (const token of tokens) {
    if (DIAGONAL.test(token)) continue;
    if (RIGHT.test(token)) return { kind: 'directional', pointing: 'right', meaning: 'forward' };
    if (LEFT.test(token)) return { kind: 'directional', pointing: 'left', meaning: 'backward' };
  }
  for (const token of tokens) {
    if (PLAIN_RIGHT.test(token)) return { kind: 'directional', pointing: 'right', meaning: 'forward' };
    if (PLAIN_LEFT.test(token)) return { kind: 'directional', pointing: 'left', meaning: 'backward' };
  }
  return null;
}

/** Folds spelling variants so one word list covers them. */
export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/[\u0649\u06CC]/g, '\u064A');
}

const words = (list: string) => new Set(list.split(/\s+/).filter(Boolean).map(normalizeLabel));

const FORWARD = words(`
  next continue forward proceed more send
  التالي التالية التالى متابعة تابع استمر استمرار المزيد مزيد ارسال إرسال أرسل أكمل إكمال التقدم
  بعدی ادامه بیشتر
  הבא הבאה המשך עוד שלח
  اگلا جاری مزید
`);

const BACKWARD = words(`
  previous prev back return
  السابق السابقة سابق رجوع الرجوع عودة العودة ارجع الخلف
  قبلی بازگشت برگشت
  הקודם הקודמת חזרה אחורה
  پچھلا واپس
`);

/** Reads a button or link label. Returns null when it says nothing or says both. */
export function classifyLabel(text: string): Meaning | null {
  const tokens = normalizeLabel(text).split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  const forward = tokens.some((t) => FORWARD.has(t));
  const backward = tokens.some((t) => BACKWARD.has(t));
  if (forward === backward) return null;
  return forward ? 'forward' : 'backward';
}

/** Arrows the bidi algorithm does not mirror, so they point the same way in RTL. */
export const ARROW_GLYPHS: Record<string, Pointing> = {
  '\u2192': 'right', // rightwards arrow
  '\u27F6': 'right', // long rightwards arrow
  '\u2794': 'right',
  '\u279C': 'right',
  '\u279D': 'right',
  '\u279E': 'right',
  '\u27A1': 'right',
  '\u21D2': 'right', // double arrow
  '\u21E8': 'right',
  '\u2190': 'left', // leftwards arrow
  '\u27F5': 'left',
  '\u21D0': 'left',
  '\u21E6': 'left',
  '\u2B05': 'left',
};

export const ARROW_RE = /[\u2192\u27F6\u2794\u279C\u279D\u279E\u27A1\u21D2\u21E8\u2190\u27F5\u21D0\u21E6\u2B05]/g;

/** Which way a forward or backward icon should point in RTL. */
export function expectedPointing(meaning: Meaning): Pointing {
  return meaning === 'forward' ? 'left' : 'right';
}

export function opposite(p: Pointing): Pointing {
  return p === 'left' ? 'right' : 'left';
}

/** Horizontal scale factor from a computed transform value. 1 when there is none. */
export function transformScaleX(transform: string): number {
  if (!transform || transform === 'none') return 1;
  const m = /^matrix(3d)?\(([^)]+)\)$/.exec(transform.trim());
  if (!m) return 1;
  const first = Number.parseFloat(m[2].split(',')[0]);
  return Number.isFinite(first) ? first : 1;
}

/** Horizontal factor from the computed `scale` property ("-1 1", "-100%"). */
export function scalePropertyX(scale: string): number {
  if (!scale || scale === 'none') return 1;
  const first = scale.trim().split(/\s+/)[0];
  const n = Number.parseFloat(first);
  if (!Number.isFinite(n)) return 1;
  return first.endsWith('%') ? n / 100 : n;
}

/** Horizontal factor from the computed `rotate` property ("180deg", "z 180deg"). */
export function rotatePropertyX(rotate: string): number {
  if (!rotate || rotate === 'none') return 1;
  const m = /(-?[\d.]+)deg/.exec(rotate);
  return m ? Math.cos((Number.parseFloat(m[1]) * Math.PI) / 180) : 1;
}
