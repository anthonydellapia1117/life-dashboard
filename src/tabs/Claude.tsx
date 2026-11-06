import { useMemo, useState } from 'react';
import type { LifeData } from '../types';
import type { ResolvedNode } from '../lib/live';
import type { KeyValueStorage } from '../lib/filter';
import { formatRelativeTime, formatWeekdayMonthDay } from '../lib/date';
import {
  WINDOWS,
  bucketFor,
  cloudRows,
  codeLatest,
  initLastSeen,
  isUnread,
  loadWindow,
  markAllRead,
  perDay,
  saveWindow,
  stream,
  taskGroups,
  toTime,
  unreadCount,
  windowMs,
  type ClaudeChat,
  type ClaudeCodeProject,
  type CodeRow,
  type TaskView,
  type WindowId,
} from '../lib/claude';
import { SegmentedControl } from '../components/SegmentedControl';
import { StatRow, StatTile } from '../components/StatTile';
import { useCapped } from '../components/More';
import { CAPS } from '../lib/rail';

const STREAM_CAP = CAPS.claudeStream;
const CODE_CAP = CAPS.code;

function browserStorage(): KeyValueStorage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function rel(at: number | undefined, fallback: string, now: Date): string {
  return at === undefined ? fallback : formatRelativeTime(new Date(at).toISOString(), now);
}

