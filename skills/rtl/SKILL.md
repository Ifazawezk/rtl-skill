---
name: rtl
description: "Build and review right-to-left (RTL) interfaces for Arabic, Persian, Hebrew and Urdu: dir and lang, CSS logical properties instead of left/right, flex and grid direction, icon mirroring, phone numbers and code inside RTL text (bdi, dir=ltr islands), mixed-direction inputs, Arabic fonts and line-height, no letter-spacing on Arabic, truncation, Intl dates and digits, charts and progress bars, and Tailwind, React and Vue specifics. Use when writing or fixing UI that must work in an RTL language, when a page contains Arabic, Persian, Hebrew or Urdu text, or when the user mentions RTL, bidi, dir=rtl or Arabic UI."
---

# Right-to-left (RTL) interfaces

Arabic, Persian (Farsi), Urdu and Hebrew are written from right to left. A correct RTL interface is not a mirrored screenshot. The layout mirrors, but phone numbers, code, URLs, media controls and logos keep their own direction. Follow this guide whenever you write or change UI that will be shown in an RTL language, and check the result in a browser before you call the work done.

## Quick checklist

1. `<html lang="ar" dir="rtl">` (with the right language) is set from the active locale in one place.
2. No `left` or `right` in layout CSS. Use logical properties: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-inline-start`, `text-align: start`.
3. Flex rows and grid columns are left alone. They already follow `dir`. Never add `row-reverse` to "make it RTL".
4. Directional icons (back, next, chevrons, arrows, send, reply, undo) are mirrored in RTL. Media controls, check marks, clocks and logos are not.
5. Phone numbers, order ids, code, URLs, emails and Latin names inside RTL text are isolated with `<bdi>` or `dir="ltr"`.
6. Email, URL, phone and code inputs have `dir="ltr"`. Free-text inputs have `dir="auto"`.
7. Arabic-script text has a font with Arabic glyphs, a line-height of at least 1.5 for body text, no letter-spacing and no italics.
8. Boxes that hold text have no fixed width or height. Translated labels change length, and Arabic lines are taller.
9. Numbers, dates and currency go through `Intl` with a full locale such as `ar-QA`, and the digit system is a deliberate choice.
10. Progress bars, sliders, steppers and carousels run from the right. Chart axes follow a documented product decision.
11. Transforms (`translateX`, `transform-origin`) and JavaScript that reads or sets `left` are made direction-aware.

## Document direction and language

Set both attributes on the root element:

```html
<html lang="ar-QA" dir="rtl">
```

- `dir` drives layout, the Unicode bidi algorithm, `:dir()` and `[dir="rtl"]` selectors, and Tailwind's `rtl:` variant.
- `lang` drives font fallback, hyphenation, quotation marks, `:lang()` selectors and the screen reader voice.
- Do not use CSS `direction: rtl` instead of the attribute. Assistive technology, `[dir]` selectors and Tailwind variants do not see CSS direction.
- Derive both from the locale in one place:

```js
const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'ckb', 'dv', 'yi']);

export function directionOf(locale) {
  const loc = new Intl.Locale(locale);
  const info = loc.getTextInfo ? loc.getTextInfo() : loc.textInfo; // Chromium, Safari, Node
  if (info && info.direction) return info.direction;
  return RTL.has(loc.language) ? 'rtl' : 'ltr'; // Firefox has no textInfo
}

document.documentElement.lang = locale;
document.documentElement.dir = directionOf(locale);
```

- An English block inside an Arabic page gets `dir="ltr" lang="en"` on its own container. Do not flip the whole page.
- Content whose language you do not know (comments, chat messages, names, search results) gets `dir="auto"` on each item, so each item takes the direction of its first strong letter.

## Logical CSS properties

Physical properties stay on the same side whatever the direction. Logical properties follow `dir`.

| Physical (stays put) | Logical (flips with dir) |
| --- | --- |
| `margin-left`, `margin-right` | `margin-inline-start`, `margin-inline-end` |
| `padding-left`, `padding-right` | `padding-inline-start`, `padding-inline-end` |
| `left`, `right` on positioned boxes | `inset-inline-start`, `inset-inline-end` |
| `border-left`, `border-right` | `border-inline-start`, `border-inline-end` |
| `border-top-left-radius` | `border-start-start-radius` |
| `border-top-right-radius` | `border-start-end-radius` |
| `border-bottom-left-radius` | `border-end-start-radius` |
| `border-bottom-right-radius` | `border-end-end-radius` |
| `text-align: left` / `right` | `text-align: start` / `end` |
| `float: left` / `right` | `float: inline-start` / `inline-end` |
| `clear: left` / `right` | `clear: inline-start` / `inline-end` |
| `margin: 0 16px 0 0` | `margin-block: 0; margin-inline: 0 16px` |
| `width`, `height` | `inline-size`, `block-size` (optional) |

- Symmetric values are fine: `margin: 0 auto`, `padding: 8px 16px`, `left: 0; right: 0`.
- Four-value shorthands for `margin`, `padding`, `inset`, `border-width` and `border-radius` are physical. Split them into `-block` and `-inline` pairs.
- These never flip on their own: `transform: translateX()`, `transform-origin: left`, `background-position: left`, `object-position`, `box-shadow` x offsets, and gradients that say `to right`. Override them for RTL:

```css
.drawer { transform: translateX(-100%); }
[dir="rtl"] .drawer { transform: translateX(100%); }

