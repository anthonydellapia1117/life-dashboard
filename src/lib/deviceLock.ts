/**
 * Device lock: a short code that opens the app on a device that has already
 * been unlocked once with the full passphrase.
 *
 * The sealed public blob (public/data/life.enc.json) keeps its own strong
 * passphrase and its own KDF parameters - nothing here touches that, and the
 * short code is never used to seal anything public. This module only wraps a
 * copy of the already-derived data key with a second, device-local AES-GCM
 * key derived from the short code, and stores that wrapped copy in this
 * device's IndexedDB (see src/idb.ts, LOCKS_STORE).
 *
 * Threat model:
 *  - Someone with only the public repo (life.enc.json) learns nothing new
 *    from this feature - the short code never seals or protects anything
 *    that leaves this device.
 *  - Someone holding an already-unlocked phone is stopped by the lock
 *    screen; MAX_LOCK_FAILURES wrong codes in a row wipe the stored record,
 *    after which only the full passphrase works again.
 *  - Someone who has pulled this device's IndexedDB files off disk can
 *    brute-force a short code offline, at whatever rate their hardware
 *    allows. PBKDF2 at a real iteration count slows that down; it does not
 *    stop it. That is an accepted residual risk, not a solved one - a short
 *    code is inherently lower entropy than the full passphrase.
 */

import type { SealedBlob } from '../crypto';
import { base64ToBytes, bytesToBase64, decryptWithKey, deriveKey } from '../crypto';
import { LOCKS_STORE, openDb } from '../idb';

export const MAX_LOCK_FAILURES = 5;
export const MIN_LOCK_LENGTH = 4;

export class WrongLockCodeError extends Error {
  constructor() {
    super('That code did not match.');
    this.name = 'WrongLockCodeError';
  }
}

/**
 * Stored per device, keyed by the sealed blob's base64 salt. Every field
 * here is a salt, ciphertext or a counter - never a secret on its own; the
 * only thing that opens `wrapped` is the short code, which lives only in the
 * owner's memory.
 */
export interface LockRecord {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  /** base64, 16 random bytes, fresh per record. */
  lockSalt: string;
  /** base64, 12 random bytes, fresh per record. */
  iv: string;
  /** base64, AES-GCM(lockKey, raw 32-byte data key). */
  wrapped: string;
  /** Consecutive wrong codes since the last success. */
  failures: number;
  /** ISO 8601 - when this record was created (or last replaced). */
  createdAt: string;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto is not available in this environment.');
  }
  return subtle;
}

/**
 * Derive an extractable key from the full passphrase, prove it actually
 * opens this blob, then re-wrap the raw bytes as a non-extractable key
 * before returning anything. A wrong passphrase throws WrongPassphraseError
 * from decryptWithKey before a single byte is exported - the extractable
 * key derived at the top never leaves this function.
 *
 * Callers own the returned `raw` bytes and must raw.fill(0) once they are
 * done with them (after building a LockRecord, or on any abandoned flow).
 */
export async function unlockExtractable(
  blob: SealedBlob,
  passphrase: string,
): Promise<{ raw: Uint8Array; key: CryptoKey; data: unknown }> {
  const subtle = getSubtle();
  const salt = base64ToBytes(blob.salt);
  const extractableKey = await deriveKey(passphrase, salt, blob.iter, true);
  // Proves the passphrase is right before anything is exported. Throws
  // WrongPassphraseError on a mismatch; extractableKey is simply dropped.
  const data = await decryptWithKey(blob, extractableKey);
  const rawBuf = await subtle.exportKey('raw', extractableKey);
  const raw = new Uint8Array(rawBuf);
  const key = await subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, [
    'decrypt',
    'encrypt',
  ]);
  return { raw, key, data };
}

/**
 * Build a fresh lock record wrapping `raw` (the data key's raw bytes) behind
 * `code`. Callers must raw.fill(0) once the record is built - this function
 * only reads raw, it never takes ownership of clearing it.
 */
export async function createLockRecord(
  raw: Uint8Array,
  code: string,
  iter = 600_000,
  now = new Date(),
): Promise<LockRecord> {
  if (code.length < MIN_LOCK_LENGTH) {
    throw new Error(`A device lock code must be at least ${MIN_LOCK_LENGTH} characters.`);
  }
  // AES-GCM raw import takes its key size from the byte length, so 16 bytes
  // would quietly become an AES-128 key instead of failing. Refuse it here.
  if (raw.length !== 32) {
    throw new Error('A device lock can only wrap a 32-byte data key.');
  }
  const subtle = getSubtle();
  const lockSaltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const lockKey = await deriveKey(code, lockSaltBytes, iter, false);
  const wrappedBuf = await subtle.encrypt({ name: 'AES-GCM', iv: ivBytes as BufferSource }, lockKey, raw as BufferSource);
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter,
    lockSalt: bytesToBase64(lockSaltBytes),
    iv: bytesToBase64(ivBytes),
    wrapped: bytesToBase64(new Uint8Array(wrappedBuf)),
    failures: 0,
    createdAt: now.toISOString(),
  };
}

