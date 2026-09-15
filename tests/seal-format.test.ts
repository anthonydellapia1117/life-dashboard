import { describe, expect, it } from 'vitest';
import { DEFAULT_ITERATIONS, deriveKey, randomSalt, sealPayload } from '../scripts/seal.mjs';
import { WrongPassphraseError, decryptWithKey, unlockWithPassphrase } from '../src/crypto';
import type { SealedBlob } from '../src/crypto';

const THROWAWAY_PASSPHRASE = 'correct-horse-battery-staple-test-only';
const TEST_ITERATIONS = 10_000; // small for test speed; the sealed format is identical at any iteration count
const TINY_OBJECT = { hello: 'world', count: 3, nested: { ok: true } };

describe('seal-format round trip', () => {
  it('encrypts in Node exactly as seal.mjs does, and decrypts with src/crypto.ts', async () => {
    const salt = randomSalt();
    const sealed = await sealPayload({
      plaintextObj: TINY_OBJECT,
      passphrase: THROWAWAY_PASSPHRASE,
      salt,
      iter: TEST_ITERATIONS,
    });

    expect(sealed.v).toBe(1);
    expect(sealed.kdf).toBe('PBKDF2-SHA256');
    expect(sealed.iter).toBe(TEST_ITERATIONS);
    expect(typeof sealed.salt).toBe('string');
    expect(typeof sealed.iv).toBe('string');
    expect(typeof sealed.ct).toBe('string');
    expect(typeof sealed.sealedAt).toBe('string');

    const { data } = await unlockWithPassphrase(sealed as SealedBlob, THROWAWAY_PASSPHRASE);
    expect(data).toEqual(TINY_OBJECT);
  });

  it('rejects a wrong passphrase with a plain error, not a raw crypto exception', async () => {
    const salt = randomSalt();
    const sealed = await sealPayload({
      plaintextObj: TINY_OBJECT,
      passphrase: THROWAWAY_PASSPHRASE,
      salt,
      iter: TEST_ITERATIONS,
    });

    await expect(unlockWithPassphrase(sealed as SealedBlob, 'definitely-the-wrong-passphrase')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('keeps a stored (remembered) key valid after a reseal that reuses the same salt', async () => {
    const salt = randomSalt();

    const firstObject = { hello: 'world', count: 3 };
    const secondObject = { hello: 'world', count: 4 };

    const sealedOnce = await sealPayload({
      plaintextObj: firstObject,
      passphrase: THROWAWAY_PASSPHRASE,
      salt,
      iter: TEST_ITERATIONS,
    });
    const sealedAgain = await sealPayload({
      plaintextObj: secondObject,
      passphrase: THROWAWAY_PASSPHRASE,
      salt,
      iter: TEST_ITERATIONS,
    });

    // Simulate "Remember on this device": derive the key once from the
    // original blob's salt, exactly like the browser does on first unlock.
    const rememberedKey = await deriveKey(THROWAWAY_PASSPHRASE, salt, TEST_ITERATIONS, ['decrypt']);

    // The same stored key must still open a later seal that reused the salt.
    const first = await decryptWithKey(sealedOnce as SealedBlob, rememberedKey);
    const second = await decryptWithKey(sealedAgain as SealedBlob, rememberedKey);

    expect(first).toEqual(firstObject);
    expect(second).toEqual(secondObject);
  });

  it('defaults to 600000 PBKDF2 iterations when no existing seal is reused', () => {
    expect(DEFAULT_ITERATIONS).toBe(600000);
  });
});