.shadow-start { box-shadow: 4px 0 8px rgb(0 0 0 / 0.1); }
[dir="rtl"] .shadow-start { box-shadow: -4px 0 8px rgb(0 0 0 / 0.1); }
```

- `:dir(rtl)` works in all current browsers and also matches elements whose direction comes from an ancestor. `[dir="rtl"] &` works everywhere.
- Keep a physical value only when the thing must not mirror, such as a video scrubber or a code block.

## Flex, grid and positioning

- `display: flex` with `flex-direction: row` already starts from the right in RTL. `justify-content: flex-start` means the right side. Do not add `row-reverse` or `order` for RTL: with `dir="rtl"` set, that reverses twice and puts the first item on the left.
- Grid columns, `grid-column: 1 / 3` and `grid-template-areas` follow `dir` too.
- Push an item to the end with `margin-inline-start: auto` (Tailwind `ms-auto`), not `margin-left: auto`.
- Absolutely positioned boxes (badges, close buttons, tooltips): `inset-inline-end: 8px`, not `right: 8px`.
- Off-canvas menus: in an RTL document, overflow to the left becomes scrollable. A drawer parked at `left: -300px` (fine in LTR) adds a horizontal scrollbar to the RTL page. Hide closed panels with `visibility: hidden` or `display: none`, or move them with `inset-inline-start` plus a direction-aware transform.
- Horizontal scroll containers: `scrollLeft` is 0 at the start edge and negative toward the end in RTL in all current browsers. Use `scrollBy({ left: dir === 'rtl' ? -step : step })` or `scrollIntoView({ inline: 'start' })`.
- JavaScript positioning for tooltips, popovers and dropdowns: read `getComputedStyle(el).direction` and place relative to the start edge, or use a positioning library that supports `-start` / `-end` placements in RTL.
- Fixed widths wider than a phone screen (`width: 480px` on a card, `min-width` on a table) overflow to the left in RTL. Use `max-inline-size: 100%`.

## Icons: mirror or not

Mirror in RTL. These point along the reading direction or through content:

- back and forward, previous and next, chevrons in breadcrumbs, pagination, list rows and "read more" links
- send, reply, reply all, forward (mail), undo and redo, log out and exit, indent and outdent
- arrows on steppers and progress, and any icon that shows lines of text (swap "align left" and "align right")

Do not mirror:

- media controls: play, pause, fast forward, rewind, skip. They follow tape direction, not reading direction.
- check marks, clocks, timers and other icons that show time running clockwise
- logos, brand marks, flags, and icons that contain Latin letters or digits
- most real-world objects (a phone handset, a camera, a magnifying glass) unless your design system says otherwise

How to mirror:

```css
[dir="rtl"] .icon-directional { transform: scaleX(-1); }
```

```html
<a href="/orders?page=2" aria-label="الصفحة التالية">
  <svg class="icon icon-directional" aria-hidden="true"><use href="#chevron-right"></use></svg>
