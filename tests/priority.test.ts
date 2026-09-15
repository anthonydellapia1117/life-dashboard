import { describe, expect, it } from 'vitest';
import { focusActions, heroCounts, priorityScore, rankActions, upNextGroups } from '../src/lib/priority';
import type { ActionItem } from '../src/types';

// A fixed "today" so every test is independent of the actual calendar date.
const TODAY = new Date(2026, 0, 10); // 2026-01-10

function action(id: string, overrides: Partial<ActionItem> = {}): ActionItem {
  return { id, title: `Task ${id}`, horizon: 'later', area: 'Test', ...overrides };
}

describe('priorityScore', () => {
  it('combines horizon weight and urgency', () => {
    expect(priorityScore(action('a', { horizon: 'now' }), TODAY)).toBe(3); // no due -> urgency 0
    expect(priorityScore(action('a', { horizon: 'now', due: '2026-01-10' }), TODAY)).toBe(6); // now(3) + due today(3)
    expect(priorityScore(action('a', { horizon: 'routine' }), TODAY)).toBe(0);
  });

  it('scores an overdue due date the same as due today (both urgency 3)', () => {
    const overdue = action('a', { horizon: 'later', due: '2026-01-05' }); // 5 days ago
    const dueToday = action('b', { horizon: 'later', due: '2026-01-10' });
    expect(priorityScore(overdue, TODAY)).toBe(priorityScore(dueToday, TODAY));
  });

  it('steps urgency down as the due date moves further out', () => {
    const tomorrow = action('a', { horizon: 'later', due: '2026-01-11' });
    const in3 = action('b', { horizon: 'later', due: '2026-01-13' });
    const in7 = action('c', { horizon: 'later', due: '2026-01-17' });
    const in8 = action('d', { horizon: 'later', due: '2026-01-18' });
    expect(priorityScore(tomorrow, TODAY)).toBe(1 + 2);
    expect(priorityScore(in3, TODAY)).toBe(1 + 2);
    expect(priorityScore(in7, TODAY)).toBe(1 + 1);
    expect(priorityScore(in8, TODAY)).toBe(1 + 0);
  });
});

describe('rankActions ordering', () => {
  it('sorts by score desc, then due date asc, no-due last among ties, then original order', () => {
    const noDueA = action('no-due-a', { horizon: 'later' }); // score 1
    const noDueB = action('no-due-b', { horizon: 'later' }); // score 1, appears after noDueA
    const dueLater = action('due-later', { horizon: 'later', due: '2026-02-01' }); // still urgency 0 -> score 1
    const dueSooner = action('due-sooner', { horizon: 'later', due: '2026-01-20' }); // urgency 0 -> score 1

    const ranked = rankActions([noDueA, dueLater, noDueB, dueSooner], TODAY);

    // All four score 1 (horizon "later"=1, urgency 0 since >7 days or no due).
    // Tie-break: earliest due date first, then the no-due items in original order.
    expect(ranked.map((a) => a.id)).toEqual(['due-sooner', 'due-later', 'no-due-a', 'no-due-b']);
  });

  it('keeps stable original order for exact ties (same score, same due-ness)', () => {
    const first = action('first', { horizon: 'week' });
    const second = action('second', { horizon: 'week' });
    const third = action('third', { horizon: 'week' });
    const ranked = rankActions([third, first, second], TODAY);
    expect(ranked.map((a) => a.id)).toEqual(['third', 'first', 'second']);
  });
});

describe('focusActions', () => {
  it('excludes routine actions even when nothing else is eligible', () => {
    const routineOnly = [action('r1', { horizon: 'routine' }), action('r2', { horizon: 'routine' })];
    expect(focusActions(routineOnly, TODAY)).toEqual([]);
  });

  it('returns at most `count` items, highest score first', () => {
    const actions = [
      action('now-overdue', { horizon: 'now', due: '2026-01-01' }), // 3 + 3 = 6
      action('now-plain', { horizon: 'now' }), // 3 + 0 = 3
      action('week-plain', { horizon: 'week' }), // 2 + 0 = 2
      action('later-plain', { horizon: 'later' }), // 1 + 0 = 1
      action('routine', { horizon: 'routine' }), // excluded entirely
    ];
    const focus = focusActions(actions, TODAY, 3);
    expect(focus.map((a) => a.id)).toEqual(['now-overdue', 'now-plain', 'week-plain']);
  });
});

describe('heroCounts', () => {
  it('counts now, cumulative this-week (now+week), and total open', () => {
    const actions = [
      action('a', { horizon: 'now' }),
      action('b', { horizon: 'now' }),
      action('c', { horizon: 'week' }),
      action('d', { horizon: 'later' }),
      action('e', { horizon: 'routine' }),
    ];
    expect(heroCounts(actions)).toEqual({ now: 2, thisWeek: 3, open: 5 });
  });
});

describe('upNextGroups', () => {
  it('drops routine and already-focused items, then buckets by This week / Later', () => {
    const focusItem = action('focused', { horizon: 'now' });
    const actions = [
      focusItem,
      action('week-item', { horizon: 'week' }),
      action('later-item', { horizon: 'later' }),
      action('routine-item', { horizon: 'routine' }),
    ];
    const groups = upNextGroups(actions, [focusItem]);
    expect(groups.thisWeek.map((a) => a.id)).toEqual(['week-item']);
    expect(groups.later.map((a) => a.id)).toEqual(['later-item']);
  });
});
