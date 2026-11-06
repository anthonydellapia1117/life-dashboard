# DESIGN.md - Life Dashboard

The design system as shipped. No personal data lives in this file - see
`data/life.json` (gitignored) for real content.

## 1. Principles

The brief: an ADHD brain reads the app in one glance.

- **Which tab am I on, in half a second.** Every tab owns a colour world: page
  ground, header band, accent and ink. The tab name sits in the display face
  on the world band, first thing under the nav.
- **The number is the tile.** Key figures are 52px (44px phone) display-face
  numerals with a 12px caps label under them, in the same slot on every tab.
- **Colour means the same thing everywhere.** Grade colours (`--grade-*`) and
  bucket colours (`--bucket-1..6`) never change per world. A world recolours
  ground, cards, ink and accent only.
- **One roadmap.** Tabs run left to right in one guided order. A 3px rail under
  the nav shows where now sits in the day, the week and the month, and a Next
  card at the bottom of each tab leads to the next one.
- **Every list ends.** Lists are capped and end in "+N more"; "Show all
  details" lifts the caps on the tabs that have it.
- **Nothing blinks.** Only background, colour and border cross-fade (250ms),
  and reduced motion removes even that.
- Progressive disclosure, one sticky glass top nav on every width, the add
  button bottom right in thumb reach. Status is never colour alone: every
  grade chip carries its icon and its word.

## 2. Mathematical structure

All tokens live as CSS custom properties in `src/styles/global.css`.

**Spacing** - base unit 4px: `--space-1..16` = 4, 8, 12, 16, 24, 32, 48, 64px
(x1,2,3,4,6,8,12,16). Nothing off-scale.

**Type** - two faces. Space Grotesk 500 and 700 (`--font-display`) for
numbers, the header band and titles; self-hosted at
`public/fonts/space-grotesk-latin.woff2` (latin subset, 22KB, SIL OFL with
`OFL.txt` beside it), `font-display: swap`, precached by `public/sw.js` so the
app still works offline. Body stays the Apple system stack (`--font-sans`).
Tabular numerals on every figure.

| Role | Size | Face | Used for |
| --- | --- | --- | --- |
| hero | 64 / 700 | display | Today's one hero figure |
| figure | 52 / 700 (44 phone) | display | StatTile values, bucket hero tiles |
| title | 28 / 700 | display | header band tab name |
| title2 | 22 / 700 | display | Life OS section titles |
| body | 17 / 400 | system | item titles, default text |
| subhead | 15 / 500 | system | controls, chips, tabs, More |
| caption | 12 / 400-600 | system | labels, meta, rail marks |

At most three body sizes in any one view; 13, 16 and 11 are gone (the old
`--t-*` names now point at 12 or 15). Headings use `text-wrap: balance`;
running text is held to 65ch. Every text input stays at 16px or more so iOS
never zooms on focus. The old rem scale (`--text-*`) is kept for rules that
still read it.

**Layout** - container maxes out at 1200px (the nav at 1440px) with 16px
gutters on phone, 24px on desktop. Today keeps its golden-ratio split on
desktop (`1.618fr 1fr`).

**Radius / depth** - three radii: `--radius-s` 10px (controls, chips, list
items), `--radius-m` 14px (grouped cards, stat tiles), `--radius-l` 20px (the
header band, the web, sheets). No drop shadows on cards: grouping comes from white cards
on the grey ground and 0.5px inset separators between rows (a row's hairline
starts after its check circle, as in iOS Settings). The only shadow is the
raised segment of a segmented control and the add button.

**Glass** - the nav: `--glass` rgba(255,255,255,.72) light, rgba(28,28,30,.72)
dark, with `backdrop-filter: saturate(180%) blur(20px)` and a 0.5px
`--separator` edge. The nav background is
`color-mix(in srgb, var(--world-band) 55%, var(--glass))`, so it tints toward
the active world and stays glass.

**Colour tokens** - the neutral world (Life OS, Today, Map). Light, then dark
via `prefers-color-scheme`. A
`data-theme="light"|"dark"` attribute on `<html>` overrides the system
setting (dark block guarded with `:root:not([data-theme="light"])` and
repeated under `:root[data-theme="dark"]`). There is no toggle in the UI yet.

