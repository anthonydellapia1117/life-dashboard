import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW,
  LAST_SEEN_KEY,
  WINDOW_KEY,
  codeLatest,
  initLastSeen,
  isUnread,
  loadWindow,
  markAllRead,
  saveWindow,
  stream,
  taskGroups,
  taskView,
  toTime,
  unreadCount,
  windowMs,
  type ClaudeChat,
  type ClaudeTask,
  perDay,
} from '../src/lib/claude';
import type { KeyValueStorage } from '../src/lib/filter';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const blocked: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const NOW = new Date('2026-11-06T14:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function chat(title: string, updated: string | undefined, surface = 'chat'): ClaudeChat {
  return { title, url: `https://example.test/${title}`, project: '', when: 'label', updated, surface, bucket: 1 };
}

describe('toTime', () => {
  it('reads ISO with offset, local stamps and bare dates', () => {
    expect(toTime('2026-11-06T01:33:02-05:00')).toBe(Date.parse('2026-11-06T06:33:02Z'));
    expect(toTime('2026-11-06 01:21')).toBe(new Date(2026, 10, 6, 1, 21).getTime());
    expect(toTime('2026-10-31')).toBe(new Date(2026, 9, 31).getTime());
  });
  it('returns undefined for empty or unparseable values', () => {
    expect(toTime('')).toBeUndefined();
    expect(toTime(undefined)).toBeUndefined();
    expect(toTime('3 minutes ago')).toBeUndefined();
  });
});

describe('unread', () => {
  it('first visit seeds lastSeen with the generated time, so older chats are read', () => {
    const s = memoryStorage();
    const seen = initLastSeen(s, '2026-11-06T03:00:00-05:00', NOW);
    expect(seen).toBe(Date.parse('2026-11-06T08:00:00Z'));
    expect(s.data[LAST_SEEN_KEY]).toBe('2026-11-06T08:00:00.000Z');
    expect(isUnread(chat('old', '2026-11-06T02:00:00-05:00'), seen)).toBe(false);
    expect(isUnread(chat('new', '2026-11-06T04:00:00-05:00'), seen)).toBe(true);
  });
  it('a stored lastSeen wins over the generated time', () => {
    const s = memoryStorage({ [LAST_SEEN_KEY]: '2026-11-01T00:00:00.000Z' });
    expect(initLastSeen(s, '2026-11-06T03:00:00-05:00', NOW)).toBe(Date.parse('2026-11-01T00:00:00Z'));
  });
  it('falls back to now with no generated time or blocked storage', () => {
    expect(initLastSeen(memoryStorage(), undefined, NOW)).toBe(NOW.getTime());
    expect(initLastSeen(blocked, undefined, NOW)).toBe(NOW.getTime());
  });
  it('an undated chat is never unread; mark all read clears the count', () => {
    const chats = [chat('a', NOW.toISOString()), chat('b', undefined), chat('c', new Date(NOW.getTime() - DAY).toISOString())];
    const seen = NOW.getTime() - HOUR;
    expect(unreadCount(chats, seen)).toBe(1);
    const s = memoryStorage();
    const after = markAllRead(s, new Date(NOW.getTime() + 1000));
    expect(unreadCount(chats, after)).toBe(0);
    expect(s.data[LAST_SEEN_KEY]).toBeDefined();
  });
});

describe('streams', () => {
  it('splits by surface, newest first, undated after dated in the given order', () => {
    const chats = [
      chat('u1', undefined),
      chat('older', '2026-11-01T00:00:00Z'),
      chat('cw', '2026-11-05T00:00:00Z', 'cowork'),
      chat('newer', '2026-11-05T00:00:00Z'),
      chat('u2', ''),
    ];
    expect(stream(chats, 'chat').map((c) => c.title)).toEqual(['newer', 'older', 'u1', 'u2']);
    expect(stream(chats, 'cowork').map((c) => c.title)).toEqual(['cw']);
    expect(stream(undefined, 'chat')).toEqual([]);
  });
  it('code latest flattens recent titles at their project time, newest first', () => {
    const rows = codeLatest({
      code: {
        projects: [
          { project: 'A', sessions: 2, last: '2026-11-01 10:00', recent: ['a1', 'a2'], bucket: 4 },
          { project: 'B', sessions: 1, last: '2026-11-05 10:00', recent: ['b1'], bucket: 9 },
        ],
      },
    });
    expect(rows.map((r) => r.title)).toEqual(['b1', 'a1', 'a2']);
    expect(rows[0].bucket).toBe(1);
    expect(rows[1].bucket).toBe(4);
  });
});

