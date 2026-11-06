import { describe, expect, it } from 'vitest';
import { CAPS, capItems, weekPosition } from '../src/lib/rail';
import { ZONE_IDS, nextZone } from '../src/lib/routing';

// Local-time constructors throughout: the rail reads the reader's own clock.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('weekPosition', () => {
  it('counts Monday as 0 and Sunday as 6', () => {
    expect(weekPosition(at(2026, 11, 2)).dayIndex).toBe(0); // Monday
    expect(weekPosition(at(2026, 11, 6)).dayIndex).toBe(4); // Friday
    expect(weekPosition(at(2026, 11, 8)).dayIndex).toBe(6); // Sunday
  });

  it('starts the week at 0 percent on Monday midnight and nears 100 late on Sunday', () => {
    expect(weekPosition(at(2026, 11, 2, 0, 0)).weekPct).toBe(0);
    const sunday = weekPosition(at(2026, 11, 8, 23, 59)).weekPct;
    expect(sunday).toBeGreaterThan(99.9);
    expect(sunday).toBeLessThanOrEqual(100);
  });

  it('puts Thursday noon halfway through the week', () => {
    expect(weekPosition(at(2026, 11, 5, 12)).weekPct).toBeCloseTo(50, 5);
  });

  it('reads 0 percent of the month at the first midnight and near 100 at the last minute', () => {
    expect(weekPosition(at(2026, 11, 1)).monthPct).toBe(0);
    const end = weekPosition(at(2026, 11, 30, 23, 59)).monthPct;
    expect(end).toBeGreaterThan(99.9);
    expect(end).toBeLessThanOrEqual(100);
  });

  it('uses the length of the month it is in, leap February included', () => {
    expect(weekPosition(at(2028, 2, 15)).monthPct).toBeCloseTo((14 / 29) * 100, 5);
    expect(weekPosition(at(2027, 2, 15)).monthPct).toBeCloseTo((14 / 28) * 100, 5);
    expect(weekPosition(at(2026, 12, 31, 12)).monthPct).toBeCloseTo((30.5 / 31) * 100, 5);
  });

  it('reports the share of today gone', () => {
    expect(weekPosition(at(2026, 11, 6, 6)).dayPct).toBeCloseTo(25, 5);
  });

  it('labels the day without relative words', () => {
    expect(weekPosition(at(2026, 11, 6)).label).toBe('Friday, day 5 of 7 this week, day 6 of 30 this month');
  });
});

describe('nextZone', () => {
  it('follows the nav order left to right', () => {
    expect(nextZone('lifeos')).toBe('today');
    expect(nextZone('today')).toBe('work');
    expect(nextZone('work')).toBe('life');
    expect(nextZone('life')).toBe('build');
    expect(nextZone('build')).toBe('map');
    expect(nextZone('map')).toBe('claude');
  });

  it('returns null after the last tab instead of looping', () => {
    expect(ZONE_IDS[ZONE_IDS.length - 1]).toBe('claude');
    expect(nextZone('claude')).toBeNull();
  });

  it('visits every zone exactly once when walked from the first', () => {
    const seen = [ZONE_IDS[0]];
    for (let z = nextZone(ZONE_IDS[0]); z; z = nextZone(z)) seen.push(z);
    expect(seen).toEqual(ZONE_IDS);
  });
});

describe('capItems', () => {
  const rows = Array.from({ length: 11 }, (_, i) => i);

  it('shows the cap and counts the rest', () => {
    expect(capItems(rows, CAPS.table)).toEqual({ shown: rows.slice(0, 8), hidden: 3 });
  });

  it('shows everything when open, under the cap, or uncapped', () => {
    expect(capItems(rows, 5, true)).toEqual({ shown: rows, hidden: 0 });
    expect(capItems(rows.slice(0, 4), 5)).toEqual({ shown: rows.slice(0, 4), hidden: 0 });
    expect(capItems(rows, 0)).toEqual({ shown: rows, hidden: 0 });
  });

  it('keeps the caps the spec names', () => {
    expect(CAPS).toEqual({ focus: 3, upNext: 5, agendaPerDay: 5, table: 8, claudeStream: 12, code: 15 });
  });
});
