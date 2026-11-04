<p align="center">
  <img src="docs/banner.png" alt="rtl-skill: teach coding agents to build right-to-left interfaces, then check the result in a real browser" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2dd4bf" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-3c873a" alt="Node 20 or newer">
  <img src="https://img.shields.io/badge/works_with-Claude_Code_%7C_Cursor_%7C_Codex-7c3aed" alt="Works with Claude Code, Cursor and Codex">
</p>

Coding agents learned to write interfaces from left-to-right code. Ask one for an Arabic page and you get `margin-left`, phone numbers that read `1234 5555 974+`, and "next" arrows that point backwards.

rtl-skill has two parts. The skill teaches your agent the rules for Arabic, Persian, Hebrew and Urdu interfaces. The checker opens the finished page in Chromium and measures what rendered, down to where each character landed. It is written in strict TypeScript and drives Chromium through Playwright.

<p align="center"><img src="docs/before-after.png" alt="The demo store before and after: on the left the cart link, badge, progress bar, phone number and arrows are wrong; on the right they are correct" width="100%"></p>

Both pages use the same text and layout. The left one was built by hand with the bugs this project targets, and at a glance it looks done.

## Install the skill

Get the repository once, then install into any project:

```bash
git clone https://github.com/Ifazawezk/rtl-skill.git
cd rtl-skill
npm install
```

### Claude Code

```bash
node dist/rtl-skill.js install claude --dir /path/to/your/project   # writes .claude/skills/rtl/SKILL.md
node dist/rtl-skill.js install claude --global                      # writes ~/.claude/skills/rtl/SKILL.md
```

Or install it as a plugin from inside Claude Code:

```text
/plugin marketplace add Ifazawezk/rtl-skill
/plugin install rtl-skill@rtl-skill
```

The skill loads on its own when you work on RTL UI, and `/rtl` calls it directly.

### Cursor

```bash
node dist/rtl-skill.js install cursor --dir /path/to/your/project   # writes .cursor/rules/rtl.mdc
```

The rule attaches to HTML, CSS, JSX, TSX, Vue, Svelte and Astro files. If the whole project is RTL, set `alwaysApply: true` in the file.

### Codex and other AGENTS.md tools

```bash
node dist/rtl-skill.js install codex --dir /path/to/your/project    # adds a section to AGENTS.md
node dist/rtl-skill.js install codex --global                       # adds it to ~/.codex/AGENTS.md
```

The section sits between two markers, so your own notes in `AGENTS.md` stay as they are and running the command again updates it in place. It is about 22 KB, which fits in the 32 KiB that Codex reads by default.

To copy by hand instead, use [`skills/rtl/SKILL.md`](skills/rtl/SKILL.md), [`cursor/rtl.mdc`](cursor/rtl.mdc) or [`codex/AGENTS.md`](codex/AGENTS.md).

All three are generated from `skill-src/guide.md`, so they cannot drift apart. The guide covers `dir` and `lang`, logical CSS, flex and grid, icon mirroring, bidi isolation, mixed-direction inputs, Arabic fonts and line-height, truncation, `Intl` digits and calendars, charts and progress bars, and Tailwind, React and Vue. The bidi tables, `Intl` output, and input and overflow notes were measured in Chromium, some in WebKit too, and several first drafts turned out to be wrong: `type="tel"` fields are already LTR, and only `position: absolute` drawers add a scrollbar. The Tailwind notes were checked against its source. Notes on other libraries, such as Chart.js and MUI, were not run.

## Check a page

The `npm install` above already built the checker. Add the browser once:

```bash
npx playwright install chromium
```

Then point it at a URL or a local file:

```bash
node dist/rtl-check.js http://localhost:3000/ar
node dist/rtl-check.js demo/buggy/index.html --out rtl-report
```

After one `npm link` you get plain `rtl-check` and `rtl-skill` commands everywhere, and the rest of this page uses those.

Real output from the demo, shortened:

