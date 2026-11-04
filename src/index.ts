// Library entry: run the checker from your own scripts or tests.
export { checkPage, launchBrowser, resolveTarget, selectedRules, DEFAULT_VIEWPORT, type CheckOptions } from './check.ts';
export { formatText } from './report.ts';
export { RULES, RULE_IDS, getRule, type RuleId, type RuleInfo, type Severity } from './rules.ts';
export type { Box, Finding, PageInfo, RawFinding, Report } from './types.ts';
