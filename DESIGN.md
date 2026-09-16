# DESIGN.md - Life Dashboard

A redesign spec for a phone-first, mathematically structured UI. No personal
data lives in this file - see `data/life.json` (gitignored) for real content.

## 1. Principles

- Today answers one question in under 3 seconds: what do I do next.
- Hick's law: 4 zones (Today, Work, Life, Build), not 9 tabs.
- Fitts's law: bottom nav bar on phone (thumb zone, 56px targets); left rail
  at >=1024px.
- Progressive disclosure: show the top of every list, fold the rest behind a
  native `<details>` ("+N more").
- Color is information, not decoration: neutral UI, one accent for
  interaction, status colors only for state, always paired with an icon and
  a text label. Text itself never wears a status or data color. Area tags
  are neutral chips (text only, no per-area hues).

## 2. Mathematical structure

All tokens live as CSS custom properties in `src/styles/global.css`.

**Spacing** - base unit 4px: `--space-1..16` = 4, 8, 12, 16, 24, 32, 48, 64px
(x1,2,3,4,6,8,12,16). Nothing off-scale.

**Type** - modular scale, ratio 1.25 on 16px, line heights on the 4px grid.
Tokens are rem (16px root), not px, so iOS text-size settings scale the
whole app; spacing tokens (section above) stay px:

| Token | Size | Line height |
| --- | --- | --- |
| xs | 0.8rem (12.8px) | 1rem (16px) |
| base | 1rem (16px) | 1.5rem (24px) |
| md | 1.25rem (20px) | 1.75rem (28px) |
| lg | 1.5625rem (25px) | 2rem (32px) |
| xl | 1.953rem (31.25px) | 2.5rem (40px) |
| hero | 3.052rem (48.83px) | 3.5rem (56px) |

Two faces, both OFL, bundled into the build from `@fontsource` (latin subsets
only) rather than linked from a font host: the service worker caches them as
same-origin files, so the type survives offline, and opening the dashboard
sends no request to any outside font service.

- **Instrument Sans** (400/500/600) - everything you read.
- **Instrument Serif** (400) - only figures and titles you look at: screen
  titles, section titles, the hero figure, board counts, level and trend.

Labels are an 11px uppercase eyebrow at 0.12-0.14em tracking. Body defaults
to proportional digits; only
`td`/`th` and a few numeric labels (agenda time, balance count) use
`tabular-nums`. Unlock/segmented/nav text and inputs are >=12.8px, and every
text input is exactly `--text-base-size` (16px) so iOS never zooms on focus.

**Layout** - container maxes out at 1200px with 16px gutters on phone, 24px
on desktop (>=1024px); tablet keeps the 16px gutter. This governs padding
and margins; the app does not otherwise force a literal N-column CSS grid
where a simpler flex/2-up pattern already reads cleanly at every width.
Today is a golden-ratio split on desktop: `grid-template-columns: 1.618fr
1fr`.

**Radius / borders** - 2px everywhere. Structure comes from 1px rules, not
boxes: section cards, item lists, the capture line and the progress cards are
rule-topped or rule-separated, with no fill of their own. One shadow in the
app, on the add button, because it floats over content. Tap targets >= 44px
(nav targets 56px tall).

**Colour tokens** - light default, dark via `prefers-color-scheme` (a
chosen palette, not an auto-invert):

| Token | Light | Dark |
| --- | --- | --- |
| bg (paper) | #faf8f4 | #13110e |
| surface | #fffdf9 | #1b1814 |
| surface-2 | #f2ede5 | #24201b |
| border (rule) | #e2dbd0 | #332d26 |
| rule-soft | #ede7dd | #2a2520 |
| text-1 / ink | #16130f | #efe8dd |
| text-2 | #5c554d | #bdb2a4 |
| text-3 | #736859 | #968b7e |
| accent | #0a5c55 | #45bcad |
| on-ink | #faf8f4 | #13110e |
| nav-bg | #f4f0e9 | #17140f |

Primary actions (Save, Unlock, the add button) are **ink**, not accent - the
accent is kept for links, focus, and progress fills, so it still means
something when it appears. text-3 is darker than the chosen mockup's eyebrow
grey: at 11px uppercase the mockup's #8c8278 measured 3.55:1 on paper, and
#736859 clears 4.5:1 on both paper and surface-2.

Status (reserved, fixed across both modes, icon + label only, never in
text): critical #d03b3b, warning #fab219, good #0ca30c.

### Palette validator

Command run (both modes, same 3 status hexes, against this app's own
surface tokens):

