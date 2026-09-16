import { describe, expect, it } from 'vitest';
import { deriveKey } from '../src/crypto';
import {
  buildCaptureRecord,
  buildMailtoUrl,
  decryptCaptureText,
  hydrateCaptures,
  isLocked,
  sortNewestFirst,
  type CaptureView,
  type StoredCapture,
} from '../src/lib/captures';

const THROWAWAY_PASSPHRASE = 'correct-horse-battery-staple-test-only';
const TEST_ITERATIONS = 10_000; // small for test speed
const SALT_A = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const SALT_B = new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);

function saltB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

const SALT_A_B64 = saltB64(SALT_A);
const SALT_B_B64 = saltB64(SALT_B);

describe('captures - encrypt/decrypt round trip', () => {
  it('encrypts a note with the unlocked key and decrypts it back to the same text', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildCaptureRecord(key, SALT_A_B64, 'Call the vet about the appointment.');

    expect(record.salt).toBe(SALT_A_B64);
    expect(typeof record.id).toBe('string');
    expect(record.id.length).toBeGreaterThan(0);

    const text = await decryptCaptureText(record, key);
    expect(text).toBe('Call the vet about the appointment.');
  });

  it('rejects a tampered ciphertext instead of returning garbage', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildCaptureRecord(key, SALT_A_B64, 'Original note.');
    const tampered: StoredCapture = { ...record, ct: record.ct.slice(0, -4) + (record.ct.slice(-4) === 'abcd' ? 'efgh' : 'abcd') };
    await expect(decryptCaptureText(tampered, key)).rejects.toThrow();
  });
});

describe('captures - newest-first ordering', () => {
  it('sorts by "at" descending regardless of input order', () => {
    const records: StoredCapture[] = [
      { id: 'a', at: '2020-01-01T09:00:00.000Z', salt: SALT_A_B64, iv: 'x', ct: 'y' },
      { id: 'b', at: '2020-01-04T09:00:00.000Z', salt: SALT_A_B64, iv: 'x', ct: 'y' },
      { id: 'c', at: '2020-01-02T09:00:00.000Z', salt: SALT_A_B64, iv: 'x', ct: 'y' },
    ];
    expect(sortNewestFirst(records).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('hydrates a mixed batch newest first, decrypting each with the current key', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const older = await buildCaptureRecord(key, SALT_A_B64, 'Older note.', new Date('2020-01-01T09:00:00.000Z'));
    const newer = await buildCaptureRecord(key, SALT_A_B64, 'Newer note.', new Date('2020-01-04T09:00:00.000Z'));

    const views = await hydrateCaptures([older, newer], SALT_A_B64, key);
    expect(views.map((v) => v.text)).toEqual(['Newer note.', 'Older note.']);
  });
});

describe('captures - stale salt reads as locked', () => {
  it('flags a record written under a different blob salt as locked, without attempting to decrypt it', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const staleRecord = await buildCaptureRecord(key, SALT_B_B64, 'Written under an old blob salt.');

    expect(isLocked(staleRecord, SALT_A_B64)).toBe(true);

    const [view] = await hydrateCaptures([staleRecord], SALT_A_B64, key);
    expect(view).toEqual({ id: staleRecord.id, at: staleRecord.at, locked: true });
  });

  it('hydrates a current-salt record with its decrypted text instead', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildCaptureRecord(key, SALT_A_B64, 'Still current.');

    expect(isLocked(record, SALT_A_B64)).toBe(false);
    const [view] = await hydrateCaptures([record], SALT_A_B64, key);
    expect(view).toEqual({ id: record.id, at: record.at, locked: false, text: 'Still current.' });
  });

  it('locks every record when there is no unlocked key at all', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildCaptureRecord(key, SALT_A_B64, 'Needs a key to read.');
    const [view] = await hydrateCaptures([record], SALT_A_B64, undefined);
    expect(view).toEqual({ id: record.id, at: record.at, locked: true });
  });
});

describe('captures - mailto body builder', () => {
  const views: CaptureView[] = [
    { id: 'a', at: '2020-01-04T09:00:00.000Z', locked: false, text: 'First note.' },
    { id: 'b', at: '2020-01-03T09:00:00.000Z', locked: false, text: 'Second note.' },
  ];

  it('builds a mailto URL from a passed-in address, never a hardcoded one', () => {
    const url = buildMailtoUrl('someone@example.com', views);
    expect(url.startsWith('mailto:someone@example.com?')).toBe(true);
    expect(url).toContain(`subject=${encodeURIComponent('Life Dashboard capture')}`);
    expect(url).toContain(`body=${encodeURIComponent('First note.\n\nSecond note.')}`);
  });

  it('uses whatever address it is given, not a fixed one', () => {
    const url = buildMailtoUrl('someone-else@example.org', views);
    expect(url.startsWith('mailto:someone-else@example.org?')).toBe(true);
  });

  it('omits locked notes (no plaintext available) from the body', () => {
    const mixed: CaptureView[] = [
      { id: 'a', at: '2020-01-04T09:00:00.000Z', locked: false, text: 'Only this one.' },
      { id: 'b', at: '2020-01-03T09:00:00.000Z', locked: true },
    ];
    const url = buildMailtoUrl('someone@example.com', mixed);
    expect(url).toContain(encodeURIComponent('Only this one.'));
    expect(decodeURIComponent(url)).not.toMatch(/undefined/);
  });
});
