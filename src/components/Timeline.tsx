import type { CalendarEvent } from '../types';
import { countdown, formatDate } from '../lib/date';
import { EmptyState } from './ui';
import { StatusIcon, type StatusTone } from './StatusIcon';

const CHIP_TONE: Record<string, StatusTone | undefined> = { overdue: 'critical', today: 'warning', soon: 'warning' };

/** Only genuinely urgent/warning states get a reserved status colour; everything else is neutral. */
function markerTone(event: CalendarEvent, overdue: boolean): 'critical' | 'warning' | undefined {
  if (event.state === 'urgent') return 'critical';
  if (event.state === 'warning') return 'warning';
  if (overdue) return 'critical';
  return undefined;
}

export function Timeline({ events, emptyLabel }: { events: CalendarEvent[] | undefined; emptyLabel?: string }) {
  if (!events || events.length === 0) return <EmptyState label={emptyLabel ?? 'Nothing scheduled.'} />;

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="timeline">
      {sorted.map((event) => {
        const chip = countdown(event.date, event.state === 'done', new Date());
        const tone = markerTone(event, chip.tone === 'overdue');
        const dimmed = event.state === 'done' || chip.tone === 'overdue';
        return (
          <div
            className={`timeline-item${tone ? ` timeline-item-${tone}` : ''}${dimmed ? ' timeline-item-dim' : ''}`}
            key={event.id}
          >
            <div className="timeline-date">
              {formatDate(event.date)}
              {event.time ? ` · ${event.time}` : ''}
            </div>
            <div className="timeline-title">{event.title}</div>
            {event.detail ? <div className="timeline-desc">{event.detail}</div> : null}
            <div className="timeline-chip">
              {CHIP_TONE[chip.tone] ? <StatusIcon tone={CHIP_TONE[chip.tone]!} /> : null}
              {chip.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
