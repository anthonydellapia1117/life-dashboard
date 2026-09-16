/**
 * Browser-side decrypt for the sealed data blob produced by scripts/seal.mjs.
 *
 * Format (public/data/life.enc.json):
 *   { v: 1, kdf: "PBKDF2-SHA256", iter: number, salt: b64, iv: b64, ct: b64, sealedAt: ISO }
 *
 * Key derivation: PBKDF2-SHA256(passphrase, salt, iter) -> AES-256-GCM key.
 * This module only ever holds the passphrase in memory long enough to derive
 * a key; nothing here writes to localStorage or sessionStorage.
 */

export interface SealedBlob {
  v: number;
  kdf: string;
  iter: number;
  salt: string;
  iv: string;
  ct: string;
  sealedAt: string;
}

/** The iv/ct pair encryptWithKey produces - the same shape decryptWithKey reads out of a full SealedBlob. */
export type EncryptedPayload = Pick<SealedBlob, 'iv' | 'ct'>;

export class WrongPassphraseError extends Error {
  constructor() {
    super('That passphrase did not unlock the data.');
    this.name = 'WrongPassphraseError';
  }
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto is not available in this environment.');
  }
  return subtle;
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Derive the AES-256-GCM key for a sealed blob. The key is non-extractable
 * by default so a "remembered" key stored in IndexedDB can be used to
 * encrypt/decrypt but never read back out as raw bytes. Both usages are
 * derived onto the one key so the same unlocked key that decrypts the data
 * blob can also encrypt/decrypt Today's captures (src/lib/captures.ts).
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  extractable = false,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['decrypt', 'encrypt'],
  );
}

/**
 * Decrypt a sealed blob - or any {iv, ct} payload from encryptWithKey, such
 * as one capture note - with an already-derived key. Throws
 * WrongPassphraseError on failure.
 */
export async function decryptWithKey(blob: EncryptedPayload, key: CryptoKey): Promise<unknown> {
  const subtle = getSubtle();
  const iv = base64ToBytes(blob.iv);
  const ct = base64ToBytes(blob.ct);
  try {
    const plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
    const text = new TextDecoder().decode(plainBuf);
    return JSON.parse(text);
  } catch {
    // AES-GCM auth tag mismatch (wrong key) and JSON parse failures both land
    // here. Never surface the underlying stack trace to the UI.
    throw new WrongPassphraseError();
  }
}

/**
 * Encrypt an arbitrary JSON-serializable value with an already-derived key -
 * mirrors decryptWithKey's approach (base64 through the same helpers, same
 * AES-256-GCM primitive), with a fresh random 12-byte IV every call.
 */
export async function encryptWithKey(key: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  const subtle = getSubtle();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ctBuf = await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext);
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ctBuf)) };
}

/** Derive a key from a passphrase and use it to decrypt the blob in one step. */
export async function unlockWithPassphrase(
  blob: SealedBlob,
  passphrase: string,
  extractable = false,
): Promise<{ key: CryptoKey; data: unknown }> {
  const salt = base64ToBytes(blob.salt);
  const key = await deriveKey(passphrase, salt, blob.iter, extractable);
  const data = await decryptWithKey(blob, key);
  return { key, data };
}
