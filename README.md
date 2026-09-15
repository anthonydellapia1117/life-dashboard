# Life Dashboard

A personal dashboard: work, career, UNICO treasury, side projects, family, finances, and AI tool stack. Single page app, one tab per section.

## How the data works

The repo and the deployed site never contain plaintext personal data. All real content lives in `data/life.json`, which is gitignored and never committed. The site ships only `public/data/life.enc.json` - an AES-256-GCM blob, encrypted with a key derived from a passphrase via PBKDF2-SHA256 (600000 iterations, random salt and random IV per seal).

The browser fetches that encrypted file, asks for the passphrase once, derives the same key with WebCrypto, and decrypts client-side. Nothing decrypted is ever written to localStorage or sessionStorage. "Remember on this device" stores only the derived AES key (non-extractable) in IndexedDB, keyed by the blob's salt, so it still works after a data update that reuses the same salt.

## Updating the data

1. Edit `data/life.json`.
2. `npm run seal` - encrypts it into `public/data/life.enc.json`. Reuses the existing salt and iteration count unless you pass `--rotate`.
3. `npm run guard` - scans the repo for anything that looks like a leaked plaintext value. Must pass before you commit.
4. Commit and push. GitHub Actions runs typecheck, tests, and build, then deploys to GitHub Pages.

Passphrase source for `seal`, in order: the `LIFE_DASHBOARD_PASSPHRASE` environment variable, the macOS keychain (service and account both `life-dashboard`), or a hidden terminal prompt.

## Stack

Vite, React 19, TypeScript in strict mode. No UI kit, no chart library - small inline SVG for sparklines and progress bars. Vitest for tests.

## Local development

```
npm install
npm run dev
```

The dev server fetches the same `public/data/life.enc.json` the production build does, so you need a sealed file and its passphrase to see real content locally.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run seal` | Encrypt `data/life.json` |
| `npm run guard` | Scan for plaintext leaks |

## Repo layout

- `src/` - the React app
- `data/life.json` - plaintext source data (gitignored, never committed)
- `public/data/life.enc.json` - the encrypted blob the app fetches
- `scripts/seal.mjs`, `scripts/privacy-guard.mjs` - zero-dependency Node scripts
- `.githooks/pre-commit` - runs the privacy guard before every commit
