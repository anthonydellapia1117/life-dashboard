/**
 * Global bucket filter - one selected Life OS bucket (1-6) or none.
 *
 * The store is plain TypeScript (testable in Node with an injected storage).
 * React reads it through useBucketFilter(); the DOM reads it through
 * installFilterDom(), which marks every element carrying data-bucket with
 * is-dimmed (other bucket) or is-match (selected bucket). Any tab, including
 * ones added later, gets the filter for free by putting data-bucket on its
 * elements. Canvas views (the 3D buckets, the web) read the hook instead.
 *
 * Only the selected bucket number is stored (localStorage, key lifeos.filter):
 * a UI preference, never item content.
 */
import { useSyncExternalStore } from 'react';
import type { BucketId } from './bucket';

export const FILTER_STORAGE_KEY = 'lifeos.filter';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FilterStore {
  get(): BucketId | null;
  set(id: BucketId | null): void;
  /** Select `id`, or clear when `id` is already selected. */
  toggle(id: BucketId): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export function parseBucket(value: unknown): BucketId | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6 ? (n as BucketId) : null;
}

export function createFilterStore(storage?: KeyValueStorage): FilterStore {
  let current: BucketId | null = null;
  try {
    current = parseBucket(storage?.getItem(FILTER_STORAGE_KEY) ?? null);
  } catch {
    current = null;
  }
  const listeners = new Set<() => void>();

  function set(id: BucketId | null) {
    const next = parseBucket(id);
    if (next === current) return;
    current = next;
    try {
      if (next === null) storage?.removeItem(FILTER_STORAGE_KEY);
      else storage?.setItem(FILTER_STORAGE_KEY, String(next));
    } catch {
      // Storage blocked (private mode): the filter still works for this session.
    }
    for (const l of listeners) l();
  }

  return {
    get: () => current,
    set,
    toggle: (id) => set(current === id ? null : id),
    clear: () => set(null),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** The app's one store. */
export const bucketFilter: FilterStore = createFilterStore(browserStorage());

export function useBucketFilter(): {
  selected: BucketId | null;
  set: (id: BucketId | null) => void;
  toggle: (id: BucketId) => void;
  clear: () => void;
} {
  const selected = useSyncExternalStore(bucketFilter.subscribe, bucketFilter.get, bucketFilter.get);
  return { selected, set: bucketFilter.set, toggle: bucketFilter.toggle, clear: bucketFilter.clear };
}

/** Class for one element given the current filter: '' (no filter), 'is-match' or 'is-dimmed'. */
export function filterClassFor(bucket: unknown, selected: BucketId | null): '' | 'is-match' | 'is-dimmed' {
  if (selected === null) return '';
  return parseBucket(bucket) === selected ? 'is-match' : 'is-dimmed';
}

function applyTo(root: ParentNode, selected: BucketId | null) {
  root.querySelectorAll<HTMLElement | SVGElement>('[data-bucket]').forEach((el) => {
    const cls = filterClassFor(el.getAttribute('data-bucket'), selected);
    el.classList.toggle('is-dimmed', cls === 'is-dimmed');
    el.classList.toggle('is-match', cls === 'is-match');
  });
}

/**
 * Wire the store to the document: Esc clears, html[data-filter] mirrors the
 * selection, and every [data-bucket] element (now or added later) gets its
 * class. Returns an uninstall function.
 */
export function installFilterDom(doc: Document = document, store: FilterStore = bucketFilter): () => void {
  const html = doc.documentElement;
  let queued = false;
  const run = () => {
    queued = false;
    const selected = store.get();
    if (selected === null) html.removeAttribute('data-filter');
    else html.setAttribute('data-filter', String(selected));
    applyTo(doc, selected);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(run);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && store.get() !== null) store.clear();
  };
  const unsub = store.subscribe(schedule);
  const observer = new MutationObserver(schedule);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-bucket'] });
  doc.addEventListener('keydown', onKey);
  run();
  return () => {
    unsub();
    observer.disconnect();
    doc.removeEventListener('keydown', onKey);
  };
}
