// Types shared by the Node side and the in-page runtime.
import type { RuleId, Severity } from './rules.ts';

/** A box in document coordinates (CSS pixels). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A finding as produced in the page, before Node adds ids and links. */
export interface RawFinding {
  rule: RuleId;
  severity: Severity;
  message: string;
  /** Short CSS selector of the element, or "html" for page-level findings. */
  selector: string;
  /** Where the problem is in the RTL render. Page-level findings have none. */
  box?: Box;
  /** Where the same element is in the LTR render (not mirrored), for layout findings. */
  ltrBox?: Box;
  /** Facts that back the finding, such as the CSS declaration or the rendered order. */
  evidence?: Record<string, string>;
}

export interface Finding extends RawFinding {
  /** 1-based number, matching the label on the annotated screenshot. */
  id: number;
  /** Link to the SKILL.md section that explains the fix. */
  docs: string;
}

export interface PageInfo {
  url: string;
  title: string;
  dir: string | null;
  lang: string | null;
  /** Computed direction of <html> as rendered. */
  direction: 'rtl' | 'ltr';
  rtlLetters: number;
  ltrLetters: number;
  viewport: { width: number; height: number };
  /** Elements the runtime looked at. */
  elements: number;
}

export interface PageOptions {
  /** Rules to run. Empty means all. */
  rules: RuleId[];
}

export interface Report {
  target: string;
  page: PageInfo;
  findings: Finding[];
  summary: { errors: number; warnings: number };
  /** Rules that did not run, with the reason. */
  skipped: { rule: RuleId; reason: string }[];
  screenshots: { annotated?: string; mirror?: string };
  durationMs: number;
}
