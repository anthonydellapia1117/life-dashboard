/**
 * Board grouping - the kanban view's columns.
 *
 * A column is a grade (src/lib/grade.ts), so moving a card between columns is
 * the same thing as changing when the item is due. There is no separate
 * "board status" to keep in step with the dates, which is the usual way a
 * board and a calendar drift apart.
 */

import { BOARD_GRADES, GRADE_META, gradeOf, type Grade } from './grade';
import type { ResolvedNode } from './live';

export interface BoardColumn {
  grade: Grade;
  label: string;
  short: string;
  items: ResolvedNode[];
}

/** What a column means in date terms - what dropping a card there sets its due date to. */
export function dueForGrade(grade: Grade, now: Date = new Date()): string | null | undefined {
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const dow = now.getDay();
  const toSunday = dow === 0 ? 0 : 7 - dow;
  switch (grade) {
    case 'overdue':
      return day(-1);
    case 'today':
      return day(0);
    case 'tomorrow':
      return day(1);
    case 'thisWeek':
      return day(Math.max(2, toSunday));
    case 'nextWeek':
      return day(toSunday + 7);
    case 'later':
      return day(30);
    case 'someday':
      return null; // clears the date
    case 'done':
      return undefined; // done is a state, not a date - the caller flips done instead
  }
}

/** Sort inside a column: earliest due first, undated last, then title. */
export function sortColumn(items: ResolvedNode[]): ResolvedNode[] {
  return [...items].sort((a, b) => {
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });
}

/**
 * Columns for the board. Empty columns are kept, because a board whose columns
 * move around as work lands is a board you have to re-read every time.
 * "No date" is folded in only when it holds something.
 */
export function boardColumns(nodes: ResolvedNode[], now: Date = new Date()): BoardColumn[] {
  const buckets = new Map<Grade, ResolvedNode[]>();
  for (const grade of BOARD_GRADES) buckets.set(grade, []);
  const someday: ResolvedNode[] = [];

  for (const node of nodes) {
    const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);
    if (grade === 'someday') someday.push(node);
    else buckets.get(grade)?.push(node);
  }

  const columns: BoardColumn[] = BOARD_GRADES.map((grade) => ({
    grade,
    label: GRADE_META[grade].label,
    short: GRADE_META[grade].short,
    items: sortColumn(buckets.get(grade) ?? []),
  }));

  if (someday.length > 0) {
    const doneIndex = columns.findIndex((c) => c.grade === 'done');
    const column: BoardColumn = {
      grade: 'someday',
      label: GRADE_META.someday.label,
      short: GRADE_META.someday.short,
      items: sortColumn(someday),
    };
    columns.splice(doneIndex, 0, column);
  }
  return columns;
}
