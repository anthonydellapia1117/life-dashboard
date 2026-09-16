/**
 * Today's Capture card: quick Wispr-dictated notes, encrypted at rest with
 * the same AES key the rest of the dashboard unlocks with, stored in the
 * "captures" IndexedDB store (src/idb.ts).
 *
 * Every record on disk (StoredCapture) keeps its note text as ciphertext -
 * plaintext only ever exists in memory, inside a CaptureView, for as long as
 * the app is unlocked. A record written under an older blob salt (the data
 * was re-sealed with --rotate since) cannot be decrypted with the current
 * key and hydrates as locked: true instead of throwing.
 */

import { decryptWithKey, encryptWithKey, WrongPassphraseError } from '../crypto';
import { CAPTURES_STORE, openDb } from '../idb';

export interface StoredCapture {
  id: string;
  /** ISO 8601 timestamp with offset - when the note was saved. */
  at: string;
  /** The sealed data blob's base64 salt this note was encrypted under. */
  salt: string;
  iv: string;
  ct: string;
}

export interface CaptureView {
  id: string;
  at: string;
  /** True if this record's salt doesn't match the current blob (or decryption otherwise failed) - text is withheld. */
  locked: boolean;
  text?: string;
}

/** Newest first, by "at" (safe as a plain string compare - always an ISO UTC timestamp from Date#toISOString). */
export function sortNewestFirst<T extends { at: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** A record written under a different blob salt than the one currently unlocked - locked, regardless of key availability. */
export function isLocked(record: Pick<StoredCapture, 'salt'>, currentSalt: string): boolean {
  return record.salt !== currentSalt;
}

/** Encrypt a note's text with the unlocked key and build the full record ready to store. */
export async function buildCaptureRecord(
  key: CryptoKey,
  currentSalt: string,
  text: string,
  now: Date = new Date(),
): Promise<StoredCapture> {
  const { iv, ct } = await encryptWithKey(key, text);
  return { id: globalThis.crypto.randomUUID(), at: now.toISOString(), salt: currentSalt, iv, ct };
}

/** Decrypt one record's note text. Throws WrongPassphraseError if the key doesn't match (wrong key, or corrupted record). */
export async function decryptCaptureText(record: Pick<StoredCapture, 'iv' | 'ct'>, key: CryptoKey): Promise<string> {
  const value = await decryptWithKey({ iv: record.iv, ct: record.ct }, key);
  if (typeof value !== 'string') throw new WrongPassphraseError();
  return value;
}

/** One record -> its view: locked (no key, stale salt, or a decrypt failure) or hydrated with its plaintext. */
async function hydrateCapture(record: StoredCapture, currentSalt: string, key: CryptoKey | undefined): Promise<CaptureView> {
  if (!key || isLocked(record, currentSalt)) {
    return { id: record.id, at: record.at, locked: true };
  }
  try {
    const text = await decryptCaptureText(record, key);
    return { id: record.id, at: record.at, locked: false, text };
  } catch {
    return { id: record.id, at: record.at, locked: true };
  }
}

/** Newest-first, hydrated view of a set of records - what the Capture card renders. */
export async function hydrateCaptures(
  records: StoredCapture[],
  currentSalt: string,
  key: CryptoKey | undefined,
): Promise<CaptureView[]> {
  const sorted = sortNewestFirst(records);
  return Promise.all(sorted.map((record) => hydrateCapture(record, currentSalt, key)));
}

/** Every unlocked note's text, newest first, joined for "Copy all" and the mailto body below. */
export function buildPlainTextExport(views: CaptureView[]): string {
  return views
    .filter((v): v is CaptureView & { text: string } => !v.locked && typeof v.text === 'string')
    .map((v) => v.text)
    .join('\n\n');
}

/** mailto: URL for "Send to inbox" - the address is always passed in (data.meta.captureEmail), never hardcoded here. */
export function buildMailtoUrl(email: string, views: CaptureView[]): string {
  const subject = 'Life Dashboard capture';
  const body = buildPlainTextExport(views);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ------------------------------ IndexedDB I/O ------------------------------ */

export async function listCaptures(): Promise<StoredCapture[]> {
  const db = await openDb();
  try {
    return await new Promise<StoredCapture[]>((resolve, reject) => {
      const tx = db.transaction(CAPTURES_STORE, 'readonly');
      const req = tx.objectStore(CAPTURES_STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredCapture[] | undefined) ?? []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveCapture(record: StoredCapture): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CAPTURES_STORE, 'readwrite');
      tx.objectStore(CAPTURES_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteCapture(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CAPTURES_STORE, 'readwrite');
      tx.objectStore(CAPTURES_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
