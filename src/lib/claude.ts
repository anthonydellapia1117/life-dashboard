/**
 * Claude tab - pure helpers. No React, no DOM; storage is injected so the
 * Node test suite can exercise it.
 *
 * The feed (data/claude.json, sealed in as `claude`) is built on the Mac by
 * the claude-dashboard build_data.py. That script turns claude.ai's relative
 * labels ("4 hours ago", "Oct 27") into absolute `updated` timestamps; the
 * relative words shown here are computed live from those.
 */
import type { BucketId } from './bucket';
import { parseBucket, type KeyValueStorage } from './filter';

export interface ClaudeChat {
  title: string;
  url: string;
  project: string;
  /** The label claude.ai showed when the list was read. */
  when: string;
  /** ISO 8601 with offset, derived from `when`; empty when it could not be parsed. */
  updated?: string;
  surface: 'chat' | 'cowork' | string;
  computer?: string;
  bucket?: number;
}

export interface ClaudeCodeProject {
  project: string;
  sessions: number;
  /** "YYYY-MM-DD HH:MM", Mac local time. */
  last: string;
  last_at?: string;
  kb?: number;
  recent: string[];
  bucket?: number;
}

export interface ClaudeCloudSession {
  title: string;
  url: string;
  last: string;
  last_at?: string;
  bucket?: number;
  note?: string;
}

export interface ClaudeTask {
  name: string;
  /** When it runs, in words (the feed also carries the scheduler field under its original key). */
  schedule?: string;
  /** What the scheduler said, for display when next_at is missing. */
  next: string;
  next_at?: string;
  enabled: boolean;
  /** Last run, ISO; empty when unknown. */
  last?: string;
  status?: string;
  bucket?: number;
}

export interface ClaudeData {
  generated?: string;
  generated_at?: string;
  chats?: ClaudeChat[];
  code?: { computer?: string; total?: number; cowork?: number; projects?: ClaudeCodeProject[] };
  cloud?: ClaudeCloudSession[];
  code_note?: string;
  tasks?: ClaudeTask[];
}

export const WINDOW_KEY = 'lifeos.claude.window';
export const LAST_SEEN_KEY = 'lifeos.claude.lastSeen';

export type WindowId = '24h' | '3d' | '7d' | '2w' | '1m';
const DAY = 86_400_000;
export const WINDOWS: Array<{ id: WindowId; label: string; ms: number }> = [
  { id: '24h', label: '24h', ms: DAY },
  { id: '3d', label: '3d', ms: 3 * DAY },
  { id: '7d', label: '7d', ms: 7 * DAY },
  { id: '2w', label: '2w', ms: 14 * DAY },
  { id: '1m', label: '1m', ms: 30 * DAY },
];
export const DEFAULT_WINDOW: WindowId = '7d';

export function windowMs(id: WindowId): number {
  return (WINDOWS.find((w) => w.id === id) ?? WINDOWS[2]).ms;
}

/**
 * Milliseconds for an ISO timestamp, a "YYYY-MM-DD HH:MM" local stamp or a
 * bare date (local midnight). Undefined when empty or unparseable.
 */
export function toTime(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (local) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = local;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
}

export function bucketFor(value: unknown): BucketId {
  return parseBucket(value) ?? 1;
}

/* ---------- Window (scheduled tasks) ---------- */

export function loadWindow(storage?: KeyValueStorage): WindowId {
  try {
    const v = storage?.getItem(WINDOW_KEY);
    if (v && WINDOWS.some((w) => w.id === v)) return v as WindowId;
  } catch {
    // Storage blocked: fall back to the default.
  }
  return DEFAULT_WINDOW;
}

export function saveWindow(id: WindowId, storage?: KeyValueStorage): void {
  try {
    storage?.setItem(WINDOW_KEY, id);
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }
}

export interface TaskView {
  task: ClaudeTask;
  /** Last run falls inside [now - window, now]. */
  ran: boolean;
  /** Next run falls inside [now, now + window]. */
  dueSoon: boolean;
  /** Neither ran nor due inside the window. */
  outside: boolean;
}

export function taskView(task: ClaudeTask, now: Date, ms: number): TaskView {
  const t = now.getTime();
  const last = toTime(task.last);
  const next = task.enabled ? toTime(task.next_at) : undefined;
  const ran = last !== undefined && last <= t && last >= t - ms;
  const dueSoon = next !== undefined && next >= t - DAY && next <= t + ms;
  return { task, ran, dueSoon, outside: !ran && !dueSoon };
}