function when(at: number | undefined): string {
  if (at === undefined) return '';
  const d = new Date(at);
  return `${formatWeekdayMonthDay(d)}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function ChatStream({
  label,
  chats,
  lastSeen,
  now,
  showAll,
}: {
  label: string;
  chats: ClaudeChat[];
  lastSeen: number;
  now: Date;
  showAll: boolean;
}) {
  const { shown, more } = useCapped(chats, STREAM_CAP, showAll);
  const unread = chats.filter((c) => isUnread(c, lastSeen)).length;
  return (
    <section className="cl-stream" aria-label={label}>
      <h3 className="cl-sub">
        {label} <span className="cl-count">{chats.length}</span>
        {unread > 0 ? <span className="cl-unread-badge">{unread} unread</span> : null}
      </h3>
      <div className="group cl-list">
        {chats.length === 0 ? <p className="empty cl-pad">Nothing here yet.</p> : null}
        {shown.map((c, i) => {
          const b = bucketFor(c.bucket);
          const at = toTime(c.updated);
          return (
            <div key={`${c.url}:${i}`} className={`cl-row bucket-${b}${isUnread(c, lastSeen) ? ' is-unread' : ''}`} data-bucket={b}>
              <span className="cl-dot" aria-hidden="true" />
              <span className="cl-main">
                {c.url ? (
                  <a className="cl-title" href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.title}
                  </a>
                ) : (
                  <span className="cl-title">{c.title}</span>
                )}
                {c.project ? <span className="cl-meta">{c.project}</span> : null}
              </span>
              <span className="cl-when" title={c.when}>
                {rel(at, c.when, now)}
              </span>
            </div>
          );
        })}
      </div>
      {more}
    </section>
  );
}

function TaskRow({ v, now }: { v: TaskView; now: Date }) {
  const { task } = v;
  const next = toTime(task.next_at);
  const last = toTime(task.last);
  return (
    <div className={`cl-task bucket-${bucketFor(task.bucket)}${v.outside ? ' is-outside' : ''}`} data-bucket={bucketFor(task.bucket)}>
      <span className="cl-task-name">{task.name}</span>
      <span className="cl-meta">{task.schedule ?? ''}</span>
      <span className="cl-task-line">
        <span>Next: {task.enabled ? (next !== undefined ? when(next) : task.next || 'not scheduled') : task.next || 'paused'}</span>
        <span>{last !== undefined ? `Last: ${rel(last, '', now)}${task.status ? `, ${task.status}` : ''}` : 'last run unknown'}</span>
      </span>
    </div>
  );
}

function CodeList({ rows, now, cap, showAll }: { rows: CodeRow[]; now: Date; cap: number; showAll: boolean }) {
  const { shown, more } = useCapped(rows, cap, showAll);
  return (
    <>
      <div className="group cl-list">
        {rows.length === 0 ? <p className="empty cl-pad">No sessions indexed.</p> : null}
        {shown.map((r) => (
          <div key={r.key} className={`cl-row bucket-${r.bucket}`} data-bucket={r.bucket}>
            <span className="cl-dot" aria-hidden="true" />
            <span className="cl-main">
              {r.url ? (
                <a className="cl-title" href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.title}
                </a>
              ) : (
                <span className="cl-title">{r.title}</span>
              )}
              <span className="cl-meta">{r.project}</span>
            </span>
            <span className="cl-when">{rel(r.at, '', now)}</span>
          </div>
        ))}
      </div>
      {more}
    </>
  );
}

function ProjectList({ projects, now, showAll }: { projects: ClaudeCodeProject[]; now: Date; showAll: boolean }) {
  const { shown, more } = useCapped(projects, CODE_CAP, showAll);
  return (
    <>
      <div className="group cl-list">
        {projects.length === 0 ? <p className="empty cl-pad">No projects indexed.</p> : null}
        {shown.map((p) => {
          const b = bucketFor(p.bucket);
          return (
            <div key={p.project} className={`cl-row cl-proj bucket-${b}`} data-bucket={b}>
              <span className="cl-dot" aria-hidden="true" />
              <span className="cl-main">
                <span className="cl-title">{p.project}</span>
                <span className="cl-meta">
                  {p.sessions} session{p.sessions === 1 ? '' : 's'}
                </span>
                {p.recent.slice(0, 3).map((t, i) => (
                  <span key={i} className="cl-recent">
                    {t}
                  </span>
                ))}
              </span>
              <span className="cl-when">{rel(toTime(p.last_at) ?? toTime(p.last), p.last, now)}</span>
            </div>
          );
        })}
      </div>
      {more}
    </>
  );
}

/**
 * Claude tab (route #claude). Three columns on desktop - scheduled tasks
 * (left, 280px), the Chat and Cowork streams (centre), Code (right, 320px) -
 * stacking centre, right, left under 900px. Every row carries data-bucket so
 * the global filter dims and rings it with no extra wiring.
 */
export function ClaudeTab({ data, now }: { data: LifeData; nodes: ResolvedNode[]; now: Date; onOpen: (id: string) => void }) {
  const feed = data.claude;
  const storage = useMemo(browserStorage, []);
  const [win, setWin] = useState<WindowId>(() => loadWindow(storage));
  const [lastSeen, setLastSeen] = useState<number>(() => initLastSeen(storage, feed?.generated_at, now));
  const [codeView, setCodeView] = useState<'latest' | 'project'>('latest');
  const [showAll, setShowAll] = useState(false);

  const chatStream = useMemo(() => stream(feed?.chats, 'chat'), [feed]);
  const coworkStream = useMemo(() => stream(feed?.chats, 'cowork'), [feed]);
  const latest = useMemo(() => codeLatest(feed), [feed]);
  const cloud = useMemo(() => cloudRows(feed), [feed]);
  const groups = useMemo(() => taskGroups(feed?.tasks, now, windowMs(win)), [feed, now, win]);

  if (!feed) {
    return (
      <div className="tab-page claude-page">
        <p className="callout cl-empty">No Claude data yet - the Sunday refresh has not run.</p>
      </div>
    );
  }

  const unread = unreadCount(feed.chats, lastSeen);
  const projects = feed.code?.projects ?? [];
  const kpis: Array<{ label: string; value: number; alert?: boolean; series?: number[] }> = [
    { label: 'Chats', value: chatStream.length, series: perDay(chatStream, 14, now) },
    { label: 'Cowork tasks', value: coworkStream.length, series: perDay(coworkStream, 14, now) },
    { label: 'Code sessions on this Mac', value: feed.code?.total ?? 0 },
    { label: 'Scheduled tasks active', value: groups.activeCount },
    { label: 'Unread', value: unread, alert: unread > 0 },
  ];

  return (
    <div className="tab-page claude-page">
      <StatRow label="Claude at a glance">
        {kpis.map((k) => (
          <StatTile key={k.label} label={k.label} value={k.value} alert={k.alert} series={k.series} />
        ))}
      </StatRow>
      <p className="footnote cl-stamp">Refreshed {feed.generated_at ? when(toTime(feed.generated_at)) : (feed.generated ?? 'unknown')}</p>

      <div className="cl-grid">
        <section className="cl-col cl-center" aria-label="Claude">
          <div className="cl-head">
            <h2 className="title2">Claude</h2>
            <span className="cl-actions">
              <button
                type="button"
                className="btn-tinted"
                onClick={() => setLastSeen(markAllRead(storage, new Date()))}
                disabled={unread === 0}
              >
                Mark all read
              </button>
              <button type="button" className="btn-tinted" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Hide details' : 'Show all details'}
              </button>
            </span>
          </div>
          <div className="cl-streams">
            <ChatStream label="Chat" chats={chatStream} lastSeen={lastSeen} now={now} showAll={showAll} />
            <ChatStream label="Cowork" chats={coworkStream} lastSeen={lastSeen} now={now} showAll={showAll} />
          </div>
        </section>

        <section className="cl-col cl-right" aria-label="Code">
          <div className="cl-head">
            <h2 className="title2">Code</h2>
            <SegmentedControl
              className="seg-inline"
              ariaLabel="Code view"
              options={[
                { id: 'latest', label: 'Latest' },
                { id: 'project', label: 'By project' },
              ]}
              active={codeView}
              onChange={setCodeView}
            />
          </div>
          {codeView === 'latest' ? (
            <CodeList rows={latest} now={now} cap={CODE_CAP} showAll={showAll} />
          ) : (
            <ProjectList projects={projects} now={now} showAll={showAll} />
          )}
          {cloud.length > 0 ? (
            <>
              <h3 className="cl-sub">
                Cloud <span className="cl-count">{cloud.length}</span>
              </h3>
              <CodeList rows={cloud} now={now} cap={CODE_CAP} showAll={showAll} />
            </>
          ) : null}
          {feed.code_note ? <p className="footnote cl-note">{feed.code_note}</p> : null}
        </section>

        <section className="cl-col cl-left" aria-label="Scheduled tasks">
          <div className="cl-head">
            <h2 className="title2">Scheduled tasks</h2>
          </div>
          <SegmentedControl
            className="seg-inline cl-window"
            ariaLabel="Time window"
            options={WINDOWS.map((w) => ({ id: w.id, label: w.label }))}
            active={win}
            onChange={(id) => {
              setWin(id);
              saveWindow(id, storage);
            }}
          />
          <p className="subhead cl-task-kpi">
            <strong>{groups.ranCount}</strong> ran in the last {win} - <strong>{groups.activeCount}</strong> active
          </p>
          <h3 className="cl-sub">
            Active <span className="cl-count">{groups.active.length}</span>
          </h3>
          <div className="group cl-list">
            {groups.active.length === 0 ? <p className="empty cl-pad">No active tasks.</p> : null}
            {groups.active.map((v) => (
              <TaskRow key={v.task.name} v={v} now={now} />
            ))}
          </div>
          {groups.paused.length > 0 ? (
            <>
              <h3 className="cl-sub">
                Paused <span className="cl-count">{groups.paused.length}</span>
              </h3>
              <div className="group cl-list">
                {groups.paused.map((v) => (
                  <TaskRow key={v.task.name} v={v} now={now} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
