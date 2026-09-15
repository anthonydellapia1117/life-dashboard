/**
 * Today screen's "Next 14 days" agenda: group calendar events by day,
 * labelling each day "Today", "Tomorrow", or an absolute "Wed, Sep 16".
 *
 * The window is forward-looking (today through today + windowDays - 1), but
 * anything already overdue (a past date still in the data, not marked
 * "done") is kept rather than silently dropped - the UI dims it instead via
 * the returned countdown tone, so nothing open falls off the screen just
 * because its date passed.
 */

import type { CalendarEvent } from '../types';
import { countdown, daysUntil, formatWeekdayMonthDayISO, type CountdownTone } from './date';

export interface GroupedDayItem {
  event: CalendarEvent;
  tone: CountdownTone;
}

export interface GroupedDay {
  /** ISO date (YYYY-MM-DD) of this group - stable sort/identity key. */
  key: string;
  label: string;
  items: GroupedDayItem[];
}

function dayLabel(iso: string, today: Date): string {
  const d = daysUntil(iso, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return formatWeekdayMonthDayISO(iso);
}

export function groupUpcoming(
  events: CalendarEvent[],
  today: Date = new Date(),
  windowDays = 14,
): GroupedDay[] {
  const withinWindow = events.filter((e) => {
    const d = daysUntil(e.date, today);
    return d !== undefined && d < windowDays;
  });

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of withinWindow) {
    const list = byDate.get(event.date);
    if (list) list.push(event);
    else byDate.set(event.date, [event]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayEvents]) => ({
      key,
      label: dayLabel(key, today),
      items: [...dayEvents]
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
        .map((event) => ({
          event,
          tone: countdown(event.date, event.state === 'done', today).tone,
        })),
    }));
}
