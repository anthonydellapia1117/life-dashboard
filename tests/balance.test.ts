import { describe, expect, it } from 'vitest';
import { computeAreaBreakdown, computeBalanceTotals, zoneForArea } from '../src/lib/balance';
import type { ActionItem, CalendarEvent } from '../src/types';

const TODAY = new Date(2026, 0, 10); // 2026-01-10

function action(id: string, area: string): ActionItem {
  return { id, title: `Task ${id}`, horizon: 'now', area };
}

function event(id: string, date: string, area: string): CalendarEvent {
  return { id, date, title: `Event ${id}`, area };
}

describe('zoneForArea', () => {
  it('maps known area vocabulary to its zone, case-insensitively', () => {
    expect(zoneForArea('Work')).toBe('work');
    expect(zoneForArea('career')).toBe('work');
    expect(zoneForArea('Business')).toBe('work');
    expect(zoneForArea('Family')).toBe('life');
    expect(zoneForArea('Finances')).toBe('life');
    expect(zoneForArea('UNICO')).toBe('life');
    expect(zoneForArea('Projects')).toBe('build');
    expect(zoneForArea('AI Stack')).toBe('build');
  });

  it('counts an unrecognized or missing area under Life', () => {
    expect(zoneForArea('Something New')).toBe('life');
    expect(zoneForArea(undefined)).toBe('life');
  });
});

describe('computeBalanceTotals', () => {
  it('sums open actions and next-14-day calendar events by zone', () => {
    const actions = [action('a1', 'Work'), action('a2', 'Family'), action('a3', 'Projects'), action('a4', 'Mystery')];
    const calendar = [
      event('e1', '2026-01-11', 'Career'), // +1 day -> work
      event('e2', '2026-01-12', 'AI Stack'), // +2 days -> build
    ];
    const totals = computeBalanceTotals(actions, calendar, TODAY, 14);
    // actions: work=1 (a1), life=2 (a2 + unknown a4), build=1 (a3)
    // calendar (both within window): work +1 (e1), build +1 (e2)
    expect(totals).toEqual({ work: 2, life: 2, build: 2 });
  });

  it('excludes calendar events outside the window (past or beyond windowDays)', () => {
    const calendar = [
      event('past', '2026-01-05', 'Work'), // -5 days, excluded
      event('far', '2026-01-30', 'Work'), // +20 days, excluded
      event('in', '2026-01-15', 'Work'), // +5 days, included
    ];
    const totals = computeBalanceTotals([], calendar, TODAY, 14);
    expect(totals.work).toBe(1);
  });
});

describe('computeAreaBreakdown', () => {
  it('counts open actions per literal area tag, sorted desc, ties alphabetical', () => {
    const actions = [
      action('a1', 'Work'),
      action('a2', 'Work'),
      action('a3', 'Family'),
      action('a4', 'Career'),
      action('a5', 'Family'),
      action('a6', 'Career'),
    ];
    const breakdown = computeAreaBreakdown(actions);
    // Work=2, Family=2, Career=2 - all tied, so alphabetical: Career, Family, Work.
    expect(breakdown).toEqual([
      { area: 'Career', count: 2 },
      { area: 'Family', count: 2 },
      { area: 'Work', count: 2 },
    ]);
  });
});
