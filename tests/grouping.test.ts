import { describe, expect, it } from 'vitest';
import { groupUpcoming } from '../src/lib/grouping';
import type { CalendarEvent } from '../src/types';

// Fixed "today" - Saturday, 2026-01-10.
const TODAY = new Date(2026, 0, 10);

function event(id: string, date: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id, date, title: `Event ${id}`, ...overrides };
}

describe('groupUpcoming relative-day labels', () => {
  it('labels today and tomorrow, and an absolute weekday for anything further out', () => {
    const days = groupUpcoming(
      [event('today', '2026-01-10'), event('tomorrow', '2026-01-11'), event('later', '2026-01-16')],
      TODAY,
    );
    expect(days.map((d) => d.label)).toEqual(['Today', 'Tomorrow', 'Fri, Jan 16']);
  });

  it('sorts groups chronologically regardless of input order', () => {
    const days = groupUpcoming([event('c', '2026-01-20'), event('a', '2026-01-10'), event('b', '2026-01-15')], TODAY);
    expect(days.map((d) => d.key)).toEqual(['2026-01-10', '2026-01-15', '2026-01-20']);
  });

  it('sorts same-day items by time', () => {
    const days = groupUpcoming(
      [event('late', '2026-01-10', { time: '20:15' }), event('early', '2026-01-10', { time: '08:45' })],
      TODAY,
    );
    expect(days[0].items.map((i) => i.event.id)).toEqual(['early', 'late']);
  });

  it('keeps an overdue (past-dated, not-done) event and flags it for dimming', () => {
    const days = groupUpcoming([event('overdue', '2026-01-05')], TODAY, 14);
    expect(days).toHaveLength(1);
    expect(days[0].items[0].tone).toBe('overdue');
  });

  it('marks a past event tagged "done" as done, not overdue', () => {
    const days = groupUpcoming([event('finished', '2026-01-05', { state: 'done' })], TODAY, 14);
    expect(days[0].items[0].tone).toBe('done');
  });

  it('respects the window: day 13 is in, day 14 is out (14-day window)', () => {
    const inWindow = event('in', '2026-01-23'); // 13 days out
    const outOfWindow = event('out', '2026-01-24'); // 14 days out
    const days = groupUpcoming([inWindow, outOfWindow], TODAY, 14);
    expect(days.map((d) => d.key)).toEqual(['2026-01-23']);
  });
});
