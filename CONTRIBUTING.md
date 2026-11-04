# Contributing

Thanks for helping. The most useful reports are real pages where the checker is wrong, in either direction, and corrections from native readers of Arabic, Persian, Hebrew and Urdu.

## Setup

You need Node 22.18 or newer for development (the CLI itself runs on Node 20).

```bash
git clone https://github.com/Ifazawezk/rtl-skill.git
cd rtl-skill
npm install
npx playwright install chromium
npm test
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests and every fixture page |
| `npm run typecheck` | Strict type check |
| `npm run skill` | Regenerate the skill files from `skill-src/guide.md` |
| `npm run bench` | Measure all page sets and rewrite `bench/` |
| `npm run docs` | Rebuild the images and demo reports in `docs/` (also needs `npx playwright install webkit`) |
| `npm run build` | Bundle `dist/` |

## How the code is laid out

| Path | What lives there |
| --- | --- |
| `src/rules.ts` | The rule registry. Every rule is described once here |
| `src/page/checks/` | The checks. This code runs inside the page under test |
| `src/shared/` | Pure logic with no DOM, tested directly in Node |
| `src/check.ts` | Runs one page: load, measure, flip, compare, report |
| `skill-src/guide.md` | The one source for all three skill files |
| `fixtures/` | Pages with a known bug and their fixed twins, plus clean edge cases |
| `holdout/`, `holdout-2/` | Blind test rounds. Read the rule below before you touch them |

## Add a fixture

A fixture is a small HTML page. Bug pages end in `.bug.html` and need a twin ending in `.fixed.html`. Pages that are correct but look suspicious go in `fixtures/clean/`.

State what the page should do in `<meta>` tags:

```html
<meta name="rtl-check-expect" content="bidi-order">        <!-- rules that must fire -->
<meta name="rtl-check-allow" content="physical-css">       <!-- real side effects, not scored -->
<meta name="rtl-check-viewport" content="390x844">         <!-- optional -->
```

Then run `npm test`. A bug page fails if an expected rule stays silent or an unexpected one fires. A fixed or clean page fails if anything fires at all.

Use real text. Arabic that wraps, joins and reorders is the point of these pages, and lorem ipsum hides bugs.

If you add a false-positive report, put the smallest page that shows it in `fixtures/clean/` and start the name with `real-world-` if it came from a live site.

## Add a rule

1. Add the id to `RULE_IDS` and describe it in `RULES` in `src/rules.ts`. `skillSection` must be a heading slug from the guide, and a test checks that it exists.
2. Write the check in `src/page/checks/`, returning `RawFinding[]`. Put logic that needs no DOM in `src/shared/` so it can be unit tested.
3. Call it from `checks()` in `src/page/index.ts`. A rule that compares LTR and RTL belongs in `layoutChecks()` instead.
4. If it only means something on RTL pages, add it to `RTL_ONLY_RULES` in `src/check.ts`.
5. Add at least two bug and fixed pairs in `fixtures/<rule-id>/`, and at least one clean page that tries to trick it.
6. Add the rule to the table in `README.md`, and explain the topic in `skill-src/guide.md`.
7. Run `npm run skill`, `npm test` and `npm run bench`, and commit what they change.

Choose the severity carefully. Use `error` only for something a person can see is wrong. Use `warning` when the checker cannot tell a bug from a choice. When it can tell how sure it is, let the finding say so, as `icon-mirroring` does when the meaning comes from a label and not from a guess.

Prefer measuring the rendered page over reading source. That is the reason this project exists.

## Change the guide

Edit `skill-src/guide.md` only, then run `npm run skill`. The generated files are checked by a test.

- Wrap content that is too long for `AGENTS.md` in `<!-- only: skill, cursor -->` and `<!-- end only -->`.
- Test claims about browser behavior in a real browser before you write them down. Several first drafts of this guide were wrong, and only testing showed it.
- Write `⁦` in code samples, never the invisible character itself. A test enforces this.

## The rule for blind rounds

`bench/holdout-first-run.md` and `bench/holdout-2-first-run.md` are first runs and are never edited. That is what makes them worth reading.

To add a round:

1. Freeze the code.
2. Write new pages in a new `holdout-N/` folder without changing the checker. Include cases you expect it to fail.
3. Run `npm run bench` once and save the result as `bench/holdout-N-first-run.md`.
4. Commit that before you fix anything.

Fix what you find afterwards. The pages stay, but the round no longer counts as blind. Better still, ask someone else to write the pages.

## Testing on live sites

Use your own sites or sites you have permission to test, and go gently. Identify the tool honestly: do not change the user agent or set false `Origin` or `Referer` headers, and do not try to get past bot checks, firewalls or login walls. If a site blocks or refuses the checker, leave it out.

## Style

- Plain language in docs and messages. No em dashes and no emoji. Tests check this.
- Short imperative commit messages.
- Every commit leaves tests passing.
