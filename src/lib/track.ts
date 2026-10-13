/**
 * Whose move it is - the second axis, orthogonal to urgency.
 *
 * src/lib/grade.ts is still the only vocabulary for WHEN. This module answers
 * a different question: is this mine to do right now, am I blocked on someone
 * else, did it maybe already happen, or is it old enough that it needs a
 * decision before it earns a place on any list.
 *
 * Separating the two is what keeps Focus honest. A list that mixes "pay this"
 * with "waiting on their AP team" and "a reminder from 2024" is a list you
 * stop reading. Four buckets, one default: no track at all means yours, now.
 *
 * No colours here. A track is a word, always - it never recolours a grade
 * chip and it never implies a date.
 */

import type { Track } from '../types';

export const TRACK_ORDER: Track[] = ['waiting', 'unconfirmed', 'review'];

export interface TrackMeta {
  /** The word on the chip beside the grade. */
  label: string;
  /** Heading for this track's own section. */
  heading: string;
  /** One line under the heading saying what the bucket is for. */
  caption: string;
}

export const TRACK_META: Record<Track, TrackMeta> = {
  waiting: {
    label: 'Waiting',
    heading: 'Waiting on someone',
    caption: 'Not yours to finish. The only move here is a nudge, and only once it is late.',
  },
  unconfirmed: {
    label: 'Unconfirmed',
    heading: 'Unconfirmed',
    caption: 'Probably done, nothing proves it. Verify before you redo any of these.',
  },
  review: {
    label: 'Review',
    heading: 'Needs review',
    caption: 'Old, optional or possibly stale. Decide whether it is still real, then file or drop it.',
  },
};

/** The chip word for a row's track, or undefined when the row carries none. */
export function trackLabel(track: string | undefined): string | undefined {
  return track && isTrack(track) ? TRACK_META[track].label : undefined;
}

export function isTrack(value: string): value is Track {
  return Object.prototype.hasOwnProperty.call(TRACK_META, value);
}

/**
 * Split a set of rows into the one bucket that is yours plus one per track.
 * Order inside each bucket is whatever order came in - callers sort first.
 */
export function partitionByTrack<T extends { track?: string }>(
  rows: T[],
): { mine: T[]; tracks: { track: Track; items: T[] }[] } {
  const mine: T[] = [];
  const byTrack = new Map<Track, T[]>();

  for (const row of rows) {
    if (row.track && isTrack(row.track)) {
      const bucket = byTrack.get(row.track);
      if (bucket) bucket.push(row);
      else byTrack.set(row.track, [row]);
    } else {
      mine.push(row);
    }
  }

  const tracks = TRACK_ORDER.filter((t) => (byTrack.get(t)?.length ?? 0) > 0).map((track) => ({
    track,
    items: byTrack.get(track)!,
  }));

  return { mine, tracks };
}
