/**
 * Priority grading - the single vocabulary the whole app uses to say "when".
 *
 * Every item in the dashboard, whatever slice it came from, resolves to
 * exactly one Grade. The grade drives the colour of its chip, which column
 * it sits in on the board, which bucket it lands in on the roadmap, and how
 * much XP finishing it is worth. One classifier, so two screens can never
 * disagree about whether something is due this week.
 *
 * How a grade is decided, in order:
 *   1. done            -> 'done', always, whatever the date says.
 *   2. an absolute due date decides, against the LOCAL calendar:
 *        before today                 -> 'overdue'
 *        today / tomorrow             -> 'today' / 'tomorrow'
 *        through the coming Sunday    -> 'thisWeek'
 *        the Monday-Sunday after that -> 'nextWeek'
 *        within 90 days               -> 'later'
 *        beyond                       -> 'someday'
 *   3. no due date: the item's horizon decides (now -> today, week ->
 *      thisWeek, later -> later, routine/absent -> someday).
 *
 * Weeks are calendar weeks ending Sunday, not a rolling 7 days, because
 * "this week" and "next week" are what a person means by those words. On a
 * Saturday "this week" is nearly empty and that is correct.
 *
 * COLOUR CONTRACT (see also DESIGN.md): the eight grade colours are a
 * reserved, ordered urgency ramp. They are never reused for anything
 * categorical, they never dress up text, and a grade is never signalled by
 * colour alone - every chip carries its icon and its word. The tokens live
 * in src/styles/global.css as --grade-<key>; nothing outside this file
 * should name a grade colour.
 */

import { daysUntil } from './date';

export type Grade =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisWeek'
  | 'nextWeek'
  | 'later'
  | 'someday'
  | 'done';

/** Most urgent first. Board columns, roadmap buckets and legends all read this order. */
export const GRADE_ORDER: Grade[] = [
  'overdue',
  'today',
  'tomorrow',
  'thisWeek',
  'nextWeek',
  'later',
  'someday',
  'done',
];

/** The columns a kanban board shows by default - 'done' is a column too, 'someday' is folded away. */
export const BOARD_GRADES: Grade[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later', 'done'];

export interface GradeMeta {
  /** The word shown on the chip. Always present - a grade is never colour alone. */
  label: string;
  /** Shorter form for tight spots like a board column header on a phone. */
  short: string;
  /** CSS custom property holding this grade's colour. */
  token: string;
  /** Icon key for src/components/GradeIcon.tsx. */
  icon: 'alert' | 'dot' | 'arrow' | 'week' | 'weekNext' | 'clock' | 'dashed' | 'check';
  /** Rank for sorting - lower is more urgent. Matches GRADE_ORDER. */
  rank: number;
}

export const GRADE_META: Record<Grade, GradeMeta> = {
  overdue: { label: 'Overdue', short: 'Overdue', token: '--grade-overdue', icon: 'alert', rank: 0 },
  today: { label: 'Today', short: 'Today', token: '--grade-today', icon: 'dot', rank: 1 },
  tomorrow: { label: 'Tomorrow', short: 'Tmrw', token: '--grade-tomorrow', icon: 'arrow', rank: 2 },
  thisWeek: { label: 'This week', short: 'This wk', token: '--grade-this-week', icon: 'week', rank: 3 },
  nextWeek: { label: 'Next week', short: 'Next wk', token: '--grade-next-week', icon: 'weekNext', rank: 4 },
  later: { label: 'Later', short: 'Later', token: '--grade-later', icon: 'clock', rank: 5 },
  someday: { label: 'No date', short: 'No date', token: '--grade-someday', icon: 'dashed', rank: 6 },
  done: { label: 'Done', short: 'Done', token: '--grade-done', icon: 'check', rank: 7 },
};

/** The class that paints a grade. One class, so a grade colour can never be written inline. */
export function gradeClass(grade: Grade): string {
  return `grade-${grade}`;
}

/** Days from `now` to the end of the current calendar week (Sunday). 0 on a Sunday. */
export function daysToEndOfWeek(now: Date = new Date()): number {
  const dow = now.getDay(); // 0 Sun ... 6 Sat
  return dow === 0 ? 0 : 7 - dow;
}

/** Horizon words in the data, for items that carry no date of their own. */
const HORIZON_GRADE: Record<string, Grade> = {
  now: 'today',
  week: 'thisWeek',
  later: 'later',
  routine: 'someday',
};

/** How far out "later" reaches before an item is simply someday, in days. */
export const LATER_HORIZON_DAYS = 90;

export interface GradeInput {
  due?: string;
  horizon?: string;
  done: boolean;
}

export function gradeOf(input: GradeInput, now: Date = new Date()): Grade {
  if (input.done) return 'done';

  if (input.due) {
    const d = daysUntil(input.due, now);
    if (d !== undefined) {
      if (d < 0) return 'overdue';
      if (d === 0) return 'today';
      if (d === 1) return 'tomorrow';
      const endOfWeek = daysToEndOfWeek(now);
      if (d <= endOfWeek) return 'thisWeek';
      if (d <= endOfWeek + 7) return 'nextWeek';
      if (d <= LATER_HORIZON_DAYS) return 'later';
      return 'someday';
    }
  }

  if (input.horizon && Object.prototype.hasOwnProperty.call(HORIZON_GRADE, input.horizon)) {
    return HORIZON_GRADE[input.horizon];
  }
  return 'someday';
}

/** Sort comparator: most urgent grade first, then earliest due, then title. Stable and total. */
export function compareByGrade(
  a: { due?: string; horizon?: string; done: boolean; title: string },
  b: { due?: string; horizon?: string; done: boolean; title: string },
  now: Date = new Date(),
): number {
  const ra = GRADE_META[gradeOf(a, now)].rank;
  const rb = GRADE_META[gradeOf(b, now)].rank;
  if (ra !== rb) return ra - rb;
  if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

/** True for the grades that mean "this needs attention now" - drives the Today hero and the alert dot. */
export function isPressing(grade: Grade): boolean {
  return grade === 'overdue' || grade === 'today';
}
