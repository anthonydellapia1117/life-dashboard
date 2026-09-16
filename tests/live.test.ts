import { describe, expect, it } from 'vitest';
import { CREATED_PREFIX, applyFields, resolveNodes } from '../src/lib/live';
import type { EditFields } from '../src/lib/edits';
import type { LifeNode } from '../src/lib/nodes';
import type { LifeData } from '../src/types';

function base(over: Partial<LifeNode> = {}): LifeNode {
  return {
    id: 'actions:a-1', rawId: 'a-1', source: 'actions', kind: 'action',
    title: 'Item one', detail: 'Base detail', area: 'Area A',
    zone: 'today', due: '2020-02-01', horizon: 'week', baseDone: false,
    ...over,
  };
}

describe('applyFields', () => {
  it('returns the base item untouched when there is no patch', () => {
    const node = applyFields(base(), undefined);
    expect(node.title).toBe('Item one');
    expect(node.due).toBe('2020-02-01');
    expect(node.done).toBe(false);
    expect(node.edited).toBe(false);
  });

  it('takes done from the base row when the data already says so', () => {
    expect(applyFields(base({ baseDone: true }), undefined).done).toBe(true);
  });

  it('overrides only the fields the patch names', () => {
    const node = applyFields(base(), { title: 'Renamed' });
    expect(node.title).toBe('Renamed');
    expect(node.detail).toBe('Base detail');
    expect(node.due).toBe('2020-02-01');
    expect(node.edited).toBe(true);
  });

  it('treats null as an explicit clear, not as "leave it alone"', () => {
    const node = applyFields(base(), { due: null, horizon: null });
    expect(node.due).toBeUndefined();
    expect(node.horizon).toBeUndefined();
  });

  it('carries doneAt through and clears it when done is taken back', () => {
    expect(applyFields(base(), { done: true, doneAt: '2020-03-01T10:00:00Z' }).doneAt).toBe('2020-03-01T10:00:00Z');
    expect(applyFields(base({ baseDone: true }), { done: false, doneAt: null }).doneAt).toBeUndefined();
  });

  it('can hide an item without removing it', () => {
    expect(applyFields(base(), { archived: true }).archived).toBe(true);
  });

  it('never lets a patch move an item to another screen', () => {
    const node = applyFields(base(), { title: 'Renamed', zone: 'build', section: 'projects', area: 'Elsewhere' });
    expect(node.zone).toBe('today');
    expect(node.area).toBe('Area A');
  });
});

describe('resolveNodes', () => {
  const data = {
    meta: { asOf: '2020-01-01T00:00:00Z', generatedBy: 'test', sources: [] },
    kpis: [], alerts: [], calendar: [],
    actions: [
      { id: 'a-1', title: 'Item one', horizon: 'week', area: 'Area A' },
      { id: 'a-2', title: 'Item two', horizon: 'now', area: 'Area B' },
    ],
  } as unknown as LifeData;

  it('returns the base list untouched when the overlay is empty', () => {
    const nodes = resolveNodes(data, new Map());
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => !n.edited && !n.done)).toBe(true);
  });

  it('applies a patch to the matching base item and leaves the rest alone', () => {
    const edits = new Map<string, EditFields>([['actions:a-1', { done: true, doneAt: '2020-03-01T10:00:00Z' }]]);
    const nodes = resolveNodes(data, edits);
    expect(nodes.find((n) => n.id === 'actions:a-1')?.done).toBe(true);
    expect(nodes.find((n) => n.id === 'actions:a-2')?.done).toBe(false);
  });

  it('adds an item the user created here, at the top, marked as created', () => {
    const id = `${CREATED_PREFIX}abc`;
    const edits = new Map<string, EditFields>([[id, { title: 'Brand new', area: 'Inbox', zone: 'today' }]]);
    const nodes = resolveNodes(data, edits);
    expect(nodes).toHaveLength(3);
    expect(nodes[0].id).toBe(id);
    expect(nodes[0].title).toBe('Brand new');
    expect(nodes[0].created).toBe(true);
  });

  it('gives a created item a safe title and home when the patch carries neither', () => {
    const edits = new Map<string, EditFields>([[`${CREATED_PREFIX}bare`, { done: false }]]);
    const node = resolveNodes(data, edits)[0];
    expect(node.title).toBe('Untitled');
    expect(node.area).toBe('Inbox');
    expect(node.zone).toBe('today');
  });

  it('ignores a patch whose item is not in the data, rather than inventing a row', () => {
    const edits = new Map<string, EditFields>([['actions:gone', { title: 'Ghost' }]]);
    expect(resolveNodes(data, edits)).toHaveLength(2);
  });

  it('returns nothing, and does not throw, before the data has loaded', () => {
    expect(resolveNodes(undefined, new Map())).toEqual([]);
  });

  it('keeps ids unique once created items are folded in', () => {
    const edits = new Map<string, EditFields>([
      [`${CREATED_PREFIX}one`, { title: 'A' }],
      [`${CREATED_PREFIX}two`, { title: 'B' }],
      ['actions:a-1', { title: 'Renamed' }],
    ]);
    const ids = resolveNodes(data, edits).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
