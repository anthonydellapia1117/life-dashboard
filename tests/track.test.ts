import { describe, expect, it } from 'vitest';
import { GRADE_META, gradeOf } from '../src/lib/grade';
import { collectNodes } from '../src/lib/nodes';
import { TRACK_META, TRACK_ORDER, isTrack, partitionByTrack, trackLabel } from '../src/lib/track';
import type { ActionItem, LifeData, Track } from '../src/types';

function row(id: string, track?: Track): { id: string; track?: string } {
  return { id, track };
}

describe('track vocabulary', () => {
  it('gives every track a word and a heading, so a track is never colour alone', () => {
    for (const track of TRACK_ORDER) {
      expect(TRACK_META[track].label.length).toBeGreaterThan(0);
      expect(TRACK_META[track].heading.length).toBeGreaterThan(0);
      expect(TRACK_META[track].caption.length).toBeGreaterThan(0);
    }
  });

  it('covers exactly the declared tracks and nothing else', () => {
    expect(TRACK_ORDER).toEqual(['waiting', 'unconfirmed', 'review']);
    expect(Object.keys(TRACK_META).sort()).toEqual([...TRACK_ORDER].sort());
    expect(isTrack('waiting')).toBe(true);
    expect(isTrack('urgent')).toBe(false);
    expect(isTrack('')).toBe(false);
  });

  it('names no grade, because a track says whose move it is and never when', () => {
    const gradeWords = Object.values(GRADE_META).flatMap((m) => [m.label.toLowerCase(), m.short.toLowerCase()]);
    for (const track of TRACK_ORDER) {
      expect(gradeWords).not.toContain(TRACK_META[track].label.toLowerCase());
      expect(gradeWords).not.toContain(track);
    }
  });

  it('labels a known track and stays quiet about anything else', () => {
    expect(trackLabel('waiting')).toBe('Waiting');
    expect(trackLabel('review')).toBe('Review');
    expect(trackLabel(undefined)).toBeUndefined();
    expect(trackLabel('nonsense')).toBeUndefined();
  });
});

describe('partitionByTrack', () => {
  it('treats a missing track as yours to do', () => {
    const { mine, tracks } = partitionByTrack([row('a'), row('b')]);
    expect(mine.map((r) => r.id)).toEqual(['a', 'b']);
    expect(tracks).toEqual([]);
  });

  it('pulls every tracked row out of the default bucket', () => {
    const { mine, tracks } = partitionByTrack([
      row('mine-1'),
      row('w', 'waiting'),
      row('r', 'review'),
      row('mine-2'),
      row('u', 'unconfirmed'),
      row('w2', 'waiting'),
    ]);
    expect(mine.map((r) => r.id)).toEqual(['mine-1', 'mine-2']);
    expect(tracks.map((t) => t.track)).toEqual(['waiting', 'unconfirmed', 'review']);
    expect(tracks[0].items.map((r) => r.id)).toEqual(['w', 'w2']);
  });

  it('omits an empty bucket instead of rendering a heading with nothing under it', () => {
    const { tracks } = partitionByTrack([row('r', 'review')]);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].track).toBe('review');
  });

  it('keeps input order inside a bucket, so the caller decides the sort', () => {
    const { tracks } = partitionByTrack([row('z', 'waiting'), row('a', 'waiting')]);
    expect(tracks[0].items.map((r) => r.id)).toEqual(['z', 'a']);
  });

  it('files an unrecognised track word under yours rather than dropping the row', () => {
    const { mine, tracks } = partitionByTrack([{ id: 'odd', track: 'someday' }]);
    expect(mine.map((r) => r.id)).toEqual(['odd']);
    expect(tracks).toEqual([]);
  });
});

describe('track on a node', () => {
  const action = (id: string, track?: Track): ActionItem => ({
    id,
    title: `Action ${id}`,
    horizon: 'now',
    area: 'Work',
    track,
  });

  it('survives the trip through collectNodes', () => {
    const data = { meta: { asOf: '2026-01-10' }, actions: [action('a', 'waiting'), action('b')] } as unknown as LifeData;
    const nodes = collectNodes(data);
    expect(nodes.find((n) => n.rawId === 'a')?.track).toBe('waiting');
    expect(nodes.find((n) => n.rawId === 'b')?.track).toBeUndefined();
  });

  it('leaves the grade alone - a waiting item can still be overdue', () => {
    const now = new Date(2026, 0, 10);
    expect(gradeOf({ due: '2026-01-05', horizon: 'now', done: false }, now)).toBe('overdue');
    const data = {
      meta: { asOf: '2026-01-10' },
      actions: [{ ...action('late', 'waiting'), due: '2026-01-05' }],
    } as unknown as LifeData;
    const node = collectNodes(data).find((n) => n.rawId === 'late');
    expect(node?.track).toBe('waiting');
    expect(gradeOf({ due: node?.due, horizon: node?.horizon, done: false }, now)).toBe('overdue');
  });
});
