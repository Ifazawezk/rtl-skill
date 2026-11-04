// Human-readable output for the terminal.
import type { Report } from './types.ts';

export interface TextOptions {
  color: boolean;
}

const codes = { red: 31, yellow: 33, green: 32, dim: 2, bold: 1, cyan: 36 } as const;

function paint(on: boolean) {
  return (name: keyof typeof codes, s: string) => (on ? `\x1b[${codes[name]}m${s}\x1b[0m` : s);
}

export function formatText(report: Report, options: TextOptions = { color: false }): string {
  const c = paint(options.color);
  const p = report.page;
  const lines: string[] = [];
  lines.push(`${c('bold', 'rtl-check')}  ${report.target}`);
  lines.push(
    c(
      'dim',
      `  ${p.viewport.width}x${p.viewport.height}, dir=${p.dir ?? '(none)'}, lang=${p.lang ?? '(none)'}, ` +
        `${p.rtlLetters} RTL and ${p.ltrLetters} LTR letters, ${report.durationMs} ms`,
    ),
  );
  lines.push('');

  for (const f of report.findings) {
    const sev = f.severity === 'error' ? c('red', 'error  ') : c('yellow', 'warning');
    lines.push(`  ${String(f.id).padStart(2)}  ${sev}  ${c('cyan', f.rule.padEnd(21))} ${f.selector}`);
    lines.push(`      ${f.message}`);
    for (const [key, value] of Object.entries(f.evidence ?? {})) {
      lines.push(c('dim', `      ${key}: ${value}`));
    }
    lines.push(c('dim', `      docs: ${f.docs}`));
    lines.push('');
  }

  for (const s of report.skipped) lines.push(c('dim', `  skipped ${s.rule}: ${s.reason}`));
  if (report.skipped.length) lines.push('');

  const { errors, warnings } = report.summary;
  const total = `${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`;
  lines.push(errors ? c('red', total) : warnings ? c('yellow', total) : c('green', `${total}, no RTL problems found`));
  const shots = Object.values(report.screenshots).filter(Boolean);
  if (shots.length) lines.push(c('dim', `screenshots: ${shots.join(', ')}`));
  return lines.join('\n') + '\n';
}