```text
rtl-check  demo/buggy/index.html
  1280x800, dir=rtl, lang=ar, 309 RTL and 11 LTR letters

   1  error    viewport-overflow     aside.drawer
      This box sticks out 300px past the left edge of the 1280px viewport and gives the page a horizontal scrollbar.

   6  error    bidi-order            p.help
      "+974 5555 1234" renders as "1234 5555 974+". Wrap it in <bdi dir="ltr"> or <span dir="ltr">.

  11  warning  physical-css          a.cart
      margin-left: auto is physical and stays on the same side in both directions. Use margin-inline-start: auto.
      css: .cart { margin-left: auto }
      at: demo/buggy/style.css:27

9 errors, 10 warnings
```

| Option | What it does |
| --- | --- |
| `--json` | Print the report as JSON |
| `--out <dir>` | Write `report.json`, `annotated.png` and `mirror.png` |
| `--viewport <WxH>` | Viewport size, 1280x800 by default |
| `--mobile` | Same as `--viewport 390x844` |
| `--force-rtl` | Set `dir="rtl"` first, for apps that start LTR |
| `--lang <tag>` | The `lang` to set with `--force-rtl` (default `ar`) |
| `--rules <ids>` | Run only these rules |
| `--skip <ids>` | Skip these rules |
| `--fail-on <level>` | Exit 1 on `error` (default), `warning` or `never` |
| `--wait-for <selector>` | Wait for an element before checking |
| `--wait <ms>` | Extra wait after load |
| `--timeout <ms>` | How long to wait for the page to load (default 30000) |
| `--no-color` | Plain output |

Exit codes: `0` nothing at the `--fail-on` level, `1` findings, `2` usage or runtime error.

`--force-rtl --lang ar` shows how an app that is not RTL yet would break. It only sets `dir`, so the text stays English, but the layout and icon rules still work.

In CI, run it against a preview build. This is a GitHub Actions step, but any CI works:

```yaml
- run: npm install -g github:Ifazawezk/rtl-skill
- run: npx playwright install --with-deps chromium
- run: npm run build && npm run preview &
- run: rtl-check http://localhost:4173/ar --mobile --out rtl-report
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: rtl-report
    path: rtl-report
```

