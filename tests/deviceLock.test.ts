import { describe, expect, it } from 'vitest';
import { WrongPassphraseError, base64ToBytes, bytesToBase64, deriveKey } from '../src/crypto';
import {
  MAX_LOCK_FAILURES,
  MIN_LOCK_LENGTH,
  LockStorageError,
  WrongLockCodeError,
  attemptUnlock,
  createLockRecord,
  openLock,
  recordFailure,
  triesLeft,
  unlockExtractable,
  type LockRecord,
} from '../src/lib/deviceLock';

// Pure crypto only - no IndexedDB anywhere in this file. A tiny iteration
// count keeps PBKDF2 fast; never a value anyone would seal real data with.
const TEST_ITERATIONS = 1000;
const TEST_CODE_A = 'test-code-1';
const TEST_CODE_B = 'test-code-2';

function randomRawKey(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

/** A blob-like sealed payload, encrypted with a key built from known raw bytes - mirrors SealedBlob's {iv, ct} shape. */
async function buildSealedPayload(raw: Uint8Array, value: unknown) {
  const key = await globalThis.crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ctBuf = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext);
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ctBuf)) };
}

async function decryptPayload(payload: { iv: string; ct: string }, key: CryptoKey): Promise<unknown> {
  const iv = base64ToBytes(payload.iv);
  const ct = base64ToBytes(payload.ct);
  const plainBuf = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

describe('deviceLock - round trip', () => {
  it('builds a lock record from known raw key bytes and opens it with the right code', async () => {
    const raw = randomRawKey();
    const payload = await buildSealedPayload(raw, { hello: 'world' });

    const record = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    const key = await openLock(record, TEST_CODE_A);

    const decrypted = await decryptPayload(payload, key);
    expect(decrypted).toEqual({ hello: 'world' });
  });
});

describe('deviceLock - wrong code and tampering', () => {
  it('throws WrongLockCodeError for the wrong code', async () => {
    const raw = randomRawKey();
    const record = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    await expect(openLock(record, TEST_CODE_B)).rejects.toThrow(WrongLockCodeError);
  });

  it('throws WrongLockCodeError when the wrapped bytes are tampered with', async () => {
    const raw = randomRawKey();
    const record = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    const wrappedBytes = base64ToBytes(record.wrapped);
    wrappedBytes[0] ^= 0xff;
    const tampered: LockRecord = { ...record, wrapped: bytesToBase64(wrappedBytes) };
    await expect(openLock(tampered, TEST_CODE_A)).rejects.toThrow(WrongLockCodeError);
  });
});

describe('deviceLock - key hygiene', () => {
  it('returns a non-extractable key from openLock', async () => {
    const raw = randomRawKey();
    const record = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    const key = await openLock(record, TEST_CODE_A);
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });
});

describe('deviceLock - unlockExtractable against a real sealed blob', () => {
  async function sealWithPassphrase(passphrase: string, iter: number, value: unknown) {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
      'deriveKey',
    ]);
    const key = await globalThis.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ctBuf = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext);
    return {
      v: 1,
      kdf: 'PBKDF2-SHA256' as const,
      iter,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ct: bytesToBase64(new Uint8Array(ctBuf)),
      sealedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  it('returns raw bytes and a working key when the passphrase is right', async () => {
    const passphrase = 'unlockExtractable-correct-test-only';
    const blob = await sealWithPassphrase(passphrase, TEST_ITERATIONS, { ok: true });

    const { raw, key, data } = await unlockExtractable(blob, passphrase);
    expect(data).toEqual({ ok: true });
    expect(raw.length).toBe(32);
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();

    // The returned key genuinely decrypts the blob.
    const roundTrip = await decryptPayload(blob, key);
    expect(roundTrip).toEqual({ ok: true });
  });

  it('throws WrongPassphraseError and returns nothing when the passphrase is wrong', async () => {
    const blob = await sealWithPassphrase('unlockExtractable-real-test-only', TEST_ITERATIONS, { ok: true });
    await expect(unlockExtractable(blob, 'unlockExtractable-wrong-test-only')).rejects.toThrow(WrongPassphraseError);
  });
});

describe('deviceLock - record shape', () => {
  it('gives two records from the same raw key and code different lockSalt, iv and wrapped', async () => {
    const raw = randomRawKey();
    const a = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    const b = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    expect(a.lockSalt).not.toBe(b.lockSalt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrapped).not.toBe(b.wrapped);
  });

  it('never lets the raw key\'s base64 show up inside wrapped', async () => {
    const raw = randomRawKey();
    const record = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    expect(record.wrapped).not.toContain(bytesToBase64(raw));
  });

  it('rejects a code shorter than MIN_LOCK_LENGTH', async () => {
    const raw = randomRawKey();
    const shortCode = 'a'.repeat(MIN_LOCK_LENGTH - 1);
    await expect(createLockRecord(raw, shortCode, TEST_ITERATIONS)).rejects.toThrow();
  });
});

