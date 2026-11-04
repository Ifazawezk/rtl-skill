// One registry for every check. The CLI help, the README rules table and the
// skill cross-links are all built from this list, so a rule is described once.

export type Severity = 'error' | 'warning';

export const RULE_IDS = [
  'dir-attribute',
  'lang-attribute',
  'physical-css',
  'mirror-mismatch',
  'bidi-order',
  'ltr-input',
  'icon-mirroring',
  'viewport-overflow',
  'text-clipped',
  'arabic-letter-spacing',
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export interface RuleInfo {
  id: RuleId;
  title: string;
  /** Default severity. A rule may report a lighter finding when it is less sure. */
  severity: Severity;
  /** What the rule catches, in one sentence. */
  summary: string;
  /** How the rule decides, so people can judge a finding. */
  how: string;
  /** The usual fix. */
  fix: string;
  /** Heading slug in SKILL.md that explains the topic. */
  skillSection: string;
}

export const RULES: Record<RuleId, RuleInfo> = {
  'dir-attribute': {
    id: 'dir-attribute',
    title: 'Document direction',
    severity: 'error',
    summary: 'The page has right-to-left text but <html> is not dir="rtl", or RTL paragraphs sit in an LTR block.',
    how: 'Counts Arabic, Hebrew and other RTL letters in the rendered text and compares that with the dir attribute and the computed direction of each text block.',
    fix: 'Put dir="rtl" on <html>. Use dir="ltr" only on small islands such as code or phone numbers.',
    skillSection: 'document-direction-and-language',
  },
  'lang-attribute': {
    id: 'lang-attribute',
    title: 'Document language',
    severity: 'error',
    summary: '<html> has no lang, or its lang does not match the script on the page (lang="en" on an Arabic page).',
    how: 'Reads the lang attribute and checks it against the dominant script of the rendered text.',
    fix: 'Set lang to the page language, for example lang="ar" or lang="ar-QA". Fonts, hyphenation and screen readers depend on it.',
    skillSection: 'document-direction-and-language',
  },
  'physical-css': {
    id: 'physical-css',
    title: 'Physical CSS',
    severity: 'warning',
    summary: 'A left/right property (margin-left, padding-right, left:, border-left, text-align: left, float) that does not flip with the direction.',
    how: 'Renders the page twice, RTL and LTR, and keeps only the elements whose physical box values stay the same in both. Then it names the CSS rule that sets them.',
    fix: 'Use logical properties: margin-inline-start, padding-inline-end, inset-inline-start, border-inline-start, text-align: start.',
    skillSection: 'logical-css-properties',
  },
  'mirror-mismatch': {
    id: 'mirror-mismatch',
    title: 'Layout does not mirror',
    severity: 'warning',
    summary: 'An element sits in a different place than the mirror image of the LTR layout, for example a progress bar that still fills from the left.',
    how: 'Compares each element box in the RTL render with the horizontally mirrored box from the LTR render of the same page.',
    fix: 'Look for transforms, translateX, transform-origin and JavaScript that sets left/right. Make them depend on the direction.',
    skillSection: 'flex-grid-and-positioning',
  },
  'bidi-order': {
    id: 'bidi-order',
    title: 'LTR island out of order',
    severity: 'error',
    summary: 'A phone number, code snippet, order number or other LTR run renders in the wrong order inside RTL text, like "+974 5555 1234" showing as "1234 5555 974+".',
    how: 'Finds Latin and phone-number runs in RTL text and measures the position of every character. Characters of an LTR run must go left to right.',
    fix: 'Wrap the run in <bdi dir="ltr"> or <span dir="ltr">, or use Unicode isolates (U+2066 ... U+2069) in plain strings.',
    skillSection: 'numbers-phone-numbers-code-and-urls-inside-rtl-text',
  },
  'ltr-input': {
    id: 'ltr-input',
    title: 'LTR input without dir',
    severity: 'warning',
    summary: 'An email or URL field, or a phone field that is not type="tel", is right to left, so its value reorders while the user types.',
    how: 'Looks at input type, inputmode, autocomplete and name, and at the computed direction of the field. Browsers already render type="tel" LTR, so those pass.',
    fix: 'Add dir="ltr" to email, URL, phone and code fields. Use dir="auto" for free text such as names and messages.',
    skillSection: 'forms-and-mixed-direction-inputs',
  },
  'icon-mirroring': {
    id: 'icon-mirroring',
    title: 'Icon direction',
    severity: 'error',
    summary: 'A directional icon (next, back, chevron, arrow, send) points the LTR way in RTL, or a non-directional icon (play, check, logo) was mirrored.',
    how: 'Reads icon names from classes, data attributes, sprite ids, file names and arrow characters, reads the meaning from the button or link label, and resolves the CSS transforms to see where the icon points on screen.',
    fix: 'Mirror directional icons in RTL ([dir="rtl"] .icon { transform: scaleX(-1) } or Tailwind rtl:-scale-x-100). Never mirror media, check marks, clocks or logos.',
    skillSection: 'icons-mirror-or-not',
  },
  'viewport-overflow': {
    id: 'viewport-overflow',
    title: 'Overflow past the viewport',
    severity: 'error',
    summary: 'An element sticks out of the viewport and causes a horizontal scrollbar. In RTL this is often an LTR off-canvas menu parked at left: -300px.',
    how: 'Measures every visible element box against the viewport and skips boxes clipped by a scrolling or hidden ancestor.',
    fix: 'Hide off-canvas panels with inset-inline-start and a translate that depends on direction, or with visibility: hidden. Avoid fixed widths wider than small screens.',
    skillSection: 'flex-grid-and-positioning',
  },
  'text-clipped': {
    id: 'text-clipped',
    title: 'Clipped text',
    severity: 'error',
    summary: 'Text is cut off or spills out of a box with a fixed width or height. Arabic labels are often longer and taller than the English ones the box was sized for.',
    how: 'Compares scroll size with client size on boxes that hide overflow, and compares text bounds with the box on boxes that do not.',
    fix: 'Drop the fixed width or height. Use min-width, padding-inline and a line-height of at least 1.5 for Arabic. Truncate on purpose with text-overflow: ellipsis.',
    skillSection: 'truncation-and-text-that-grows',
  },
  'arabic-letter-spacing': {
    id: 'arabic-letter-spacing',
    title: 'Letter-spacing on Arabic',
    severity: 'error',
    summary: 'Arabic script text has letter-spacing, which pulls joined letters apart.',
    how: 'Finds elements whose own text contains Arabic script and whose computed letter-spacing is not zero, and reports the element that sets it.',
    fix: 'Set letter-spacing: 0 (or normal) for Arabic, for example :lang(ar) { letter-spacing: 0 }.',
    skillSection: 'arabic-typography',
  },
};

export function getRule(id: string): RuleInfo | undefined {
  return (RULES as Record<string, RuleInfo>)[id];
}

/** Parses a comma separated list of rule ids and throws on unknown ids. */
export function parseRuleList(list: string): RuleId[] {
  const ids = list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of ids) {
    if (!getRule(id)) {
      throw new Error(`Unknown rule "${id}". Known rules: ${RULE_IDS.join(', ')}`);
    }
  }
  return ids as RuleId[];
}