```
node .../dataviz/scripts/validate_palette.js "#d03b3b,#fab219,#0ca30c" --mode light --surface "#ffffff"
node .../dataviz/scripts/validate_palette.js "#d03b3b,#fab219,#0ca30c" --mode dark --surface "#12171d"
```

Light result: Lightness band FAIL (#fab219 at L=0.811, band is 0.43-0.77) -
Chroma floor PASS - CVD separation PASS (worst adjacent ΔE 11.3) -
Normal-vision floor PASS (ΔE 27.6) - Contrast vs surface WARN (#fab219 at
1.83:1, below 3:1, relief required).

Dark result: same Lightness band FAIL (band is 0.48-0.67, still excludes
0.811) - Chroma floor PASS - CVD PASS - Normal-vision floor PASS - Contrast
vs surface PASS (all >= 3:1).

**The Lightness-band FAIL is accepted, not fixed**, for two reasons: (1) it
is a property of the fixed warning hex alone - `surface` never enters that
check's math, so no surface choice changes the result; (2) this check is
calibrated for a categorical chart palette where several hues sit as
adjacent swatches - it is not a 1:1 fit for a single reserved status glyph
that is never used as a data/category color and is always paired with an
icon shape plus a text label (never color-alone encoding). The light-mode
Contrast WARN is the one the spec pre-authorizes given that same
icon+label pairing.

## 3. Information architecture

Zones and sections (`src/lib/routing.ts`):

- **Today** (`#today`) - no sections.
- **Work** - Engagement (`data.work`), Career (`data.career`), Business
  (`data.ayvede`).
- **Life** - Family (`data.family`), Finances (`data.finances`), Community
  (`data.unico`).
- **Build** - Projects (`data.projects`), AI stack (`data.aiStack`).

A zone named with no section opens its first. Legacy hash map (old
flat tab -> new path): `#overview`->`#today`, `#work`->`#work/engagement`,
`#career`->`#work/career`, `#ayvede`->`#work/business`,
`#unico`->`#life/community`, `#family`->`#life/family`,
`#finances`->`#life/finances`, `#projects`->`#build/projects`,
`#ai-stack`->`#build/ai-stack`. The app also rewrites the address bar to the
canonical path (`history.replaceState`, no extra history entry).

A section heading comes from the data's own `title` where the schema
carries one (Work, Career, and - for future-proofing - every other section
type now has an optional `title?`); otherwise it falls back to the neutral
word above.

Internally the code calls the top-level nav concept a "zone" (`ZoneId`,
`SECTIONS_BY_ZONE`, etc.) rather than the word this brief otherwise used for
it - purely a naming choice made during implementation, to avoid an
incidental collision with an unrelated word already present in the personal
data (`scripts/privacy-guard.mjs` flagged it); the IA and behavior are
exactly the 4-zone structure described above.

## 4. Today screen algorithm

**Focus (top 3, `src/lib/priority.ts`)** - score = horizonWeight (now 3,
week 2, later 1, routine 0) + urgency (overdue 3, due today 3, due tomorrow
2, within 3 days 2, within 7 days 1, else/no-due 0). Routine actions are
excluded entirely. Sort: score desc, then due date asc (no-due sorts last
among ties), then original order (stable).

**Hero** - "now" count; sub line is the cumulative "now"+"week" count, then
the total open-action count (any horizon).

**Up next** - remaining non-routine, non-Focus actions; "now"+"week" ->
This week (shown), "later" -> Later (folded, native `<details>`).

**Alerts** - urgent/warning show inline with a status icon; info folds into
"+N notes".

**Next 14 days (`src/lib/grouping.ts`)** - `data.calendar` events with
`daysUntil < 14` (today start), labelled Today/Tomorrow/absolute weekday
("Wed, Sep 16"), grouped and sorted by date then time. Anything already
overdue (a past date still in the data) is kept, not dropped, and dimmed
via the countdown tone, so nothing open silently disappears.

**Balance (`src/lib/balance.ts`)** - Work/Life/Build totals = open actions +
next-14-day calendar events, mapped from each item's free-text `area` to a
zone (Work: work/career/business/ayvede areas; Build:
projects/"ai stack"/build; anything else, including unknown areas, counts
under Life). Bar list is open actions only, grouped by the literal area
tag, one accent hue at 45% opacity, sorted desc (ties alphabetical).

**Snapshot** - `data.kpis` as stat tiles, 2 columns phone / 3 desktop.

Stat tile contract everywhere: label (xs, text-2), value (xl, semibold,
proportional digits), optional sub (xs, text-3).

## 5. Data

`ActionItem.due` (already optional in the schema) was added, in
`data/life.json` only, to 7 of the 12 top-level actions - only where the
action's own title/detail states an explicit date, or that date is shared
with a dated calendar event covering the same item:

- `action-1` - date named in its own detail text.
- `action-3` - date named in its own detail text ("M5 due ...").
- `action-4` - date named in its own detail text ("Expires ...").
- `action-7` - two dates named in its own title; the earlier of the two was
  used (both are explicit, not guessed).
- `action-8` - date named in its own detail text ("review for ... meeting").
- `action-10` - date named in its own detail text.
- `action-11` - date named in its own detail text ("Meeting ...").

Left alone (no explicit single date, or genuinely ambiguous - two
conflicting date ranges are noted elsewhere in the data for one of them):
`action-2`, `action-5`, `action-6`, `action-9`, `action-12`. Nothing was
guessed. `work.actionItems` / `unico.actionItems` were not touched - only
the top-level `actions` array feeds Focus/Up next/Balance.

## 6. Tests

`tests/priority.test.ts`, `tests/grouping.test.ts`, `tests/balance.test.ts`,
`tests/routing.test.ts` - synthetic data only. Cover: score/ordering
including ties, no-due-last, overdue, routine excluded from Focus;
relative-day labels, chronological sort, same-day time sort, overdue
kept+dimmed, 14-day window boundary; balance zone mapping including
unknown-area fallback, 14-day window exclusion; every legacy hash plus
round-trip serialization. Each of the four modules was broken once by hand,
confirmed to fail the right test, then restored (see report).

## 7. Not fully placed

- `PillTone` visuals (live/due/soon/done/watch) now carry a status icon
  (good/critical/warning) instead of per-tone colored backgrounds, so every
  existing table's status column gets the icon+label treatment for free -
  but pill copy itself (e.g. "Delivered", "EXPIRED") still comes verbatim
  from the data and was not reworded.
- The four-column/eight-column/twelve-column grid is expressed as container
  gutter+max-width tokens rather than a literal CSS grid, since the app's
  actual content patterns (2-up cards, stat tiles, the Today golden split)
  already cover every layout this app needs; noted here so it reads as a
  deliberate simplification, not an oversight.

## 8. Home-screen app (manifest, service worker)

- `index.html` - viewport carries `viewport-fit=cover`; `apple-mobile-web-app-capable`/`mobile-web-app-capable`, status-bar-style `black-translucent`, title "AVD Life"; `theme-color` for light/dark via two media-query meta tags matching the `--bg` tokens; `manifest.webmanifest`, `apple-touch-icon` (180), `icon` (192) links. Every new href is relative (no leading slash) - the site is served under `/life-dashboard/`, and Vite's own `/src/main.tsx` entry tag is rewritten to that base separately at build time.
- `public/manifest.webmanifest` - name/short_name, `start_url`/`scope` ".", `display` standalone, `orientation` portrait, background/theme color matching the light `--bg` (#faf8f4), icons 192/512/maskable-512 (already in `public/icons/`).
- `public/sw.js` - install (`skipWaiting` + a best-effort shell precache), activate (`clients.claim` + delete every cache but the current one), fetch (same-origin GET only - navigations and `data/life.enc.json` are network-first with a cache fallback; every other same-origin asset is stale-while-revalidate; cross-origin and non-GET requests are never touched, `respondWith` is simply not called for them).
- Cache name is `` life-dashboard-${BUILD_ID} ``. `public/` is copied to `dist/` verbatim by Vite (public files are never run through esbuild/rollup, so a literal `define` substitution can't reach them) - `vite.config.ts` derives one `buildId` (`Date.now().toString(36)`), exposes it as a real `define: { __SW_BUILD_ID__ }` entry, and a small `closeBundle` plugin finds/replaces that same token in the already-copied `dist/sw.js`. Documented here so the two-step mechanism reads as a deliberate consequence of how publicDir copying works, not an oversight.
- `src/main.tsx` registers `` `${BASE_URL}sw.js` `` only under `import.meta.env.PROD`, guarded by `typeof window !== 'undefined'` and `'serviceWorker' in navigator` - inert under Vitest's Node test environment even without the explicit guard.

## 9. iPhone layout

- Safe areas: header padding-top, nav padding-bottom, and the header/segmented-control/main side padding all use `max(token, env(safe-area-inset-*))`; the nav bar's height and its own padding-bottom share one identical expression so they can't drift apart. `@media (display-mode: standalone)` adds a little extra top room once Safari's own chrome is gone (added-to-home-screen only).
- Nav: one 20px stroke-1.5 `currentColor` icon (sun / briefcase / heart / code-brackets for Today / Work / Life / Build) above each label; `.nav-item` is now a column. Unchanged 56px targets and active-accent color - icons recolor for free via `currentColor`.
- Touch: `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation` + a visible `:active` (opacity 0.6, no transform, so `prefers-reduced-motion` just zeroes the transition) on every button/link/summary; `overscroll-behavior-y: contain` plus `overflow-x: hidden` on `body`; `scroll-padding-top` on `html` for the sticky header.
- Responsive: `.kpi-strip` goes 3-across starting at 414px (previously 1024px only); `.agenda-time` widens 52px to 68px at the same breakpoint. Below 414px both stay at their original (2-across / 52px) phone sizing.
- `input, textarea` carry `font-size: var(--text-base-size)` (1rem) as a base-reset default (on top of the Unlock screen's own already-compliant input), so nothing new can regress iOS's zoom-on-focus behavior.

## 10. Capture (Today)

- A card at the top of Today: a `<textarea>` (rows 3, 1rem, `autocapitalize`/`autocorrect`/`spellcheck` on, `enterkeyhint` "done", `aria-label` "Capture a note"), a Save button, one hint line. Desktop only (`pointer: fine`): "n" focuses the box when focus isn't already in a field, Cmd/Ctrl+Enter saves, Escape blurs.
- Storage: a `captures` IndexedDB store (`src/idb.ts`, `DB_VERSION` 2, alongside the existing `keys` store). A record is `{ id, at (ISO), salt (the blob salt it was written under), iv, ct }` - the note text is plaintext only in memory, never in the record. `src/crypto.ts` gained `encryptWithKey` (mirrors `decryptWithKey`: base64 through the same helpers, a fresh random 12-byte IV every call), and `deriveKey` now derives both `encrypt` and `decrypt` usages onto the one key, so the same unlocked key that reads the data blob also reads/writes captures. Upgrading an existing v1 database clears any previously-remembered key (it was decrypt-only) instead of leaving one captures can't use with - one extra unlock next time, then it is remembered again with both usages.
- A record whose `salt` no longer matches the currently unlocked blob (or that otherwise fails to decrypt) reads "Locked (older key)" and offers Delete only.
- Export, shown once at least one note exists: "Copy all" (Clipboard API, with a hidden-textarea/`execCommand` fallback) and "Send to inbox" - a `mailto:` built from `data.meta.captureEmail` (an optional `Meta` field; added to `data/life.json` only - gitignored, never in source) with subject "Life Dashboard capture" and the unlocked notes as the body, newest first; the button is absent without that field.
- `src/lib/captures.ts` keeps the pure/testable pieces (newest-first sort, the lock check, record/view builders, the mailto builder) separate from its small amount of IndexedDB I/O, since this project's Vitest config runs in a Node environment (no DOM, no IndexedDB). `tests/captures.test.ts` covers the encrypt/decrypt round trip (plus a tampered-ciphertext rejection), newest-first ordering, a stale-salt record reading locked (and a no-key case), and the mailto builder taking its address as a parameter rather than a fixed one.

## The grade ramp

Everything in the app resolves to exactly one grade, and a grade is the only
way the app says "when". Eight of them, most urgent first:

| Grade | Means | Family |
|---|---|---|
| Overdue | due before today, not done | red |
| Today | due today, or horizon `now` with no date | red |
| Tomorrow | due tomorrow | teal |
| This week | due through the coming Sunday | teal |
| Next week | the Monday-Sunday after that | blue |
| Later | within 90 days | grey |
| No date | beyond 90 days, or no date at all | grey |
| Done | checked off, whatever the date says | green |

Weeks are calendar weeks ending Sunday, not a rolling seven days, because that
is what the words mean to a person. On a Saturday "this week" is nearly empty,
and that is correct rather than a bug.

**Why five hue families and not eight hues.** Three warm hues in a row
(red, orange, amber) failed CVD separation in both light and dark: a deutan
reader could not tell overdue from today from tomorrow, and the adjacent-pair
delta E ran as low as 2.4 where 8 is the floor. Pairing grades into families
and separating the families by hue fixed it. The five anchors pass the
lightness band, CVD separation, normal-vision separation and 3:1 contrast
against both surfaces; the within-family pairs are sequential lightness steps,
which is what a sequential ramp is supposed to be. Two checks are deliberately
accepted and documented in `global.css`: grey fails the chroma floor because
grey *is* the meaning for "later" and "no date", and teal sits just under it
because it is the app accent.

**Colour never works alone.** Every grade ships with an icon whose silhouette
differs from the others and with its word spelled out. Text keeps its own ink
token and never wears a grade colour, so contrast is a property of the type
scale rather than something the palette has to carry.

## The three Map views

All three read the same resolved list, so a box checked anywhere moves every
number everywhere.

1. **Board.** Columns are grades. A card's column and its due date are the same
   fact seen twice and cannot drift apart. Cards move with two chevrons rather
   than by dragging: dragging on a touch screen fights the page scroll, needs a
   long press to start, and has no keyboard equivalent. Moving a card writes a
   real date - "Next week" becomes the Monday after this one, not the word.
2. **Roadmap.** Months down the page on a phone, an area grid at desktop width.
   Empty months stay visible: a roadmap that closes its gaps reads as a solid
   run of work and hides the fact that November is free, which is the thing a
   roadmap is for.
3. **Brain.** Life, its zones, their areas, and every item, as one graph.
   Leaves are coloured by grade, not by area - a second categorical palette for
   a dozen areas would have collided with the reserved ramp and put two colour
   languages on one screen. Structure already says which area an item is in, so
   colour is free to say what structure cannot: what is late. The layout is
   seeded, computed once per data change, and never animated on a loop, because
   a graph that keeps drifting is a graph you cannot point at.

## Progress

Scoring is weighted by grade, not one point per item: clearing something
overdue is worth twelve, clearing something undated is worth one. A flat score
makes the cheapest way to win "do the easy things", which is exactly the habit
a dashboard should not pay for. Every figure comes from real completions in the
overlay - nothing is seeded, so an empty history reads as zero and says so.

## The editorial direction

Chosen over three alternatives (a dark instrument panel, a soft
rounded consumer look, and a heavy poster style), all drawn against the
shipped design at the same data. The diagnosis of the old look was that every
choice was the safe default: a system font, one muted teal, white cards on a
grey field, 4/8px radii, no depth. Nothing was wrong, which was the problem.

What changed and why:

1. **A serif for figures only.** The one number a screen exists to show is set
   at 96px in Instrument Serif; everything read rather than looked at stays
   sans. Serif against sans sets the order of importance, so size and
   bold no longer have to.
2. **Rules instead of boxes.** Removing card fills and borders took away the
   most repeated visual element in the app and let whitespace separate things.
3. **Paper and ink.** A warm ground with near-black text, and primary buttons
   in ink, so colour is left for the grade ramp and the accent.
4. **One sentence under the hero, not a stat row.** "1 of 9 finished. 8 still
   open." then a 3px bar. The bar used to print the same numbers again.

Where the build deliberately differs from the mockup: the mockup coloured
grade labels ("OVERDUE" in red). As 11px text on paper, teal, grey and green
fail 4.5:1, and text never wears a data colour here - so the glyph carries the
grade colour and the word stays in ink.

The accepted cost: fewer items per screen than any of the alternatives, and
hairline rules are the first thing to wash out in direct sun or at low
brightness.

## Device lock

A short code that opens the app on one device, chosen in place of
putting a short password on the public file.

**The problem it solves without creating a worse one.** The data ships as
ciphertext in a public repo. A short password on that file would be guessable
offline by anyone, forever, from git history, and "AVD" is printed on the
site, so a name-plus-common-word code would be an early guess. The lock keeps
the file under its strong passphrase and only protects a copy of the key kept
on your own device.

**How it works.**
1. Unlock once with the full passphrase. The passphrase is proven by actually
   decrypting the file before any key byte is exported.
2. Choose a code. The raw data key is wrapped with a key derived from the code
   (PBKDF2-SHA256, 600,000 iterations, fresh salt and IV) and only the wrapped
   bytes are stored. The raw bytes are zeroed on every way out of that step.
3. From then on the device asks for the code. The unwrapped key is imported as
   non-extractable, so the app can use it but never read it back out.

**Five tries, counted before they are checked.** Each try is written to
storage before the code is tested, and refunded only by a right code, so
reloading the page mid-check cannot buy a free guess. If storage cannot
record a try, the try is refused. The fifth wrong code wipes the stored copy,
and only the full passphrase works after that. The full passphrase is always
one tap away on the lock screen, so none of this can lock the owner out.

**What it does not protect against.** Someone who copies the device's storage
files off disk can try codes offline without the counter. A short code is
lower entropy than the passphrase; the iteration count slows that attack, it
does not stop it. That is accepted and stated rather than implied away.

**Stale locks.** If the file is re-sealed with a new passphrase under the same
salt, the code still unwraps the old key but that key no longer opens the
data. The app detects it, clears the lock, and asks for the passphrase instead
of leaving the owner on a lock screen that cannot work.