describe('deviceLock - failure counting', () => {
  const base: LockRecord = {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: TEST_ITERATIONS,
    lockSalt: 'AAAA',
    iv: 'BBBB',
    wrapped: 'CCCC',
    failures: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('does not wipe going from 3 to 4 failures', () => {
    const record = { ...base, failures: 3 };
    const { record: updated, wipe } = recordFailure(record);
    expect(updated.failures).toBe(4);
    expect(wipe).toBe(false);
  });

  it('wipes going from 4 to 5 failures', () => {
    const record = { ...base, failures: 4 };
    const { record: updated, wipe } = recordFailure(record);
    expect(updated.failures).toBe(MAX_LOCK_FAILURES);
    expect(wipe).toBe(true);
  });

  it('counts down triesLeft as failures rise', () => {
    expect(triesLeft({ ...base, failures: 0 })).toBe(5);
    expect(triesLeft({ ...base, failures: 3 })).toBe(2);
    expect(triesLeft({ ...base, failures: 5 })).toBe(0);
  });

  it('does not mutate the record passed in', () => {
    const record = { ...base, failures: 2 };
    const snapshot = { ...record };
    recordFailure(record);
    expect(record).toEqual(snapshot);
  });
});

describe('attemptUnlock - every try is paid for before the code is checked', () => {
  async function recordAt(failures: number) {
    const raw = randomRawKey();
    const base = await createLockRecord(raw, TEST_CODE_A, TEST_ITERATIONS);
    return { raw, record: { ...base, failures } };
  }

  function spies() {
    const persisted: number[] = [];
    let wiped = 0;
    return {
      persisted,
      get wiped() {
        return wiped;
      },
      persist: async (r: LockRecord) => {
        persisted.push(r.failures);
      },
      wipe: async () => {
        wiped += 1;
      },
    };
  }

  it('charges the try before checking, even when the code turns out right', async () => {
    const { record } = await recordAt(2);
    const s = spies();
    const result = await attemptUnlock(record, TEST_CODE_A, s.persist, s.wipe);
    expect(result.ok).toBe(true);
    // First write is the charge (3), second is the refund (0). If the check ran first, the 3 would never appear.
    expect(s.persisted).toEqual([3, 0]);
  });

  it('leaves the charge in place on a wrong code, so an abandoned attempt still costs a try', async () => {
    const { record } = await recordAt(1);
    const s = spies();
    const result = await attemptUnlock(record, TEST_CODE_B, s.persist, s.wipe);
    expect(result).toMatchObject({ ok: false, wiped: false, record: { failures: 2 } });
    expect(s.persisted).toEqual([2]);
    expect(s.wiped).toBe(0);
  });

  it('still lets the fifth try succeed with the right code', async () => {
    const { record } = await recordAt(MAX_LOCK_FAILURES - 1);
    const s = spies();
    const result = await attemptUnlock(record, TEST_CODE_A, s.persist, s.wipe);
    expect(result.ok).toBe(true);
    expect(s.wiped).toBe(0);
  });

  it('wipes on the fifth wrong code', async () => {
    const { record } = await recordAt(MAX_LOCK_FAILURES - 1);
    const s = spies();
    const result = await attemptUnlock(record, TEST_CODE_B, s.persist, s.wipe);
    expect(result).toEqual({ ok: false, wiped: true });
    expect(s.wiped).toBe(1);
  });

  it('wipes without checking at all when the record is already spent', async () => {
    const { record } = await recordAt(MAX_LOCK_FAILURES);
    const s = spies();
    // Even the right code must not open a spent record.
    const result = await attemptUnlock(record, TEST_CODE_A, s.persist, s.wipe);
    expect(result).toEqual({ ok: false, wiped: true });
    expect(s.persisted).toEqual([]);
    expect(s.wiped).toBe(1);
  });

  it('refuses the try when the charge cannot be saved, instead of making it uncounted', async () => {
    const { record } = await recordAt(0);
    let checked = false;
    const attempt = attemptUnlock(
      record,
      TEST_CODE_A,
      async (r) => {
        if (r.failures === 1) throw new Error('storage full');
        checked = true; // a refund write would mean the code was checked
      },
      async () => undefined,
    );
    await expect(attempt).rejects.toBeInstanceOf(LockStorageError);
    expect(checked).toBe(false);
  });
});

describe('deviceLock - key length', () => {
  it('refuses to wrap anything but a 32-byte data key', async () => {
    await expect(createLockRecord(new Uint8Array(16), TEST_CODE_A, TEST_ITERATIONS)).rejects.toThrow('32-byte');
  });

  it('rejects a record that unwraps to the wrong length, even with the right code', async () => {
    // Built by hand to get past createLockRecord's own check: this is the
    // tampered or corrupted record the openLock length check exists for.
    const lockSalt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const lockKey = await deriveKey(TEST_CODE_A, lockSalt, TEST_ITERATIONS, false);
    const short = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const wrapped = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, lockKey, short as BufferSource);
    const record: LockRecord = {
      v: 1,
      kdf: 'PBKDF2-SHA256',
      iter: TEST_ITERATIONS,
      lockSalt: bytesToBase64(lockSalt),
      iv: bytesToBase64(iv),
      wrapped: bytesToBase64(new Uint8Array(wrapped)),
      failures: 0,
      createdAt: '2020-01-01T00:00:00.000Z',
    };
    await expect(openLock(record, TEST_CODE_A)).rejects.toBeInstanceOf(WrongLockCodeError);
  });
});
