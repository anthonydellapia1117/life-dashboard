/**
 * Minimal IndexedDB wrapper - two stores in one database:
 *
 *  - "keys" ("Remember on this device"): the derived (non-extractable) AES
 *    CryptoKey, keyed by the sealed blob's base64 salt so a data update that
 *    reuses the same salt keeps a remembered device working, and a
 *    --rotate'd salt correctly forces a fresh unlock. Only the CryptoKey
 *    object is stored - never raw key bytes, never the decrypted data, and
 *    never localStorage/sessionStorage.
 *  - "captures" (Today's capture card, src/lib/captures.ts): encrypted note
 *    records, keyed by their own id.
 */

const DB_NAME = 'life-dashboard';
export const KEYS_STORE = 'keys';
export const CAPTURES_STORE = 'captures';
export const EDITS_STORE = 'edits';
export const LOCKS_STORE = 'locks';
const DB_VERSION = 4;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE);
      } else if (event.oldVersion < 2) {
        // Upgrading from v1: any previously remembered key was derived with
        // decrypt-only usage, so it cannot encrypt a new capture. Clear it -
        // this just forces one fresh passphrase unlock, after which the
        // newly derived key (decrypt + encrypt, see src/crypto.ts) is
        // remembered again and captures work from then on.
        req.transaction?.objectStore(KEYS_STORE).clear();
      }
      if (!db.objectStoreNames.contains(CAPTURES_STORE)) {
        db.createObjectStore(CAPTURES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(EDITS_STORE)) {
        db.createObjectStore(EDITS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LOCKS_STORE)) {
        db.createObjectStore(LOCKS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeRememberedKey(salt: string, key: CryptoKey): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEYS_STORE, 'readwrite');
      tx.objectStore(KEYS_STORE).put(key, salt);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadRememberedKey(salt: string): Promise<CryptoKey | undefined> {
  const db = await openDb();
  try {
    return await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(KEYS_STORE, 'readonly');
      const req = tx.objectStore(KEYS_STORE).get(salt);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function clearRememberedKeys(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEYS_STORE, 'readwrite');
      tx.objectStore(KEYS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
