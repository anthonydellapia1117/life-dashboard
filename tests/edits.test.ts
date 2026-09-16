import { describe, expect, it } from 'vitest';
import { deriveKey, encryptWithKey } from '../src/crypto';
import {
  applyDoneTransition,
  buildEditRecord,
  decryptEditFields,
  editsMap,
  exportEditsJson,
  hydrateEdits,
  mergeFields,
  parseEditsJson,
  type EditView,
  type StoredEdit,
} from '../src/lib/edits';

const THROWAWAY_PASSPHRASE = 'correct-horse-battery-staple-test-only';
const TEST_ITERATIONS = 10_000; // small for test speed
const SALT_A = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const SALT_B = new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);

function saltB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

const SALT_A_B64 = saltB64(SALT_A);
const SALT_B_B64 = saltB64(SALT_B);

describe('edits - mergeFields', () => {
  it('keeps the base value when incoming explicitly sets a key to undefined', () => {
    const base = { title: 'Item one', due: '2020-01-05' };
    const merged = mergeFields(base, { title: undefined, detail: 'New detail' });
    expect(merged).toEqual({ title: 'Item one', due: '2020-01-05', detail: 'New detail' });
  });

  it('treats a null value as an explicit clear, not "keep base"', () => {
    const base = { due: '2020-01-05', horizon: 'now' };
    const merged = mergeFields(base, { due: null, horizon: null });
    expect(merged).toEqual({ due: null, horizon: null });
  });

  it('merges onto an undefined base', () => {
    const merged = mergeFields(undefined, { title: 'Item one' });
    expect(merged).toEqual({ title: 'Item one' });
  });
});

describe('edits - applyDoneTransition', () => {
  it('flips to done and stamps doneAt with now', () => {
    const now = new Date('2020-01-05T10:00:00.000Z');
    expect(applyDoneTransition(undefined, true, now)).toEqual({ done: true, doneAt: '2020-01-05T10:00:00.000Z' });
  });

  it('flips back to not-done and clears doneAt', () => {
    const now = new Date('2020-01-05T10:00:00.000Z');
    const done = applyDoneTransition(undefined, true, now);
    expect(applyDoneTransition(done, false, now)).toEqual({ done: false, doneAt: null });
  });

  it('is idempotent: re-applying done=true later keeps the original doneAt', () => {
    const first = applyDoneTransition(undefined, true, new Date('2020-01-05T10:00:00.000Z'));
    const second = applyDoneTransition(first, true, new Date('2020-02-01T10:00:00.000Z'));
    expect(second).toEqual(first);
  });

  it('is idempotent for not-done too: re-applying done=false stays cleared', () => {
    const first = applyDoneTransition(undefined, false, new Date('2020-01-05T10:00:00.000Z'));
    const second = applyDoneTransition(first, false, new Date('2020-02-01T10:00:00.000Z'));
    expect(second).toEqual({ done: false, doneAt: null });
    expect(second).toEqual(first);
  });
});

describe('edits - editsMap', () => {
  it('includes only unlocked views, keyed by id', () => {
    const views: EditView[] = [
      { id: 'actions:a-1', at: '2020-01-01T00:00:00.000Z', locked: false, fields: { title: 'Item one' } },
      { id: 'actions:a-2', at: '2020-01-02T00:00:00.000Z', locked: true },
    ];
    const map = editsMap(views);
    expect(map.size).toBe(1);
    expect(map.get('actions:a-1')).toEqual({ title: 'Item one' });
    expect(map.has('actions:a-2')).toBe(false);
  });
});

describe('edits - encrypt/decrypt round trip', () => {
  it('encrypts fields with the unlocked key and decrypts them back to the same object', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildEditRecord(key, SALT_A_B64, 'actions:a-1', { title: 'Item one', done: true });

    expect(record.id).toBe('actions:a-1');
    expect(record.salt).toBe(SALT_A_B64);

    const fields = await decryptEditFields(record, key);
    expect(fields).toEqual({ title: 'Item one', done: true });
  });
});

describe('edits - stale salt hydrates locked', () => {
  it('flags a record written under a different blob salt as locked, without attempting to decrypt it', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const staleRecord = await buildEditRecord(key, SALT_B_B64, 'actions:a-1', { title: 'Written under an old blob salt' });

    const [view] = await hydrateEdits([staleRecord], SALT_A_B64, key);
    expect(view).toEqual({ id: staleRecord.id, at: staleRecord.at, locked: true });
  });

  it('hydrates a current-salt record with its decrypted fields instead', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildEditRecord(key, SALT_A_B64, 'actions:a-1', { title: 'Still current' });

    const [view] = await hydrateEdits([record], SALT_A_B64, key);
    expect(view).toEqual({ id: record.id, at: record.at, locked: false, fields: { title: 'Still current' } });
  });

  it('locks every record when there is no unlocked key at all', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildEditRecord(key, SALT_A_B64, 'actions:a-1', { title: 'Needs a key to read' });
    const [view] = await hydrateEdits([record], SALT_A_B64, undefined);
    expect(view).toEqual({ id: record.id, at: record.at, locked: true });
  });
});

