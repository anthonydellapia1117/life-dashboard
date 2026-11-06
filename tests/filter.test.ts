import { describe, expect, it, vi } from 'vitest';
import {
  FILTER_STORAGE_KEY,
  createFilterStore,
  filterClassFor,
  parseBucket,
  type KeyValueStorage,
} from '../src/lib/filter';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('bucket filter store', () => {
  it('starts empty with no storage or nothing stored', () => {
    expect(createFilterStore().get()).toBeNull();
    expect(createFilterStore(memoryStorage()).get()).toBeNull();
  });

  it('sets a bucket and notifies subscribers once per change', () => {
    const store = createFilterStore(memoryStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(3);
    expect(store.get()).toBe(3);
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('toggles: selecting the selected bucket again clears it', () => {
    const store = createFilterStore(memoryStorage());
    store.toggle(4);
    expect(store.get()).toBe(4);
    store.toggle(2);
    expect(store.get()).toBe(2);
    store.toggle(2);
    expect(store.get()).toBeNull();
  });

  it('clear restores no filter', () => {
    const store = createFilterStore(memoryStorage());
    store.set(6);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('persists under lifeos.filter and removes the key on clear', () => {
    const storage = memoryStorage();
    const store = createFilterStore(storage);
    store.set(5);
    expect(storage.data[FILTER_STORAGE_KEY]).toBe('5');
    store.clear();
    expect(FILTER_STORAGE_KEY in storage.data).toBe(false);
  });

  it('reads a stored bucket back, and ignores junk', () => {
    expect(createFilterStore(memoryStorage({ [FILTER_STORAGE_KEY]: '2' })).get()).toBe(2);
    expect(createFilterStore(memoryStorage({ [FILTER_STORAGE_KEY]: '9' })).get()).toBeNull();
    expect(createFilterStore(memoryStorage({ [FILTER_STORAGE_KEY]: 'x' })).get()).toBeNull();
  });

  it('keeps working when storage throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createFilterStore(broken);
    store.set(1);
    expect(store.get()).toBe(1);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('unsubscribe stops notifications', () => {
    const store = createFilterStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('filter classes', () => {
  it('parses bucket ids 1-6 only', () => {
    expect(parseBucket('1')).toBe(1);
    expect(parseBucket(6)).toBe(6);
    expect(parseBucket(0)).toBeNull();
    expect(parseBucket('2.5')).toBeNull();
    expect(parseBucket(null)).toBeNull();
  });

  it('marks match and dimmed only while a bucket is selected', () => {
    expect(filterClassFor('3', null)).toBe('');
    expect(filterClassFor('3', 3)).toBe('is-match');
    expect(filterClassFor('4', 3)).toBe('is-dimmed');
  });
});