</a>
```

- Tailwind: `class="rtl:-scale-x-100"` on the icon.
- Or swap the asset by direction: `isRtl ? <ChevronLeft /> : <ChevronRight />`.
- If an icon already has a transform (rotation, animation), combine them in one declaration, otherwise the RTL rule replaces the other transform. Or use the separate `scale: -1 1` property, which stacks with `transform`.
- Give icon-only buttons an `aria-label` that names the action ("التالي", "رجوع"). Screen readers need it, and so does any checker that has to decide which way the icon should point.

Arrow characters: `→` and `←` (and `➜`, `⇒`) are not mirrored by the bidi algorithm. "اقرأ المزيد →" shows an arrow pointing back. Write `←` for "forward" in RTL text, or use a mirrored icon. Paired characters `( ) [ ] { } < > « » ‹ ›` are mirrored automatically inside RTL runs, so `‹` in RTL text already shows the right way.

## Numbers, phone numbers, code and URLs inside RTL text

The Unicode bidi algorithm reorders runs of text. Runs of a single direction are safe. Trouble starts when weak or neutral characters (digits, `+`, `-`, `#`, `()`, `.`) sit at the edges of a Latin or number run inside RTL text. These are real Chromium renderings, read left to right:

| Source text | Shows on screen |
| --- | --- |
| `اتصل بنا على +974 5555 1234` | `1234 5555 974+` (groups reversed) |
| `رقم ٥٥٥٥ ١٢٣٤` | `١٢٣٤ ٥٥٥٥` |
| `رقم الطلب #A-1029` | `A-1029#` |
| `تعلم C++ اليوم` | `++C` |
| `استدع print() أولا` | `()print` |
| `C# و .NET` | `#C` and `NET.` |
| `قطر +974` | `974+` |

Isolate the island so it is laid out on its own, left to right:

```html
<p>اتصل بنا على <bdi dir="ltr">+974 5555 1234</bdi></p>
<p>رقم الطلب <span dir="ltr">#A-1029</span></p>
<p>استدع <code dir="ltr">print()</code> أولا</p>
```

- `<bdi>` isolates its content. Add `dir="ltr"` when you know the content is LTR. Without it, `<bdi>` guesses from the first strong letter.
- `<span dir="ltr">` isolates too: in HTML, any element with a `dir` attribute gets `unicode-bidi: isolate`.
- In CSS: `.ltr { direction: ltr; unicode-bidi: isolate; }`.
- In plain strings where you cannot add markup (`title`, `placeholder`, `<option>`, `aria-label`, notifications, `document.title`), wrap the value in Unicode isolates: LRI `U+2066` ... PDI `U+2069` for LTR, or FSI `U+2068` ... PDI when the direction is unknown.

```js
const ltr = (s) => `⁦${s}⁩`;
t('call_us', { phone: ltr('+974 5555 1234') });
```

- Code blocks: `<pre dir="ltr">` and `<code dir="ltr">`. Inline code inside Arabic text needs it too.
- Ranges and fractions in running Arabic text (`من 10 إلى 20`, `2020-2024`) are read right to left by Arabic readers. Leave them as they are.
- User content in either direction: `dir="auto"` on each message, and `unicode-bidi: plaintext` for multi-paragraph text where each paragraph may differ.
- Do not fix order with invisible marks (RLM `U+200F`, LRM `U+200E`) sprinkled by hand. Isolation is easier to read and does not leak into copy and paste.

## Forms and mixed-direction inputs

```html
<label for="email">البريد الإلكتروني</label>
<input id="email" type="email" dir="ltr" autocomplete="email" placeholder="name@example.com">

<label for="phone">رقم الجوال</label>
<input id="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="+974 5555 1234">

<label for="name">الاسم</label>
<input id="name" dir="auto" autocomplete="name">
```

- `dir="ltr"` on email, URL, phone, IBAN, card number, coupon code, username and password fields. Without it a typed `+974 5555 1234` shows with its groups reversed, and an email jumps around while the user types `@` and `.`.
- With `dir="ltr"` the value is aligned left. To keep it on the right edge like the other fields, add `text-align: right` to that input. The value keeps its LTR order.
- `dir="auto"` for names, addresses, messages and search boxes, which people type in either script.
- Accept Arabic-Indic digits. Many people type `٥٥٥٥` on an Arabic keyboard. Normalize before validating:

```js
// U+0660..U+0669 (Arabic-Indic) and U+06F0..U+06F9 (Persian) -> 0..9
const toLatinDigits = (s) => s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
```

- Prefer `type="text" inputmode="numeric"` over `type="number"` for codes and phone numbers.
- Put the "show password" toggle, the clear button and the error icon on the start or end side with logical properties, not with `right: 8px`.
- Label and checkbox spacing: use `gap` on a flex row instead of `margin-left` on the label.

## Arabic typography

- Use a font that has Arabic glyphs. A Latin web font with a generic fallback leaves Arabic to whatever font the operating system picks, at a different size and weight:

