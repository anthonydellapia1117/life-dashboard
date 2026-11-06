/**
 * Optional local calendar, read at build time from data/calendar.json
 * (array of { date, title, bucket }). No network. The file is gitignored with
 * the rest of data/*.json, so CI builds simply have none and the strip shows
 * an empty week. Missing or malformed file reads as no entries.
 */

const files = import.meta.glob('../../data/calendar.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

export function loadCalendarFile(): unknown[] {
  const first = Object.values(files)[0];
  return Array.isArray(first) ? first : [];
}
