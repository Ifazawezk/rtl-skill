// Command line entry: rtl-check <url-or-file...> and rtl-skill <command>.
import { parseArgs } from 'node:util';
import { checkPage, launchBrowser, type CheckOptions } from './check.ts';
import { formatText } from './report.ts';
import { RULES, parseRuleList } from './rules.ts';
import type { Report } from './types.ts';

export const VERSION = '0.1.0';

const HELP = `rtl-check: find right-to-left layout bugs in a real browser

Usage
  rtl-check <url-or-file...> [options]
  rtl-skill check <url-or-file...> [options]
  rtl-skill rules

Options
  --json                 print the report as JSON
  --viewport <WxH>       viewport size (default 1280x800)
  --mobile               same as --viewport 390x844
  --force-rtl            set dir="rtl" on <html> first, for apps that start LTR
  --lang <tag>           lang to set together with --force-rtl (default ar)
  --rules <ids>          run only these rules, comma separated
  --skip <ids>           skip these rules
  --fail-on <level>      exit 1 on: error (default), warning or never
  --wait-for <selector>  wait for an element before checking
  --wait <ms>            wait this long after load
  --no-color             plain output
  -h, --help             show this help
  -v, --version          show the version

Exit codes: 0 no findings at the --fail-on level, 1 findings, 2 usage or runtime error.
`;

export interface CliIO {
  out: (s: string) => void;
  err: (s: string) => void;
  isTTY: boolean;
}

const defaultIO: CliIO = {
  out: (s) => process.stdout.write(s),
  err: (s) => process.stderr.write(s),
  isTTY: Boolean(process.stdout.isTTY),
};

export async function main(argv: string[], io: CliIO = defaultIO, bin = 'rtl-check'): Promise<number> {
  let args = argv;
  if (bin !== 'rtl-check') {
    const [command, ...rest] = argv;
    if (command === 'rules') return listRules(io);
    if (command === 'check') args = rest;
    else if (!command || command === '-h' || command === '--help') {
      io.out(HELP);
      return command ? 0 : 2;
    } else if (command === '-v' || command === '--version') {
      io.out(VERSION + '\n');
      return 0;
    }
  }
  return check(args, io);
}

function listRules(io: CliIO): number {
  for (const rule of Object.values(RULES)) {
    io.out(`${rule.id.padEnd(22)} ${rule.severity.padEnd(8)} ${rule.summary}\n`);
  }
  return 0;
}

async function check(argv: string[], io: CliIO): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: 'boolean' },
        viewport: { type: 'string' },
        mobile: { type: 'boolean' },
        'force-rtl': { type: 'boolean' },
        lang: { type: 'string' },
        rules: { type: 'string' },
        skip: { type: 'string' },
        'fail-on': { type: 'string', default: 'error' },
        'wait-for': { type: 'string' },
        wait: { type: 'string' },
        'no-color': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (err) {
    io.err(`${(err as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.out(HELP);
    return 0;
  }
  if (values.version) {
    io.out(VERSION + '\n');
    return 0;
  }
  if (positionals.length === 0) {
    io.err(HELP);
    return 2;
  }

  const failOn = values['fail-on'];
  if (!['error', 'warning', 'never'].includes(failOn ?? '')) {
    io.err(`--fail-on must be error, warning or never (got "${failOn}")\n`);
    return 2;
  }

  const options: CheckOptions = {};
  try {
    if (values.rules) options.rules = parseRuleList(values.rules);
    if (values.skip) options.skip = parseRuleList(values.skip);
    if (values.mobile) options.viewport = { width: 390, height: 844 };
    if (values.viewport) options.viewport = parseViewport(values.viewport);
    if (values.wait) options.waitMs = Number.parseInt(values.wait, 10);
  } catch (err) {
    io.err(`${(err as Error).message}\n`);
    return 2;
  }
  options.forceRtl = values['force-rtl'];
  options.lang = values.lang;
  options.waitFor = values['wait-for'];

  const color = io.isTTY && !values['no-color'] && !process.env.NO_COLOR;
  const reports: Report[] = [];
  let browser;
  try {
    browser = await launchBrowser();
    for (const target of positionals) {
      const report = await checkPage(target, { ...options, browser });
      reports.push(report);
      if (!values.json) io.out(formatText(report, { color }) + (positionals.length > 1 ? '\n' : ''));
    }
  } catch (err) {
    io.err(`rtl-check: ${(err as Error).message}\n`);
    return 2;
  } finally {
    await browser?.close();
  }

  if (values.json) io.out(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2) + '\n');

  const failing = reports.some((r) =>
    failOn === 'never' ? false : failOn === 'warning' ? r.findings.length > 0 : r.summary.errors > 0,
  );
  return failing ? 1 : 0;
}

export function parseViewport(text: string): { width: number; height: number } {
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(text.trim());
  if (!m) throw new Error(`--viewport must look like 1280x800 (got "${text}")`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

export function run(bin: 'rtl-check' | 'rtl-skill'): void {
  main(process.argv.slice(2), defaultIO, bin).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`rtl-check: ${err instanceof Error ? err.stack : String(err)}\n`);
      process.exitCode = 2;
    },
  );
}