Use `--fail-on warning` for apps that ship both LTR and RTL. Read the [limits](#limits) before you turn that on for an RTL-only site.

From code:

```ts
import { checkPage } from 'rtl-skill';

const report = await checkPage('http://localhost:3000/ar', { viewport: { width: 390, height: 844 } });
console.log(report.summary); // { errors: 2, warnings: 1 }
```

## Rules

| Rule | Default | What it finds |
| --- | --- | --- |
| `dir-attribute` | error | The page has right-to-left text but `<html>` is not `dir="rtl"`, or RTL paragraphs sit in an LTR block. |
| `lang-attribute` | error | `<html>` has no `lang`, or its `lang` does not match the script on the page (`lang="en"` on an Arabic page). |
| `physical-css` | warning | A left/right property (`margin-left`, `padding-right`, `left:`, `border-left`, `text-align: left`, `float`) that does not flip with the direction. |
| `mirror-mismatch` | warning | An element sits somewhere other than the mirror image of the LTR layout, for example a progress bar that still fills from the left. |
| `bidi-order` | error | A phone number, code snippet, order number or other LTR run renders in the wrong order inside RTL text, like "+974 5555 1234" showing as "1234 5555 974+". |
| `ltr-input` | warning | An email or URL field, or a phone field that is not `type="tel"`, is right to left, so its value reorders while the user types. |
| `icon-mirroring` | error | A directional icon (next, back, chevron, arrow, send) points the LTR way in RTL, or a non-directional icon (play, check, logo) was mirrored. |
| `viewport-overflow` | error | An element sticks out of the viewport and causes a horizontal scrollbar. In RTL this is often an absolutely positioned menu parked at `left: -300px`. |
| `text-clipped` | error | Text is cut off or spills out of a box with a fixed width or height. Arabic labels are often longer and taller than the English ones the box was sized for. |
| `arabic-letter-spacing` | error | Arabic script text has `letter-spacing`, which pulls joined letters apart. |

Errors are bugs you can see. Warnings need a look, because the checker cannot always tell a bug from a choice: a physical `margin-right` can be correct on an RTL-only site. Each finding links to the guide section that explains the fix, and `rtl-skill rules` prints this list.

`bidi-order` leaves dates, ranges and amounts alone. `2020-2024` in Arabic text shows as `2024-2020` if you read it left to right, but Arabic readers read it right to left, so it is correct. Phone numbers are always written left to right, so those are checked.

Some bugs only show up in another browser. Here is `letter-spacing` on Arabic in two engines: joined in Chromium, broken apart in WebKit. The layout rules run in Chromium only, but `arabic-letter-spacing` reads the CSS, so it catches this one for Safari as well.

<p align="center"><img src="docs/letter-spacing.png" alt="The same Arabic text with letter-spacing: joined in Chromium, disconnected letters in WebKit" width="85%"></p>

Four of the checks measure the rendered page instead of reading the source. `bidi-order` finds LTR runs in the text and asks the browser for the position of every character. If the characters of `+974 5555 1234` do not go left to right on screen, the run is out of order, and no regex over the source can see that. `mirror-mismatch` compares every box with its mirrored LTR position, which catches `transform` and `transform-origin` problems that a CSS scan misses.

`physical-css` renders the page in RTL, flips it to LTR and measures again. Logical CSS swaps sides and physical CSS stays put, whatever the source looks like, so `[dir="rtl"]` overrides written with `left` and `right` pass because they do flip. It then finds the rule that won the cascade and names its file and line. Stylesheets the page may not be able to read, such as anything on a CDN, are fetched separately. `icon-mirroring` takes the meaning from the button label ("التالي", "رجوع") and the artwork from the icon name, then resolves every CSS transform up the tree to see where the icon points on screen.

## Demo

[`demo/buggy`](demo/buggy) is a Doha checkout page with the bugs left in, and [`demo/fixed`](demo/fixed) is the corrected version. `npm run docs` runs both through the checker and saves the reports next to the images: [buggy](docs/demo/buggy-report.txt), [fixed](docs/demo/fixed-report.txt). The buggy page gets 9 errors and 10 warnings, across 9 of the 10 rules. The fixed page gets 0 and 0.

<p align="center"><img src="docs/demo/buggy-annotated.png" alt="Annotated screenshot of the buggy demo page with numbered boxes on every finding" width="100%"></p>

`mirror.png` puts the RTL render next to the flipped LTR render. On a correct page the boxes line up. Here the badge, the cart link and the button do not:

<p align="center"><img src="docs/demo/buggy-mirror.png" alt="The RTL render beside the flipped LTR render, with boxes on elements that do not line up" width="100%"></p>

## Measured results

The unit is one rule on one page. Full tables are in [`bench/`](bench), and `npm run bench` reproduces the current-code rows.

| Set | Pages | Found | False alarms | Missed | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Blind round 1, written after freezing the checker, hard on purpose | 40 | 16 | 1 | 9 | **94.1%** | **64.0%** |
| Blind round 2, new pages after fixing what round 1 found | 36 | 19 | 0 | 1 | **100.0%** | **95.0%** |
| Round 1 again with current code (no longer blind) | 40 | 22 | 0 | 3 | 100.0% | 88.0% |
| Regression fixtures the checker was developed against | 100 | 40 | 0 | 0 | 100.0% | 100.0% |

The blind rows are first runs, saved as [`holdout-first-run.md`](bench/holdout-first-run.md) and [`holdout-2-first-run.md`](bench/holdout-2-first-run.md) before any change was made for those pages. Expect recall on your code to fall somewhere between those two rows. Round 2 has only 20 bug pages, the same person wrote the pages and the checker, and nobody independent has tested it yet. One round 1 miss was a mistake in the test page: another rule overrode the bug, so there was nothing to find. The regression row only says nothing has broken, since those pages shaped the code, and 100% on them proves very little.

The checker also ran on live pages in October 2026. These have no answer key, so the counts below are not accuracy numbers. They show that it runs on real sites and what the noise looks like.

| Page | Elements | Errors | Warnings | Time |
| --- | ---: | ---: | ---: | ---: |
| Arabic Wikipedia, Doha | 4,103 | 1 | 52 | 11 s |
| Persian Wikipedia, Doha | 3,389 | 6 | 54 | 4 s |
| Hebrew Wikipedia, Doha | 2,795 | 0 | 18 | 2 s |
| BBC Arabic | 1,776 | 0 | 6 | 44 s |

The live pages had real bugs, such as `#coordinates` showing as `coordinates#`. They also set off false alarms the hand-written fixtures never did, and those fixes are now regression tests: ISO dates read as phone numbers, a carousel peek read as clipped text, and one menu reported 12 times. A fifth site, a large news page, stopped responding during the final run and is left out. Most of the warnings are `physical-css` on sites that generate a flipped stylesheet, covered in the next section.

## Limits

- A bare inline `<svg>` has no class, id or sprite name, so nothing says which way it points. Give it a class such as `icon-chevron-right`.
- Direction that exists only in paint is invisible to it. Gradients, `<canvas>` charts and background images are not boxes, so a progress bar drawn with `linear-gradient(to right, ...)` is missed.
- In `+974 <b>5555</b> 1234`, each piece is checked on its own and no piece looks like a phone number.
- Sites that flip their CSS at build time with RTLCSS or CSSJanus have an RTL stylesheet that really says `float: right`, and that is correct. `physical-css` and `mirror-mismatch` warn anyway, so use `--skip physical-css,mirror-mismatch`.
- It checks the page as loaded, in one viewport. Closed menus and later steps need their own URLs.
- Results were measured on Windows with Chromium 156. `text-clipped` depends on fonts, so a machine with no Arabic fonts can give different results.
- It does not replace testing with people who read the language. A native reader catches things no rule can, and the checker handles the mechanical bugs so reviewers can look at everything else.

It runs on your machine in a local browser, fetches only what your page already loads, and identifies itself with Chromium's normal headless user agent. If a site blocks it, it reports the failure or a note and moves on without trying to get around bot checks.

Not done yet: publishing to npm, working out which way an unnamed SVG points from its shape, a `--browser webkit` option to run the checks in Safari's engine, scanning a whole site from a sitemap and diffing against a baseline, an `arabic-font` rule that finds text rendered in a fallback font, checks after interactions such as opening menus and dialogs, and independent test pages from other Arabic and Hebrew developers.

## Related projects

Other RTL rules for coding agents exist. The ones below were found on GitHub in October 2026. Those with a checker read source code, which is fast, covers code that is not on the current page, and in some tools can fix the code for you. rtl-skill does neither of those last two, and checks the rendered page instead.

| Project | Rules for agents | Checks your code | Looks at the rendered page |
| --- | --- | --- | --- |
| rtl-skill | Claude Code, Cursor, AGENTS.md | No | Yes: positions, cascade, LTR vs RTL |
| [rtlify](https://github.com/idanlevi1/rtlify) | Yes, 7 editors | No | No |
| [arabic-ui](https://github.com/JKc66/arabic-ui) | Yes, with Arabic microcopy | No | No |
| [arabic-ready](https://github.com/jubyuhanna-create/arabic-ready) | Yes, also PDF, Word and charts | Yes, static | Renders screenshots for its evals |
| [rtl-ready](https://github.com/miraya-dev/rtl-ready) | Yes | Yes, static, with `--fix` | No |
| [mhamedmohammed92-arch/rtl-skill](https://github.com/mhamedmohammed92-arch/rtl-skill) | Claude Code, Cursor, AGENTS.md | Yes, static | No |
| [samuadda/rtl-skill](https://github.com/samuadda/rtl-skill) | Yes, with evals | Via the skill | No |
| [stylelint-logical-properties](https://github.com/csstools/stylelint-logical-properties) | No | Yes, CSS only | No |
| [RTLCSS](https://github.com/MohammadYounes/rtlcss) | No | Converts CSS to RTL | No |

## Contributing

New rules, fixtures and false-positive reports are welcome. A page where the checker gets it wrong is one of the most useful things you can send. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Copyright (c) 2026 Mohaned Elhagar.
