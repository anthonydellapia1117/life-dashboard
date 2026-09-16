#!/usr/bin/env node
/**
 * Privacy guard - fails the build/commit if plaintext personal data could
 * leak into the git tree or the built site.
 *
 * What it does:
 *   1. If data/life.json exists, walks it and collects every string value
 *      of length >= 5 and every number with 4+ digits (as text). A small,
 *      documented set of structural/vocabulary keys is skipped (see
 *      STRUCTURAL_SKIP_KEYS below) because their values are UI chrome that
 *      is expected to also appear in this project's own source and docs
 *      (status-pill tones, tab/area names, tool names, data-source names),
 *      not personal content. Everything else - names, addresses, account
 *      numbers, dollar figures, free-text detail/body copy - is collected.
 *   2. Scans every git-tracked file (or, if nothing is tracked yet, every
 *      file `git ls-files --others --exclude-standard` would add) plus
 *      every file under dist/, case-insensitive, for any of those values.
 *   3. On a hit, fails and prints the file path and a short sha256 of the
 *      matched value - never the value itself.
 *   4. Also fails if data/life.json or either prototype HTML file would be
 *      tracked by git.
 *
 * Zero dependencies - Node 20+ only.
 *
 * The repo root normally defaults to one directory up from this script. Set
 * PRIVACY_GUARD_ROOT to point the guard at a different directory instead -
 * this only exists so the test suite can run the real CLI against a throwaway
 * sandbox repo without touching this project's own git state.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..');

export const FORBIDDEN_PATHS = [
  'data/life.json',
  'anthony-dellapia-life-dashboard-v1.html',
  'anthony-dellapia-life-dashboard-v2.html',
];

// JSON object keys whose values are structural/UI vocabulary (status-pill
// tones, tab/area names, tool-stack labels, data-source names, our own
// invented id slugs) rather than personal content. These are expected to
// recur in this project's own source, docs, and CSS by design, so they are
// excluded from the sensitive-value set. Actual content fields (name,
// title, detail, body, notes, contact, amount, etc.) are never skipped.
export const STRUCTURAL_SKIP_KEYS = new Set([
  'id',
  'pill',
  'pillLabel',
  'horizon',
  'severity',
  'visibility',
  'area',
  'sources',
  'status',
  'state',
  'generatedBy',
  'tool',
  'component',
]);

// Exact, case-insensitive full-value matches (not substrings) that are safe
// to skip regardless of which key they live under: single generic words or
// short product names that are guaranteed to recur in this project's own
// UI copy, config, or - unavoidably - in React's own minified bundle
// (performance.getEntriesByType, unstable_priorityLevel, batchedUpdates,
// and similar internals contain "entries", "prior", "dates" as substrings).
// This is a short, deliberate list built by tracing every real hit back to
// its source; it is not a general-purpose way to hide real content, and
// multi-word names/phrases/numbers are never exempted this way.
const SAFE_VALUES = new Set([
  'recurring',
  'tests',
  'entries',
  'latest',
  'stack',
  'life-dashboard',
  'title',
  'dates',
  'action',
  'prior',
  'removed',
  'blocks',
  'platform',
  'committed',
  // A note label in the career data; also tsconfig's compiler target and
  // event.target in the bundle.
  'target',
  // Ordinary English words that happen to be values in the data and read
  // naturally in test names and code comments.
  'review',
  'current',
]);

// The sealed output file (public/data/life.enc.json, and its dist/ copy
// once built) is ciphertext plus non-secret metadata (v, kdf, iter, salt,
// iv, ct, sealedAt) by construction - covered by the seal/decrypt
// round-trip tests, not by this scan. Its sealedAt timestamp is "today"
// every time it is sealed, which will routinely collide with any data
// value dated today, so it is excluded here rather than chasing date
// coincidences.
const EXCLUDED_BASENAMES = new Set(['life.enc.json']);

function isSafeValue(value) {
  return SAFE_VALUES.has(value.trim().toLowerCase());
}

/**
 * Optional local list of extra terms to block, one per line, in
 * data/guard-terms.txt (gitignored like data/*.json - the list itself would
 * leak what it guards). For values too short for the >= 5 character scan,
 * such as an employer's initials. Matched as whole words, case-sensitive.
 */
export function readExtraTerms(root) {
  const p = path.join(root, 'data', 'guard-terms.txt');
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

export function shortHash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}