describe('scheduled task window', () => {
  const task = (over: Partial<ClaudeTask>): ClaudeTask => ({ name: 't', schedule: 'sched-a', next: '', enabled: true, ...over });

  it('counts a run inside the window and not one outside it', () => {
    const ms = windowMs('7d');
    expect(taskView(task({ last: new Date(NOW.getTime() - 2 * DAY).toISOString() }), NOW, ms).ran).toBe(true);
    expect(taskView(task({ last: new Date(NOW.getTime() - 8 * DAY).toISOString() }), NOW, ms).ran).toBe(false);
    expect(taskView(task({ last: new Date(NOW.getTime() - 8 * DAY).toISOString() }), NOW, windowMs('2w')).ran).toBe(true);
    expect(taskView(task({ last: new Date(NOW.getTime() - 2 * HOUR).toISOString() }), NOW, windowMs('24h')).ran).toBe(true);
  });
  it('dims a task with no run and no next run inside the window', () => {
    const ms = windowMs('3d');
    expect(taskView(task({ next_at: new Date(NOW.getTime() + DAY).toISOString() }), NOW, ms).outside).toBe(false);
    expect(taskView(task({ next_at: new Date(NOW.getTime() + 20 * DAY).toISOString() }), NOW, ms).outside).toBe(true);
    expect(taskView(task({ enabled: false, next_at: new Date(NOW.getTime() + DAY).toISOString() }), NOW, ms).outside).toBe(true);
  });
  it('groups active above paused and counts both KPIs', () => {
    const g = taskGroups(
      [
        task({ name: 'a', last: new Date(NOW.getTime() - HOUR).toISOString() }),
        task({ name: 'p', enabled: false }),
        task({ name: 'b' }),
      ],
      NOW,
      windowMs('7d'),
    );
    expect(g.active.map((v) => v.task.name)).toEqual(['a', 'b']);
    expect(g.paused.map((v) => v.task.name)).toEqual(['p']);
    expect(g.ranCount).toBe(1);
    expect(g.activeCount).toBe(2);
    expect(taskGroups(undefined, NOW, windowMs('7d')).activeCount).toBe(0);
  });
  it('persists the window choice and ignores junk', () => {
    expect(loadWindow(memoryStorage())).toBe(DEFAULT_WINDOW);
    expect(loadWindow(memoryStorage({ [WINDOW_KEY]: 'forever' }))).toBe('7d');
    expect(loadWindow(blocked)).toBe('7d');
    const s = memoryStorage();
    saveWindow('2w', s);
    expect(loadWindow(s)).toBe('2w');
    expect(() => saveWindow('1m', blocked)).not.toThrow();
  });
});

describe('perDay', () => {
  const row = (updated?: string): ClaudeChat => ({ title: 't', url: 'u', project: '', when: '', updated, surface: 'chat' });
  const now = new Date(2026, 10, 6, 15, 0);

  it('counts rows per local day, oldest first, ending today', () => {
    const out = perDay([row('2026-11-06 09:00'), row('2026-11-06 22:00'), row('2026-11-04 08:00'), row('2026-11-01 08:00')], 3, now);
    expect(out).toEqual([1, 0, 2]);
  });

  it('skips rows with no parseable timestamp and handles an empty feed', () => {
    expect(perDay([row(), row('not a date')], 2, now)).toEqual([0, 0]);
    expect(perDay(undefined, 4, now)).toEqual([0, 0, 0, 0]);
    expect(perDay([row('2026-11-06 09:00')], 0, now)).toEqual([]);
  });
});
