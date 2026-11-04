// ltr-input: fields for LTR values inside an RTL form need their own direction.
// Browsers already make type="tel" LTR, so those fields pass on computed
// direction. type="text" phone fields and email and URL fields do not.
import type { RawFinding } from '../../types.ts';
import { cssPath, docBox, isVisible, style } from '../dom.ts';

const AUTOCOMPLETE = /\b(email|url|tel|tel-national|tel-local|cc-number)\b/i;
const NAME_HINT = /(e[-_]?mail|phone|mobile|(^|[-_])tel($|[-_])|website|(^|[-_])url($|[-_])|iban|card[-_]?(number|no)($|[-_]))/i;
const SKIP_TYPES = new Set([
  'hidden', 'checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'image', 'color', 'range',
  'date', 'datetime-local', 'month', 'week', 'time', 'number', 'password', 'search',
]);

/** What kind of LTR value the field takes, or null for free text. */
export function ltrFieldKind(field: {
  type: string;
  inputMode?: string;
  autocomplete?: string;
  name?: string;
  id?: string;
}): string | null {
  const type = (field.type || 'text').toLowerCase();
  if (SKIP_TYPES.has(type)) return null;
  if (type === 'email' || type === 'url' || type === 'tel') return type;
  const mode = (field.inputMode || '').toLowerCase();
  if (mode === 'email' || mode === 'url' || mode === 'tel') return mode;
  const auto = field.autocomplete || '';
  const a = AUTOCOMPLETE.exec(auto);
  if (a) return a[1].toLowerCase().startsWith('tel') ? 'tel' : a[1].toLowerCase();
  if (NAME_HINT.test(field.name || '') || NAME_HINT.test(field.id || '')) {
    return /phone|mobile|tel/i.test(`${field.name} ${field.id}`) ? 'tel' : 'text';
  }
  return null;
}

export function checkInputs(): RawFinding[] {
  const findings: RawFinding[] = [];
  for (const input of Array.from(document.querySelectorAll('input'))) {
    if (!isVisible(input)) continue;
    const kind = ltrFieldKind({
      type: input.getAttribute('type') ?? 'text',
      inputMode: input.getAttribute('inputmode') ?? '',
      autocomplete: input.getAttribute('autocomplete') ?? '',
      name: input.name,
      id: input.id,
    });
    if (!kind) continue;
    const dir = (input.getAttribute('dir') || '').toLowerCase();
    if (dir === 'ltr' || dir === 'auto' || style(input).direction === 'ltr') continue;
    findings.push({
      rule: 'ltr-input',
      severity: kind === 'tel' ? 'error' : 'warning',
      selector: cssPath(input),
      box: docBox(input.getBoundingClientRect()),
      message:
        kind === 'tel'
          ? 'This phone field is right to left, so "+974 5555 1234" shows as "1234 5555 974+". Use type="tel" or add dir="ltr".'
          : `This ${kind === 'text' ? '' : kind + ' '}field holds an LTR value but is right to left, so a trailing "." or "/" jumps to the front while it is typed. Add dir="ltr".`,
      evidence: { field: `<input type="${input.getAttribute('type') ?? 'text'}"${input.name ? ` name="${input.name}"` : ''}>` },
    });
  }
  return findings;
}
