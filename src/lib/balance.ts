/**
 * Today screen's Balance block: where the next two weeks go, by zone.
 *
 * Every ActionItem/CalendarEvent carries a free-text `area` tag (e.g.
 * "Work", "Family", "UNICO"). zoneForArea maps that vocabulary onto
 * the 4-zone IA; anything unrecognized counts under Life, per spec,
 * so a new area added to the data later never disappears from the count.
 */

import type { ActionItem, CalendarEvent } from '../types';
import { daysUntil } from './date';
import type { ZoneId } from './routing';

/** Today has no areas of its own - only the 3 zones Balance buckets into. */
export type BalanceZone = Exclude<ZoneId, 'today'>;

const WORK_AREAS = new Set(['work', 'career', 'business', 'ayvede']);
const BUILD_AREAS = new Set(['projects', 'ai stack', 'ai-stack', 'build']);

export function zoneForArea(area: string | undefined): BalanceZone {
  const key = (area ?? '').trim().toLowerCase();
  if (WORK_AREAS.has(key)) return 'work';
  if (BUILD_AREAS.has(key)) return 'build';
  return 'life'; // family, finances, community/UNICO, and anything unrecognized
}

export interface BalanceTotals {
  work: number;
  life: number;
  build: number;
}

/** Open actions + calendar events in the next `windowDays`, bucketed by zone. */
export function computeBalanceTotals(
  actions: ActionItem[],
  calendar: CalendarEvent[],
  today: Date = new Date(),
  windowDays = 14,
): BalanceTotals {
  const totals: BalanceTotals = { work: 0, life: 0, build: 0 };

  for (const action of actions) {
    totals[zoneForArea(action.area)] += 1;
  }

  for (const event of calendar) {
    const d = daysUntil(event.date, today);
    if (d === undefined || d < 0 || d >= windowDays) continue;
    totals[zoneForArea(event.area)] += 1;
  }

  return totals;
}

export interface AreaCount {
  area: string;
  count: number;
}

/** Open-action counts per literal area tag, sorted desc (ties broken alphabetically). */
export function computeAreaBreakdown(actions: ActionItem[]): AreaCount[] {
  const counts = new Map<string, number>();
  for (const action of actions) {
    const key = action.area || 'Other';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}