export function collectSensitiveValues(node, out = new Set(), parentKey) {
  if (node === null || node === undefined) return out;
  if (typeof node === 'string') {
    if (parentKey && STRUCTURAL_SKIP_KEYS.has(parentKey)) return out;
    if (node.length >= 5 && !isSafeValue(node)) out.add(node);
    return out;
  }
  if (typeof node === 'number') {
    if (parentKey && STRUCTURAL_SKIP_KEYS.has(parentKey)) return out;
    const asText = String(node);
    const digitCount = (asText.match(/\d/g) ?? []).length;
    if (digitCount >= 4) out.add(asText);
    return out;
  }
  if (Array.isArray(node)) {
    if (parentKey && STRUCTURAL_SKIP_KEYS.has(parentKey)) return out;
    for (const item of node) collectSensitiveValues(item, out, undefined);
    return out;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) collectSensitiveValues(node[key], out, key);
  }
  return out;
}

function gitList(args, cwd) {
  try {
    const out = execFileSync('git', args, { cwd, encoding: 'utf8' });
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function walkDist(root) {
  const distDir = path.join(root, 'dist');
  const results = [];
  if (!fs.existsSync(distDir)) return results;
  const stack = [distDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        results.push(path.relative(root, full));
      }
    }
  }
  return results;
}

/**
 * Run the guard against `root` (defaults to the real project root) and
 * return { failed, messages, filesScanned, valuesChecked } instead of
 * touching process.exit, so tests can call this in-process.
 */
export function runGuard(root = defaultRoot) {
  const messages = [];
  let failed = false;
  const dataPath = path.join(root, 'data', 'life.json');

  const tracked = gitList(['ls-files'], root);
  const wouldAdd = gitList(['ls-files', '--others', '--exclude-standard'], root);
  const candidateFiles = tracked.length > 0 ? tracked : wouldAdd;
  const candidateSet = new Set(candidateFiles);

  const forbiddenHits = FORBIDDEN_PATHS.filter((p) => candidateSet.has(p));
  for (const hit of forbiddenHits) {
    failed = true;
    messages.push(`privacy-guard: FAIL - "${hit}" must never be tracked by git.`);
  }

  let sensitiveValues = [];
  if (fs.existsSync(dataPath)) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
      return {
        failed: true,
        messages: [`privacy-guard: FAIL - data/life.json is not valid JSON: ${err.message}`],
        filesScanned: 0,
        valuesChecked: 0,
      };
    }
    sensitiveValues = [...collectSensitiveValues(parsed)];
  }

  const distFiles = walkDist(root);
  const filesToScan = [...new Set([...candidateFiles, ...distFiles])].filter(
    (p) => !EXCLUDED_BASENAMES.has(path.basename(p)),
  );

  if (sensitiveValues.length > 0 && filesToScan.length > 0) {
    const lowerValues = sensitiveValues.map((v) => ({ original: v, lower: v.toLowerCase() }));
    for (const relPath of filesToScan) {
      const abs = path.join(root, relPath);
      let content;
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch {
        continue; // unreadable/binary/removed mid-scan - skip rather than crash
      }
      const lowerContent = content.toLowerCase();
      for (const { original, lower } of lowerValues) {
        if (lowerContent.includes(lower)) {
          failed = true;
          messages.push(`privacy-guard: FAIL - possible plaintext leak in ${relPath} (value sha256:${shortHash(original)})`);
        }
      }
    }
  }

  // Short terms from the local data/guard-terms.txt, as whole words, case-sensitive,
  // in the repo's own files (not dist: minified identifiers are arbitrary letters).
  const extraTerms = readExtraTerms(root);
  if (extraTerms.length > 0) {
    const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = extraTerms.map((t) => ({ term: t, re: new RegExp(`(?<![A-Za-z0-9])${escape(t)}(?![A-Za-z0-9])`) }));
    for (const relPath of candidateFiles.filter((p) => !EXCLUDED_BASENAMES.has(path.basename(p)))) {
      let content;
      try {
        content = fs.readFileSync(path.join(root, relPath), 'utf8');
      } catch {
        continue;
      }
      for (const { term, re } of patterns) {
        if (re.test(content)) {
          failed = true;
          messages.push(`privacy-guard: FAIL - local guard term found in ${relPath} (term sha256:${shortHash(term)})`);
        }
      }
    }
  }

  if (!failed) {
    messages.push(`privacy-guard: OK - ${filesToScan.length} file(s) scanned, ${sensitiveValues.length} sensitive value(s) and ${extraTerms.length} local term(s) checked, 0 hits.`);
  }

  return { failed, messages, filesScanned: filesToScan.length, valuesChecked: sensitiveValues.length };
}

function main() {
  const root = process.env.PRIVACY_GUARD_ROOT ? path.resolve(process.env.PRIVACY_GUARD_ROOT) : defaultRoot;
  const result = runGuard(root);
  for (const line of result.messages) {
    if (result.failed) console.error(line);
    else console.log(line);
  }
  process.exit(result.failed ? 1 : 0);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