```css
:root { font-family: "Inter", system-ui, sans-serif; }
:lang(ar) { font-family: "IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif; }
:lang(fa) { font-family: "Vazirmatn", "Noto Sans Arabic", Tahoma, sans-serif; }
:lang(ur) { font-family: "Noto Nastaliq Urdu", "Noto Naskh Arabic", serif; line-height: 2.2; }
:lang(he) { font-family: "Heebo", "Noto Sans Hebrew", "Segoe UI", Arial, sans-serif; }
```

- Good families with Arabic: IBM Plex Sans Arabic, Noto Sans Arabic, Noto Naskh Arabic, Cairo, Tajawal, Almarai, Readex Pro, and Vazirmatn for Persian. Load only the weights you use. Arabic fonts are large, and `unicode-range` lets Latin and Arabic come from separate files.
- Line height: Arabic has tall ascenders, deep descenders and marks above and below the letters. Use at least 1.5 for body text and about 1.25 for headings. Nastaliq (Urdu) needs about 2 to 2.3.
- Never put `letter-spacing` on Arabic-script text. Arabic letters join, and spacing pulls them apart: Safari (WebKit) draws every letter disconnected. Current Chromium ignores letter-spacing on Arabic, so the page looks fine in Chrome and breaks in Safari and other iOS browsers. Reset it after the rule that sets it:

```css
.btn, .eyebrow { letter-spacing: 0.08em; }
:lang(ar) .btn, :lang(ar) .eyebrow,
:lang(fa) .btn, :lang(fa) .eyebrow,
:lang(ur) .btn, :lang(ur) .eyebrow { letter-spacing: 0; }
```

- `text-transform: uppercase` and small caps do nothing for Arabic, so do not rely on case for emphasis. Most Arabic fonts have no italic and the browser fakes a slant. Use weight or color, and set `:lang(ar) em, :lang(ar) i { font-style: normal; }`.
- Arabic looks smaller than Latin at the same `font-size`. Many products raise Arabic body text by 1 or 2 pixels.
- Avoid `text-align: justify` on narrow Arabic columns. Browsers stretch the spaces instead of using kashida, which leaves rivers.
- Do not use `word-break: break-all` on Arabic. It splits joined words. Use `overflow-wrap: anywhere` only for long Latin tokens such as URLs.

## Truncation and text that grows

- Translated labels change length, and Arabic lines are taller than Latin ones. Do not give buttons, tabs, badges, chips or table headers a fixed `width` or `height`. Use `min-inline-size`, `padding-inline` and `min-block-size`, and let them grow.
- `overflow: hidden` with a fixed `height` cuts off Arabic marks below the baseline even when the text fits on one line.
- Truncate on purpose, never by accident:

```css
.title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } /* the ellipsis lands on the left in RTL */
.excerpt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
```

- Give truncated user content `dir="auto"` so the ellipsis sits at the end of each item in its own direction.
- Test with real translations, not lorem ipsum, and with the longest language you ship.

## Dates, numbers and currency with Intl

Pass a full locale to `Intl`. Do not build these strings by hand. Output below is from Chromium 156:

```js
const d = new Date(Date.UTC(2026, 9, 30));
new Intl.NumberFormat('ar-QA').format(1234.5);                 // "١٬٢٣٤٫٥"
new Intl.NumberFormat('ar-QA-u-nu-latn').format(1234.5);       // "1,234.5"
new Intl.NumberFormat('ar-QA', { style: 'currency', currency: 'QAR' }).format(1250.5); // "١٬٢٥٠٫٥٠ ر.ق." wrapped in U+200F marks
new Intl.DateTimeFormat('ar-QA', { dateStyle: 'long' }).format(d); // "٣٠ أكتوبر ٢٠٢٦"
new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' }).format(d); // "۸ آبان ۱۴۰۵" (Solar Hijri calendar)
```

- Digits depend on the locale. `ar-QA`, `ar-SA` and `ar-EG` give Arabic-Indic digits (١٢٣). `ar-AE`, `ar-MA` and plain `ar` give Latin digits (123). `fa` gives Persian digits (۱۲۳), which differ from Arabic ones for 4, 5 and 6. `he` and `ur-PK` give Latin digits.
- Always pass a region (`ar-QA`, not `ar`), and choose the digit system on purpose. Many Gulf products show Latin digits in Arabic UI with `-u-nu-latn`. Never mix digit systems on one screen.
- Calendars: `fa-IR` formats in the Solar Hijri calendar by default. Ask for one explicitly when it matters: `ar-SA-u-ca-islamic-umalqura` for Hijri, `-u-ca-gregory` for Gregorian.
- Currency and percent strings from Intl contain invisible direction marks (`U+200F`, `U+200E`, `U+061C`). Keep them, and normalize them away before comparing strings in tests.
- Arabic has six plural categories (zero, one, two, few, many, other). Use `Intl.PluralRules('ar')` or ICU MessageFormat, never `count === 1 ? a : b`.
- `new Intl.RelativeTimeFormat('ar', { numeric: 'auto' }).format(-1, 'day')` gives "أمس". `Intl.ListFormat` joins lists with the right conjunction.