/**
 * Unwrap `record` with `code`, returning a non-extractable AES-GCM key ready
 * to decrypt the sealed blob. Any failure - wrong code, tampered ciphertext,
 * a decrypted length that isn't a 32-byte key - throws WrongLockCodeError.
 */
export async function openLock(record: LockRecord, code: string): Promise<CryptoKey> {
  const subtle = getSubtle();
  try {
    const lockSaltBytes = base64ToBytes(record.lockSalt);
    const lockKey = await deriveKey(code, lockSaltBytes, record.iter, false);
    const ivBytes = base64ToBytes(record.iv);
    const wrappedBytes = base64ToBytes(record.wrapped);
    const rawBuf = await subtle.decrypt({ name: 'AES-GCM', iv: ivBytes as BufferSource }, lockKey, wrappedBytes as BufferSource);
    const raw = new Uint8Array(rawBuf);
    if (raw.length !== 32) {
      raw.fill(0);
      throw new WrongLockCodeError();
    }
    const key = await subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, [
      'decrypt',
      'encrypt',
    ]);
    raw.fill(0);
    return key;
  } catch {
    // AES-GCM auth tag mismatch (wrong code, or tampered wrapped bytes) and
    // the wrong-length check above both land here as one error - never leak
    // which one it was.
    throw new WrongLockCodeError();
  }
}

/** Pure - failures + 1; wipe is true once the new count reaches MAX_LOCK_FAILURES. Does not mutate `record`. */
export function recordFailure(record: LockRecord): { record: LockRecord; wipe: boolean } {
  const failures = record.failures + 1;
  return { record: { ...record, failures }, wipe: failures >= MAX_LOCK_FAILURES };
}

export function triesLeft(record: LockRecord): number {
  return Math.max(0, MAX_LOCK_FAILURES - record.failures);
}

/** The try could not be recorded on this device, so it was not made. */
export class LockStorageError extends Error {
  constructor() {
    super('Could not read or record this try on this device.');
    this.name = 'LockStorageError';
  }
}

export type AttemptResult =
  | { ok: true; key: CryptoKey; record: LockRecord }
  | { ok: false; wiped: true }
  | { ok: false; wiped: false; record: LockRecord };

/**
 * One try at the lock, with the try paid for BEFORE the code is checked.
 *
 * Counting a failure only after the check leaves a gap: the check takes most
 * of a second of PBKDF2, and anyone who reloads the page inside that window
 * learns the code was wrong (the app did not open) without the counter ever
 * moving. Charging first closes it - an abandoned attempt still costs a try,
 * and a right code refunds it by resetting the count to zero.
 *
 * `persist` and `wipe` are passed in so this ordering is testable without
 * IndexedDB. If the charge cannot be saved, the try is refused with
 * LockStorageError rather than made uncounted: a counter that only works
 * when storage is healthy is not a counter. This costs the owner nothing,
 * because the full passphrase is always one tap away on the lock screen and
 * never touches this record. The refund after a right code stays best
 * effort - a lost refund only leaves the count one high, never lower.
 */
export async function attemptUnlock(
  record: LockRecord,
  code: string,
  persist: (record: LockRecord) => Promise<void>,
  wipe: () => Promise<void>,
): Promise<AttemptResult> {
  if (record.failures >= MAX_LOCK_FAILURES) {
    await wipe().catch(() => undefined);
    return { ok: false, wiped: true };
  }
  const { record: charged, wipe: lastTry } = recordFailure(record);
  try {
    await persist(charged);
  } catch {
    throw new LockStorageError();
  }
  try {
    const key = await openLock(record, code);
    const cleared: LockRecord = { ...record, failures: 0 };
    await persist(cleared).catch(() => undefined);
    return { ok: true, key, record: cleared };
  } catch (err) {
    if (!(err instanceof WrongLockCodeError)) throw err;
    if (lastTry) {
      await wipe().catch(() => undefined);
      return { ok: false, wiped: true };
    }
    return { ok: false, wiped: false, record: charged };
  }
}

/* ------------------------------ IndexedDB I/O ------------------------------ */
/* Mirrors the open/transaction/close-in-finally style of src/lib/captures.ts. */

export async function loadLock(salt: string): Promise<LockRecord | undefined> {
  const db = await openDb();
  try {
    return await new Promise<LockRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(LOCKS_STORE, 'readonly');
      const req = tx.objectStore(LOCKS_STORE).get(salt);
      req.onsuccess = () => resolve(req.result as LockRecord | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveLock(salt: string, record: LockRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCKS_STORE, 'readwrite');
      tx.objectStore(LOCKS_STORE).put(record, salt);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearLock(salt: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCKS_STORE, 'readwrite');
      tx.objectStore(LOCKS_STORE).delete(salt);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