describe('edits - decrypt failure hydrates locked', () => {
  it('hydrates as locked instead of throwing when the ciphertext is tampered', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const record = await buildEditRecord(key, SALT_A_B64, 'actions:a-1', { title: 'Item one' });
    const tampered: StoredEdit = { ...record, ct: record.ct.slice(0, -4) + (record.ct.slice(-4) === 'abcd' ? 'efgh' : 'abcd') };

    await expect(decryptEditFields(tampered, key)).rejects.toThrow();

    const [view] = await hydrateEdits([tampered], SALT_A_B64, key);
    expect(view).toEqual({ id: tampered.id, at: tampered.at, locked: true });
  });

  it('hydrates as locked when the decrypted payload is not a fields object', async () => {
    const key = await deriveKey(THROWAWAY_PASSPHRASE, SALT_A, TEST_ITERATIONS);
    const base = await buildEditRecord(key, SALT_A_B64, 'actions:a-1', { title: 'placeholder' });
    const { iv, ct } = await encryptWithKey(key, 'not an object');
    const notAnObject: StoredEdit = { ...base, iv, ct };

    await expect(decryptEditFields(notAnObject, key)).rejects.toThrow();

    const [view] = await hydrateEdits([notAnObject], SALT_A_B64, key);
    expect(view.locked).toBe(true);
  });
});

describe('edits - exportEditsJson', () => {
  it('is deterministic: the same views produce byte-identical output regardless of input order, sorted by id', () => {
    const now = new Date('2020-01-05T10:00:00.000Z');
    const views: EditView[] = [
      { id: 'actions:a-2', at: '2020-01-02T00:00:00.000Z', locked: false, fields: { title: 'Item two' } },
      { id: 'actions:a-1', at: '2020-01-01T00:00:00.000Z', locked: false, fields: { title: 'Item one' } },
      { id: 'actions:a-3', at: '2020-01-03T00:00:00.000Z', locked: true },
    ];
    const first = exportEditsJson(views, now);
    const second = exportEditsJson([...views].reverse(), now);
    expect(first).toBe(second);

    const parsed = JSON.parse(first) as { kind: string; version: number; exportedAt: string; edits: { id: string }[] };
    expect(parsed.kind).toBe('life-dashboard-edits');
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe('2020-01-05T10:00:00.000Z');
    expect(parsed.edits.map((e) => e.id)).toEqual(['actions:a-1', 'actions:a-2']);
  });

  it('omits locked views - no plaintext fields available to export', () => {
    const views: EditView[] = [
      { id: 'actions:a-1', at: '2020-01-01T00:00:00.000Z', locked: false, fields: { title: 'Item one' } },
      { id: 'actions:a-2', at: '2020-01-02T00:00:00.000Z', locked: true },
    ];
    const parsed = JSON.parse(exportEditsJson(views)) as { edits: { id: string }[] };
    expect(parsed.edits).toHaveLength(1);
    expect(parsed.edits[0].id).toBe('actions:a-1');
  });
});

describe('edits - parseEditsJson', () => {
  it('rejects a wrong kind', () => {
    const text = JSON.stringify({ kind: 'something-else', version: 1, exportedAt: '2020-01-05T10:00:00.000Z', edits: [] });
    expect(() => parseEditsJson(text)).toThrow('Not a Life Dashboard edits file.');
  });

  it('rejects a wrong version', () => {
    const text = JSON.stringify({ kind: 'life-dashboard-edits', version: 2, exportedAt: '2020-01-05T10:00:00.000Z', edits: [] });
    expect(() => parseEditsJson(text)).toThrow('Not a Life Dashboard edits file.');
  });

  it('rejects malformed JSON outright', () => {
    expect(() => parseEditsJson('not json at all')).toThrow('Not a Life Dashboard edits file.');
  });

  it('ignores entries missing an id', () => {
    const text = JSON.stringify({
      kind: 'life-dashboard-edits',
      version: 1,
      exportedAt: '2020-01-05T10:00:00.000Z',
      edits: [
        { at: '2020-01-01T00:00:00.000Z', fields: { title: 'No id here' } },
        { id: 'actions:a-1', at: '2020-01-02T00:00:00.000Z', fields: { title: 'Item one' } },
      ],
    });
    const parsed = parseEditsJson(text);
    expect(parsed).toEqual([{ id: 'actions:a-1', at: '2020-01-02T00:00:00.000Z', fields: { title: 'Item one' } }]);
  });
});

describe('edits - export/parse round trip', () => {
  it('round-trips unlocked views through export and parse', () => {
    const now = new Date('2020-01-05T10:00:00.000Z');
    const views: EditView[] = [
      { id: 'actions:a-1', at: '2020-01-01T00:00:00.000Z', locked: false, fields: { title: 'Item one', horizon: 'now' } },
      {
        id: 'actions:a-2',
        at: '2020-01-02T00:00:00.000Z',
        locked: false,
        fields: { done: true, doneAt: '2020-01-02T09:00:00.000Z' },
      },
      { id: 'actions:a-3', at: '2020-01-03T00:00:00.000Z', locked: true },
    ];
    const json = exportEditsJson(views, now);
    const parsed = parseEditsJson(json);
    expect(parsed).toEqual([
      { id: 'actions:a-1', at: '2020-01-01T00:00:00.000Z', fields: { title: 'Item one', horizon: 'now' } },
      { id: 'actions:a-2', at: '2020-01-02T00:00:00.000Z', fields: { done: true, doneAt: '2020-01-02T09:00:00.000Z' } },
    ]);
  });
});
