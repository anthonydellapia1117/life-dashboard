# CLAUDE.md - Life Dashboard

Rules for any agent working in this repo.

## Hard rules

1. Never commit plaintext personal data. `data/life.json` and both `anthony-dellapia-life-dashboard-v*.html` prototypes are gitignored and must stay that way. If either is ever staged, unstage it before committing.
2. Before every commit that touches `data/life.json`: run `npm run seal`, then `npm run guard`. The guard must pass. The pre-commit hook (`.githooks/pre-commit`, wired up by `npm run prepare`) runs the guard automatically, but do not rely on that alone - run it yourself and read the output.
3. Anonymize client engagements in `data/life.json` and everywhere else in this repo: Client A (healthcare), Client B (banking), Client C (manufacturing), Clients D-I (six deals), Client J (advisory), Prospect K (IT services). Never write the real names back in. The employer, colleague names and anything that says what the Career tab tracks live only in the encrypted data - never in code, docs or commit messages; tab headings and labels come from the data for that reason.
4. Dates are absolute ISO strings (`YYYY-MM-DD`, or full ISO 8601 with an offset for timestamps). Never write relative words like "tomorrow" into the data - the UI computes "in 3 days", "today", "overdue" live from the current date.
5. Hyphens only in any prose you write - never em dashes or en dashes. No emojis.
6. CI (`.github/workflows/deploy.yml`) never runs `seal` or `guard` - there is no plaintext in CI, only the already-sealed `public/data/life.enc.json`.

## Where things live

- `src/types.ts` - the `LifeData` schema. Every tab renders from a slice of it; a missing section renders a quiet empty state, it never throws.
- `src/crypto.ts` - browser-side decrypt (WebCrypto, PBKDF2-SHA256 plus AES-256-GCM).
- `scripts/seal.mjs` - Node-side encrypt. Zero dependencies.
- `scripts/privacy-guard.mjs` - scans tracked files (and `dist/`) for anything that looks like a leaked value from `data/life.json`.

## Before you ship anything

Run, in order: `npm run typecheck`, `npm test`, `npm run build`. If `data/life.json` changed, also run `npm run seal` then `npm run guard` before committing.