| Token | Light | Dark |
| --- | --- | --- |
| background | #F2F2F7 | #000000 |
| card (grouped) | #FFFFFF | #1C1C1E |
| fill (secondary) | rgba(120,120,128,.16) | rgba(120,120,128,.24) |
| label | #000000 | #FFFFFF |
| label-2 (secondary) | rgba(60,60,67,.6) | rgba(235,235,245,.6) |
| separator | rgba(60,60,67,.29) | rgba(84,84,88,.6) |
| blue (accent) | #007AFF | #0A84FF |
| green | #34C759 | #30D158 |
| orange | #FF9500 | #FF9F0A |
| red | #FF3B30 | #FF453A |
| gray | #8E8E93 | #8E8E93 |

The older names (`--bg`, `--surface`, `--text-1..3`, `--accent`, `--border`)
are aliases onto these, so every rule written before the restyle follows.
`--text-3` is a solid grey (#6C6C70 / #98989D) rather than label-2, so small
captions keep contrast on both the card and the ground.

**Buckets** - categorical, separate from the grade ramp, always named in words
beside the colour: `--bucket-1` Me #1f9a8a / #4cc9c0, `--bucket-2` Family
#d14d7a / #ff86ad, `--bucket-3` Career & Network #3f6fd8 / #8fa8ff,
`--bucket-4` Money Ventures #2f9e55 / #6fd895, `--bucket-5` Bills & Finances
#c48a1f / #e8b54a, `--bucket-6` Work #7a4fb8 / #b08ae8.

### Colour worlds

`src/lib/world.ts`: `worldFor(zone, section)` is a pure lookup and
`applyWorld(doc, world)` sets `html[data-world]` and rewrites every
theme-color meta (light and dark steps from `THEME_COLORS`). App.tsx calls it
on every route change. Each world sets `--world-ground`, `-ground-ink`,
`-ground-ink-2`, `-card`, `-card-ink`, `-card-ink-2`, `-accent`, `-band`; one
block then maps the semantic tokens components already read (`--background`,
`--label`, `--label-2`, `--separator`, `--fill`, `--glass`, `--blue`,
`--accent`) onto them, and one rule re-scopes ink inside card containers
(`.card, .group, .tile, .stat-tile, table` and friends) to the card steps. No
component carries per-world CSS.

| World | Routes | Ground (light / dark) | Accent |
| --- | --- | --- | --- |
| neutral | lifeos, today, map | #F2F2F7 / #000000 | system blue |
| work | work/engagement, work/career | brand purple #4F2D7F / color-mix 62% with black | white on ground, purple in cards |
| ayvede | work/business | #0b1120 in both modes | #2EC4A8 on controls and links only |
| life | life/* | #FFF1B8, band #FFE48A / #2A2410 | #8A5A00 / #F5C64A |
| build | build/* | #E6ECF4 plus a 24px drafting grid / #1C222B | ink, links underlined |
| claude | claude | #faf9f5, band #d97757 / #141413 | #d97757 marks |

Dark steps are chosen per world, not an automatic flip; every work tint is a
color-mix of #4F2D7F with the neutrals, never a new purple hex. The Ayvede
token set has no light variant, so that world uses one palette in both modes.
Gold #C7A26B is for thin rules and small labels only. Dark ink on the orange
Claude band (#141413 on #d97757 is about 6:1); white on it is about 3:1 and is
never used. Accepted tensions: the work purple matches bucket 6 purple, and
the Ayvede teal sits near bucket 1 teal; chips always carry number and name.

**Transitions** - `html, body, .topnav, .app-header, .card, .group,
.stat-tile, .tile` cross-fade background, colour and border over 250ms.
goToZone wraps the route change in `document.startViewTransition` with
flushSync where the API exists and reduced motion is off; the root view
transition runs 250ms. Under `prefers-reduced-motion` all of it is removed.

Status (reserved, fixed across both modes, icon + label only, never in
text): critical #d03b3b, warning #fab219, good #0ca30c. The grade ramp is
unchanged (see below); it was validated on white and near-black surfaces,
which the Apple card colours match closely.

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

Zones and sections (`src/lib/routing.ts`), in nav order:

- **Life OS** (`#lifeos`) - the landing route for an empty hash. No sections.
- **Today** (`#today`) - no sections. Unknown hashes still fall back here.
- **Work** - Engagement (`data.work`), Career (`data.career`), Business
  (`data.ayvede`).
- **Life** - Family (`data.family`), Finances (`data.finances`), Community
  (`data.unico`).
- **Build** - Projects (`data.projects`), AI stack (`data.aiStack`).
- **Map** - Board, Roadmap, Brain, Progress.
- **Claude** (`#claude`) - Claude work (`data.claude`, `src/tabs/Claude.tsx`). See Claude tab below.

`ZONE_IDS` is also the guided order: `nextZone(zone)` returns the tab to its
right and null after Claude, so the roadmap ends rather than loops.

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

**Caps (`CAPS` in `src/lib/rail.ts`)** - focus 3, up next 5 (each track
under it too, and every section list), agenda 5 per day, tables 8, board
columns 8, Claude streams 12, code and projects 15. `capItems` is the pure slice; `src/components/More.tsx` holds
the one "+N more" / "Show less" button (44px target) and `useCapped`, which
NodeList, Agenda, DataTable and the Claude lists all use.

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

**Snapshot** - `data.kpis` as stat tiles, 2 columns phone.

**StatTile** (`src/components/StatTile.tsx`) is the one KPI style:
`{ label, value, delta?, series?, href?, alert? }`. Value first in the DOM,
display face 52px (44px phone), weight 700, tabular; label 12px caps,
letter-spacing .06em, `--label-2`, below it; an optional delta line; a
sparkline in the world accent only where real per-day history exists
(completions for Momentum and Progress, chats and code sessions per day on
the Claude tab). Fewer than two points draws no sparkline. `alert` turns the
figure the overdue grade colour (brand orange on the Claude tab). A
`StatRow` of them is the first thing under the header band, most important
first: Overdue, Due this week, Open. `KeyNumbers` is that row as one
component (counts from `kpiCounts`); Life OS, every Work, Life and Build
section (via SectionOverview) and the Map views open with it.

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

Vitest in a node environment, synthetic data only, 26 files. The redesign
added four: `tests/world.test.ts` (worldFor for every zone and section,
unknown falls back to neutral, applyWorld on a fake document in both modes),
`tests/webLayout.test.ts` (same seed same layout, no visible labels overlap,
every node inside the fitted viewport, each hull contains its members),
`tests/fit.test.ts` (fitTransform centring, padding, clamping, zero-size
content, clampZoom, zoomAbout) and `tests/rail.test.ts` (Monday 0 and Sunday
6, week and month shares at the edges, nextZone order and null at the end,
capItems and the cap table).

The original four - `tests/priority.test.ts`, `tests/grouping.test.ts`,
`tests/balance.test.ts`, `tests/routing.test.ts` - synthetic data only. Cover: score/ordering
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
- `public/manifest.webmanifest` - name/short_name, `start_url`/`scope` ".", `display` standalone, `orientation` portrait, background/theme color matching the light `--background` (#F2F2F7), icons 192/512/maskable-512 (already in `public/icons/`).
- `public/sw.js` - install (`skipWaiting` + a best-effort shell precache, plus the display font fetched on its own so a missing font never costs the shell), activate (`clients.claim` + delete every cache but the current one), fetch (same-origin GET only - navigations and `data/life.enc.json` are network-first with a cache fallback; every other same-origin asset is stale-while-revalidate; cross-origin and non-GET requests are never touched, `respondWith` is simply not called for them).
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
Board and Brain share `src/lib/fit.ts` (`fitTransform`, `clampZoom`,
`zoomAbout`, pure) and `src/components/ViewControls.tsx` (Zoom out, Fit, Zoom
in, optional dots). The Board zooms through a `--map-zoom` CSS variable
between 0.5 and 1.5 that sets column width and type, so columns reflow rather
than blur; Fit picks the zoom that shows every column. On the phone eight
dots track the board's scroll and tap to a column. The Brain opens fitted
(40px pad), zooms between 0.35 and 3, and keeps Reset view beside Fit.

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

## Roadmap rail and Next

`src/lib/rail.ts` `weekPosition(now)` returns `dayIndex` (Monday 0 to Sunday
6), `dayPct`, `weekPct`, `monthPct` and a plain label. All three shares are
continuous - the time of day counts - and in local time. `Rail.tsx` draws them
under the nav as three marks, Today, This week and This month, each a 3px
track filled in the world accent; the label is the accessible name. It moves
only when the page renders, never on a timer.

`NextTab.tsx` closes every tab except Claude: a 44px card with the next tab's
world swatch (its light or dark ground), "Next" and its name in the display
face, and a chevron drawn in SVG. No arrow characters.

## Hit targets and spacing

`.seg-item`, `.bchip` and `.btn-tinted` are 44px targets: under 1024px they
grow to min-height 44; on desktop the visual stays 30px and an `::after`
pseudo-element extends the hit area to 44 (the tab track stops clipping so
it can). Groups on a tab sit `--space-6` apart.

## Containers are information

Kept from the Apple direction: white grouped cards on the ground, no
shadows, 0.5px separators inset past the check circle; segmented controls
wherever a view switches; chip rows for buckets (a coloured dot, the number,
the name). The worlds recolour the ground and cards, never the structure.

## Global bucket filter

`src/lib/filter.ts` holds one value: a bucket 1-6 or none, persisted in
localStorage under `lifeos.filter` (a UI preference, never item content).
Set it from a nav chip, a bucket tile, a bucket hero tile or a hub in the web; the
selected one again clears it; Esc or Clear filters clears it.

Any element with `data-bucket="N"` takes part, on any tab, with no extra
wiring: `installFilterDom()` (mounted once in `App.tsx`) gives the others
`.is-dimmed` (opacity .15, grayscale, no pointer events, 200ms) and the
matches `.is-match` (a 2px ring in the bucket colour). Controls that change
the filter carry `data-bucket-chip` instead, so they are never dimmed. The
SVG web reads `useBucketFilter()` and dims itself.

## Life OS tab

`src/tabs/LifeOsTab.tsx`, lazy loaded so d3 loads with this tab only;
three.js is gone. In order: the StatRow (Overdue, Due this week, Open); six
bucket hero tiles where the number is the tile in bucket colour, with a
segmented control for the metric (Open items, Due this week, or Files filed
from the 2026-11-06 Mac file sort); a tile sets the global filter. Then the
web, the bucket tiles, the tiebreak line and the folder map.

**The web** - layout is pure in `src/lib/webLayout.ts`: d3-force run to
completion synchronously with a seeded random source and the hexagon hub
seeds, a soft hull per bucket (`d3.polygonHull` on padded member points,
drawn with `curveCatmullRomClosed`, fill 12% and stroke 22% of the bucket
colour), links as quadratic curves, and greedy label placement (below, above,
right, left) tested against placed labels and node circles, hub first, then
section, then node. A label that fits nowhere is hidden and shown on hover.
`LifeWeb.tsx` renders it as SVG: hubs are rounded pills in bucket colour with
number and name in white; hover lights a node and its neighbours and fades
the rest to .15 over 150ms; a hub click sets the global filter; a six-chip
legend sits under the stage; Fit and Labels work; d3-zoom loads on demand,
0.4 to 3. `lifeosGraph.ts` keeps every export name.

The web's nodes, links, tile copy and folder map live in `data/lifeos.json`
(gitignored). `npm run seal` folds it into the sealed blob as `lifeos`, so it
ships encrypted like everything else; without it the tab shows hubs and
generic tile copy.

## Claude tab

`src/tabs/Claude.tsx`, pure helpers in `src/lib/claude.ts`. The claude
world: Claude's own palette, the orange band with dark ink. A StatRow (Chats,
Cowork tasks, Code sessions on this Mac, Scheduled tasks active, Unread, with
per-day sparklines from `updated` where history exists), then three columns: Scheduled tasks 280px, Claude fluid, Code
320px. Under 900px they stack Claude, Code, Scheduled tasks.

- **Scheduled tasks** - a 24h / 3d / 7d / 2w / 1m window (default 7d, kept in
  localStorage `lifeos.claude.window`). Active above Paused. A task that
  neither ran nor is due inside the window is dimmed. No run history yet
  reads "last run unknown".
- **Claude** - Chat and Cowork streams, newest first by `updated`, 12 rows
  each with a "+N more" expander; "Show all details" lifts every cap on the
  tab. Unread is `updated` after localStorage `lifeos.claude.lastSeen` (a
  timestamp, never content), seeded on the first visit with the feed's
  generated time. Unread rows get the highlighter: a tint of #d97757 (14% light,
  18% dark), a 3px orange bar and a semibold title. "Mark all read" sets
  lastSeen to now.
- **Code** - Latest (each project's recent titles at its last time, 15 rows)
  or By project (sessions, last time, three recent titles, 15 projects), cloud sessions
  in their own group, the feed's note underneath.

The feed is `data/claude.json` (gitignored), built on the Mac by the
claude-dashboard `build_data.py` and folded in by `npm run seal` as
`claude`. Its `refresh.sh` rebuilds, seals and pushes the blob.

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