## Charts, progress bars and sliders

- Progress bars, steppers, sliders, carousels and rating stars run from the right in RTL. Native `<progress>` and `<input type="range">` already do. Custom ones break when built with `left: 0`, `transform-origin: left` or `translateX`:

```css
/* breaks: still fills from the left in RTL */
.bar-fill { transform-origin: left; transform: scaleX(var(--progress)); }

/* works: size it and let it flow from the start side */
.bar-fill { inline-size: calc(var(--progress) * 100%); }
```

- Charts: for bar and column charts, mirror the category order and put the value axis on the right. For time series, make one product decision and document it: some Arabic products mirror time to run right to left, many financial ones keep it left to right.
  - Chart.js: `scales.x.reverse: true`, `scales.y.position: 'right'`, and `rtl: true` on `plugins.legend` and `plugins.tooltip`.
  - ECharts: `xAxis.inverse: true`, `yAxis.position: 'right'`.
  - Recharts: `<XAxis reversed />` and `<YAxis orientation="right" />`.
- SVG text: set `direction: rtl` on `<text>` elements with Arabic. With it, `text-anchor: start` anchors the right edge.
- Carousels: swipe and arrow keys reverse. In RTL, ArrowLeft means "next". Swiper reads `dir="rtl"` from its container. Embla takes `direction: 'rtl'`.

## Tailwind CSS

- Logical utilities (v3.3 and later): `ms-*` and `me-*` (margin-inline), `ps-*` and `pe-*` (padding-inline), `start-*` and `end-*` (inset-inline), `border-s` and `border-e`, `rounded-s-*`, `rounded-e-*`, `rounded-ss-*`, `rounded-se-*`, `rounded-es-*`, `rounded-ee-*`, `text-start` and `text-end`, `scroll-ms-*`. `float-start` and `float-end` arrived in v3.4.
- Replace on sight: `ml-2` with `ms-2`, `pr-4` with `pe-4`, `left-0` with `start-0`, `text-left` with `text-start`, `rounded-l-lg` with `rounded-s-lg`, `border-r` with `border-e`, `ml-auto` with `ms-auto`.
- Use the `rtl:` and `ltr:` variants for what logical utilities cannot say: `rtl:-scale-x-100` on directional icons, `ltr:-translate-x-full rtl:translate-x-full` on a closed drawer.
- `space-x-*` uses physical margins in v3. Add `rtl:space-x-reverse`, or better, use `gap-*`. In v4, `space-x-*` uses logical margins.
- The `rtl:` variant matches `[dir="rtl"]` on an ancestor (v4 also matches `:dir(rtl)`). Set `dir` on `<html>`, not only through CSS.

```html
<!-- before -->
<div class="flex items-center">
  <img class="mr-3 h-10 w-10 rounded-l-full" src="/avatar.png" alt="">
  <p class="text-left">مرحبا</p>
  <svg class="ml-auto h-4 w-4"><use href="#chevron-right"></use></svg>
</div>

<!-- after -->
<div class="flex items-center gap-3">
  <img class="h-10 w-10 rounded-s-full" src="/avatar.png" alt="">
  <p class="text-start">مرحبا</p>
  <svg class="ms-auto h-4 w-4 rtl:-scale-x-100" aria-hidden="true"><use href="#chevron-right"></use></svg>
</div>
```

## React

```tsx
// Next.js App Router: app/[locale]/layout.tsx
export default async function RootLayout({ children, params }) {
  const { locale } = await params;
  return (
    <html lang={locale} dir={directionOf(locale)}>
      <body>{children}</body>
    </html>
  );
}
```

