/**
 * Today screen's Focus ranking.
 *
 * Score = horizonWeight + urgency:
 *   horizonWeight  now 3, week 2, later 1, routine 0
 *   urgency        overdue 3, due today 3, due tomorrow 2, within 3 days 2,
 *                  within 7 days 1, else (incl. no due date) 0
 *
 * Sort: score desc, then due date asc (no due date sorts last among ties),
 * then original array order - so the ranking is stable and deterministic.
 */

import type { ActionItem, Horizon } from '../types';
import { daysUntil } from './date';

const HORIZON_WEIGHT: Record<Horizon, number> = {
  now: 3,
  week: 2,
  later: 1,
  routine: 0,
};

export function urgencyScore(due: string | undefined, today: Date = new Date()): number {
  if (!due) return 0;
  const d = daysUntil(due, today);
  if (d === undefined) return 0;
  if (d < 0) return 3; // overdue
  if (d === 0) return 3; // due today
  if (d === 1) return 2; // due tomorrow
  if (d <= 3) return 2; // within 3 days
  if (d <= 7) return 1; // within 7 days
  return 0;
}

export function priorityScore(action: ActionItem, today: Date = new Date()): number {
  return HORIZON_WEIGHT[action.horizon] + urgencyScore(action.due, today);
}

export function rankActions(actions: ActionItem[], today: Date = new Date()): ActionItem[] {
  return actions
    .map((action, index) => ({ action, index, score: priorityScore(action, today) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDue = a.action.due;
      const bDue = b.action.due;
      if (aDue && bDue && aDue !== bDue) return aDue < bDue ? -1 : 1;
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.action);
}

/** Top `count` non-routine actions by priority score - the Today screen's Focus list. */
export function focusActions(actions: ActionItem[], today: Date = new Date(), count = 3): ActionItem[] {
  const eligible = actions.filter((a) => a.horizon !== 'routine');
  return rankActions(eligible, today).slice(0, count);
}

export interface HeroCounts {
  /** Open actions whose horizon is "now". */
  now: number;
  /** Open actions due by end of week - horizon "now" or "week", cumulative. */
  thisWeek: number;
  /** All open actions, any horizon. */
  open: number;
}

export function heroCounts(actions: ActionItem[]): HeroCounts {
  const now = actions.filter((a) => a.horizon === 'now').length;
  const thisWeek = actions.filter((a) => a.horizon === 'now' || a.horizon === 'week').length;
  return { now, thisWeek, open: actions.length };
}

export interface UpNextGroups {
  thisWeek: ActionItem[];
  later: ActionItem[];
}

/** Non-routine, non-focused actions grouped for the "Up next" list. */
export function upNextGroups(actions: ActionItem[], focused: ActionItem[]): UpNextGroups {
  const focusedIds = new Set(focused.map((a) => a.id));
  const remaining = actions.filter((a) => a.horizon !== 'routine' && !focusedIds.has(a.id));
  return {
    thisWeek: remaining.filter((a) => a.horizon === 'now' || a.horizon === 'week'),
    later: remaining.filter((a) => a.horizon === 'later'),
  };
}
