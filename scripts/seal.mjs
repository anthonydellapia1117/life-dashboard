#!/usr/bin/env node
/**
 * Encrypt data/life.json into public/data/life.enc.json.
 *
 * Zero dependencies - Node 20+ only, using globalThis.crypto.subtle.
 *
 * Format written:
 *   { v: 1, kdf: "PBKDF2-SHA256", iter, salt: b64, iv: b64, ct: b64, sealedAt: ISO }
 *
 * Key = PBKDF2-SHA256(passphrase, 16-byte random salt, 600000 iterations).
 * A fresh random 12-byte IV is generated on every seal.
 *
 * When public/data/life.enc.json already exists, its salt and iteration
 * count are reused (so a device that has "remembered" its derived key keeps
 * working after a data update) unless --rotate is passed on the command
 * line, in which case a brand-new random salt is generated.
 *
 * Passphrase source, in this order:
 *   1. env LIFE_DASHBOARD_PASSPHRASE
 *   2. macOS keychain: security find-generic-password -s life-dashboard -a life-dashboard -w
 *   3. Hidden interactive TTY prompt
 *   4. Otherwise, exit 1
 *
 * The passphrase itself is never printed or logged.
 *
 * sealPayload() and deriveKey() are also exported so tests can exercise the
 * exact same sealing code path without shelling out to this CLI.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ITERATIONS = 600000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEYCHAIN_SERVICE = 'life-dashboard';
const KEYCHAIN_ACCOUNT = 'life-dashboard';

// Control characters used by the hidden-passphrase prompt below, spelled out
// via String.fromCharCode rather than \u escapes for readability.
const KEY_CTRL_D = String.fromCharCode(4);
const KEY_CTRL_C = String.fromCharCode(3);
const KEY_DEL = String.fromCharCode(127);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const dataPath = path.join(repoRoot, 'data', 'life.json');
const outPath = path.join(repoRoot, 'public', 'data', 'life.enc.json');

const subtle = globalThis.crypto?.subtle;
if (!subtle) {
  console.error('This script requires a Node runtime with globalThis.crypto.subtle (Node 20+).');
  process.exit(1);
}

export function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

export function fromBase64(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function tryReadExistingSeal() {
  try {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    if (typeof existing.salt === 'string' && Number.isFinite(existing.iter) && existing.iter > 0) {
      return { salt: fromBase64(existing.salt), iter: existing.iter };
    }
  } catch {
    // No existing sealed file, or it is unreadable/malformed - fall through
    // and seal fresh below.
  }
  return undefined;
}

function tryKeychain() {
  if (process.platform !== 'darwin') return undefined;
  try {
    const out = execFileSync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const trimmed = out.replace(/\r?\n+$/, '');
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      resolve(undefined);
      return;
    }
    process.stdout.write(question);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);

    let input = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };
    const onData = (chunk) => {
      const char = chunk.toString('utf8');
      if (char === '\n' || char === '\r' || char === KEY_CTRL_D) {
        cleanup();
        process.stdout.write('\n');
        resolve(input.length > 0 ? input : undefined);
        return;
      }
      if (char === KEY_CTRL_C) {
        cleanup();
        process.stdout.write('\n');
        process.exit(1);
        return;
      }
      if (char === KEY_DEL || char === '\b') {
        input = input.slice(0, -1);
        return;
      }
      input += char;
    };
    stdin.on('data', onData);
  });
}

async function getPassphrase() {
  if (process.env.LIFE_DASHBOARD_PASSPHRASE) {
    return process.env.LIFE_DASHBOARD_PASSPHRASE;
  }
  const fromKeychain = tryKeychain();
  if (fromKeychain) return fromKeychain;

  const fromPrompt = await promptHidden('Passphrase for life-dashboard data (input hidden): ');
  if (fromPrompt) return fromPrompt;

  console.error(
    'No passphrase available. Set LIFE_DASHBOARD_PASSPHRASE, add a macOS keychain entry ' +
      `(service "${KEYCHAIN_SERVICE}", account "${KEYCHAIN_ACCOUNT}"), or run this in an interactive terminal.`,
  );
  process.exit(1);
}

export async function deriveKey(passphrase, salt, iterations, keyUsages = ['encrypt']) {
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsages,
  );
}

/**
 * Pure sealing step: given a plaintext-able object, a passphrase, a salt,
 * and an iteration count, produce the exact sealed-blob shape written to
 * public/data/life.enc.json. No filesystem or passphrase-sourcing side
 * effects - this is what both main() below and the test suite call.
 */
export async function sealPayload({ plaintextObj, passphrase, salt, iter = DEFAULT_ITERATIONS }) {
  const key = await deriveKey(passphrase, salt, iter, ['encrypt']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(plaintextObj));
  const ctBuf = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ctBuf)),
    sealedAt: new Date().toISOString(),
  };
}

export function randomSalt(bytes = SALT_BYTES) {
  return globalThis.crypto.getRandomValues(new Uint8Array(bytes));
}

async function main() {
  const rotate = process.argv.includes('--rotate');

  let rawJson;
  try {
    rawJson = fs.readFileSync(dataPath, 'utf8');
  } catch (err) {
    console.error(`Could not read ${path.relative(repoRoot, dataPath)}: ${err.message}`);
    process.exit(1);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error(`${path.relative(repoRoot, dataPath)} is not valid JSON: ${err.message}`);
    process.exit(1);
    return;
  }

  const reused = rotate ? undefined : tryReadExistingSeal();
  const salt = reused ? reused.salt : randomSalt();
  const iter = reused ? reused.iter : DEFAULT_ITERATIONS;

  const passphrase = await getPassphrase();
  const sealed = await sealPayload({ plaintextObj: parsed, passphrase, salt, iter });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(sealed, null, 2)}\n`, 'utf8');

  console.log(
    `Sealed ${path.relative(repoRoot, dataPath)} -> ${path.relative(repoRoot, outPath)} ` +
      `(${reused ? 'reused' : 'new'} salt, iter=${iter}).`,
  );
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(`seal failed: ${err.message}`);
    process.exit(1);
  });
}