- In client-rendered apps, set `document.documentElement.dir` and `lang` in an effect when the locale changes. A `dir` on a wrapper div is not enough: portals (modals, toasts, menus) render outside it.
- Inline styles support logical properties: `style={{ marginInlineStart: 8 }}` instead of `marginLeft`.
- Component libraries have an RTL switch. Use it instead of overriding their CSS: MUI `createTheme({ direction: 'rtl' })` plus an Emotion cache with `stylis-plugin-rtl`, Radix `<DirectionProvider dir="rtl">`, Ant Design `<ConfigProvider direction="rtl">`, Mantine `<DirectionProvider>`.
- Mirror directional icons in one wrapper instead of at every call site:

```tsx
export function DirectionalIcon({ as: Icon, className = '', ...props }) {
  return <Icon aria-hidden="true" className={`rtl:-scale-x-100 ${className}`} {...props} />;
}

<DirectionalIcon as={ChevronRight} className="h-4 w-4" />
```

- React Native: `I18nManager.forceRTL(true)` and restart the app. Use `marginStart`, `marginEnd`, `paddingStart`, `start` and `end` instead of left and right, and `I18nManager.isRTL` for icons.

## Vue

```js
import { watch } from 'vue';

watch(locale, (value) => {
  document.documentElement.lang = value;
  document.documentElement.dir = directionOf(value);
}, { immediate: true });
```

- Nuxt: `useHead({ htmlAttrs: { lang, dir } })`.
- `<Teleport to="body">` content inherits the direction of `<html>`, which is one more reason to set `dir` there.
- Bind logical inline styles: `:style="{ marginInlineStart: '8px' }"`.
- Vuetify and Quasar have RTL options. Turn them on instead of overriding their CSS.

## Common bugs: before and after

Icon spacing inside a button:

```css
/* before: the gap is on the wrong side in RTL */
.btn .icon { margin-right: 8px; }
/* after */
.btn { display: inline-flex; align-items: center; gap: 8px; }
```

A badge in the corner of a card:

```css
/* before */
.badge { position: absolute; top: 8px; right: 8px; }
/* after */
.badge { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; }
```

A quote or alert with an accent border:

```css
/* before */
blockquote { border-left: 4px solid var(--accent); padding-left: 16px; }
/* after */
blockquote { border-inline-start: 4px solid var(--accent); padding-inline-start: 16px; }
```

A phone number in a sentence:

```html
<!-- before: shows 1234 5555 974+ -->
<p>للاستفسار اتصل على +974 5555 1234</p>
<!-- after -->
<p>للاستفسار اتصل على <bdi dir="ltr">+974 5555 1234</bdi></p>
```

A "next" link with a text arrow:

```html
<!-- before: the arrow points back in RTL -->
<a href="/step-2">التالي →</a>
<!-- after -->
<a href="/step-2">التالي <svg class="icon icon-directional" aria-hidden="true"><use href="#arrow-right"></use></svg></a>
```

An off-canvas menu:

```css
/* before: adds a horizontal scrollbar to the RTL page */
.drawer { position: fixed; top: 0; left: -300px; width: 300px; }
/* after */
.drawer { position: fixed; inset-block: 0; inset-inline-start: 0; inline-size: 300px; visibility: hidden; transform: translateX(-100%); }
[dir="rtl"] .drawer { transform: translateX(100%); }
.drawer.open { visibility: visible; transform: none; }
```

A letter-spaced heading:

```css
/* before */
.eyebrow { text-transform: uppercase; letter-spacing: 0.12em; }
/* after */
.eyebrow { text-transform: uppercase; letter-spacing: 0.12em; }
:lang(ar) .eyebrow { letter-spacing: 0; }
```

A button that fits "Add" but not "إضافة إلى السلة":

```css
/* before */
.btn { width: 96px; height: 36px; overflow: hidden; white-space: nowrap; }
/* after */
.btn { min-inline-size: 96px; min-block-size: 36px; padding-inline: 16px; }
```

Double reversal:

```css
/* before: with dir="rtl" on <html>, this puts the first item on the left again */
[dir="rtl"] .toolbar { flex-direction: row-reverse; }
/* after: delete the rule; flex rows already follow dir */
```

## Check your work

Look at the page in the browser in RTL before you finish. If the project has `rtl-check` (from github.com/Ifazawezk/rtl-skill), run it against the running page and fix every error it reports:

```bash
npx rtl-check http://localhost:3000/ar --out rtl-report
```

It opens the page in Chromium, renders it in RTL and LTR, and reports missing `dir` and `lang`, physical CSS, layout that does not mirror, LTR islands rendered out of order, LTR fields without `dir`, icons that point the wrong way, overflow past the viewport, clipped text and letter-spacing on Arabic. `rtl-report/annotated.png` marks every finding on a screenshot.