export function taskGroups(tasks: ClaudeTask[] | undefined, now: Date, ms: number) {
  const views = (tasks ?? []).map((task) => taskView(task, now, ms));
  const active = views.filter((v) => v.task.enabled);
  const paused = views.filter((v) => !v.task.enabled);
  return { active, paused, ranCount: views.filter((v) => v.ran).length, activeCount: active.length };
}

/* ---------- Unread (chats) ---------- */

/**
 * Read lastSeen; on the very first visit, seed it with the feed's generated
 * time so nothing older than the last refresh shows as unread.
 */
export function initLastSeen(storage: KeyValueStorage | undefined, generatedAt: string | undefined, now: Date): number {
  try {
    const stored = toTime(storage?.getItem(LAST_SEEN_KEY));
    if (stored !== undefined) return stored;
  } catch {
    // fall through
  }
  const seed = toTime(generatedAt) ?? now.getTime();
  try {
    storage?.setItem(LAST_SEEN_KEY, new Date(seed).toISOString());
  } catch {
    // Storage blocked: unread resets each visit.
  }
  return seed;
}

export function markAllRead(storage: KeyValueStorage | undefined, now: Date): number {
  try {
    storage?.setItem(LAST_SEEN_KEY, now.toISOString());
  } catch {
    // Storage blocked: still clears for this visit.
  }
  return now.getTime();
}

export function isUnread(chat: ClaudeChat, lastSeen: number): boolean {
  const t = toTime(chat.updated);
  return t !== undefined && t > lastSeen;
}

export function unreadCount(chats: ClaudeChat[] | undefined, lastSeen: number): number {
  return (chats ?? []).filter((c) => isUnread(c, lastSeen)).length;
}

/* ---------- Streams ---------- */

/** Chats on one surface, newest first by `updated`, ties and undated rows in the given order. */
export function stream(chats: ClaudeChat[] | undefined, surface: 'chat' | 'cowork'): ClaudeChat[] {
  return (chats ?? [])
    .map((c, i) => ({ c, i, t: toTime(c.updated) }))
    .filter(({ c }) => (surface === 'cowork' ? c.surface === 'cowork' : c.surface !== 'cowork'))
    .sort((a, b) => {
      if (a.t !== undefined && b.t !== undefined && a.t !== b.t) return b.t - a.t;
      if (a.t === undefined && b.t !== undefined) return 1;
      if (b.t === undefined && a.t !== undefined) return -1;
      return a.i - b.i;
    })
    .map(({ c }) => c);
}

export interface CodeRow {
  key: string;
  title: string;
  project: string;
  at?: number;
  url?: string;
  bucket: BucketId;
}

/** Latest Code sessions across projects (each project's recent titles at its last time), newest first. */
export function codeLatest(data: ClaudeData | undefined): CodeRow[] {
  const rows: CodeRow[] = [];
  for (const p of data?.code?.projects ?? []) {
    const at = toTime(p.last_at) ?? toTime(p.last);
    p.recent.forEach((title, i) => {
      rows.push({ key: `p:${p.project}:${i}`, title, project: p.project, at, bucket: bucketFor(p.bucket) });
    });
  }
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.at ?? -Infinity) - (a.r.at ?? -Infinity) || a.i - b.i)
    .map(({ r }) => r);
}

export function cloudRows(data: ClaudeData | undefined): CodeRow[] {
  return (data?.cloud ?? [])
    .map((c, i) => ({
      key: `c:${i}`,
      title: c.title,
      project: c.note ?? 'Cloud session',
      at: toTime(c.last_at) ?? toTime(c.last),
      url: c.url,
      bucket: bucketFor(c.bucket),
    }))
    .sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity));
}

/**
 * How many rows were updated on each of the last `days` local days, oldest
 * first, ending today. Rows with no parseable `updated` are left out, so a
 * feed with no timestamps reads as a flat zero line rather than a guess.
 */
export function perDay(chats: ClaudeChat[] | undefined, days: number, now: Date): number[] {
  const out = new Array<number>(Math.max(0, days)).fill(0);
  if (out.length === 0) return out;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  for (const c of chats ?? []) {
    const t = toTime(c.updated);
    if (t === undefined || t < start || t >= end) continue;
    const d = new Date(t);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const idx = Math.round((dayStart - start) / 86_400_000);
    if (idx >= 0 && idx < out.length) out[idx] += 1;
  }
  return out;
}
