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

All tokens live as CSS custom properties in `src/styles/global.css` (297
lines).

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

One typeface: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
Roboto, "Helvetica Neue", Arial, sans-serif`. Fraunces, JetBrains Mono, and
the Google Fonts link are gone. Body defaults to proportional digits; only
`td`/`th` and a few numeric labels (agenda time, balance count) use
`tabular-nums`. Unlock/segmented/nav text and inputs are >=12.8px, and every
text input is exactly `--text-base-size` (16px) so iOS never zooms on focus.

**Layout** - container maxes out at 1200px with 16px gutters on phone, 24px
on desktop (>=1024px); tablet keeps the 16px gutter. This governs padding
and margins; the app does not otherwise force a literal N-column CSS grid
where a simpler flex/2-up pattern already reads cleanly at every width.
Today is a golden-ratio split on desktop: `grid-template-columns: 1.618fr
1fr`.

**Radius / borders** - 4px controls, 8px cards, 1px hairline borders one
step off the surface, no shadows anywhere. Tap targets >= 44px (nav targets
56px tall).

**Colour tokens** - light default, dark via `prefers-color-scheme` (a
chosen palette, not an auto-invert):

| Token | Light | Dark |
| --- | --- | --- |
| bg | #f5f6f8 | #0b0f14 |
| surface | #ffffff | #12171d |
| surface-2 | #eef1f4 | #1a2027 |
| border | #dde2e8 | #262d36 |
| text-1 | #11151a | #f2f4f6 |
| text-2 | #4b5563 | #a7b0bb |
| text-3 | #6b7280 | #7c8794 |
| accent | #0f766e | #2dd4bf |

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
- `public/manifest.webmanifest` - name/short_name, `start_url`/`scope` ".", `display` standalone, `orientation` portrait, background/theme color matching the light `--bg` (#f5f6f8), icons 192/512/maskable-512 (already in `public/icons/`).
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
