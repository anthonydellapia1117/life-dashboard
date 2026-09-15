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

**Type** - modular scale, ratio 1.25 on 16px, line heights on the 4px grid:

| Token | Size | Line height |
| --- | --- | --- |
| xs | 12.8px | 16px |
| base | 16px | 24px |
| md | 20px | 28px |
| lg | 25px | 32px |
| xl | 31.25px | 40px |
| hero | 48.83px | 56px |

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
