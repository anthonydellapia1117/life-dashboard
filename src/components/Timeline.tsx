import type { CalendarEvent } from '../types';
import { countdown, formatDate } from '../lib/date';
import { EmptyState } from './ui';

export function Timeline({ events, emptyLabel }: { events: CalendarEvent[] | undefined; emptyLabel?: string }) {
  if (!events || events.length === 0) return <EmptyState label={emptyLabel ?? 'Nothing scheduled.'} />;

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="timeline">
      {sorted.map((event) => {
        const chip = countdown(event.date, event.state === 'done');
        const dotState = event.state ?? (chip.tone === 'overdue' ? 'urgent' : undefined);
        return (
          <div className={`timeline-item${dotState ? ` timeline-item-${dotState}` : ''}`} key={event.id}>
            <div className="timeline-date">
              {formatDate(event.date)}
              {event.time ? ` · ${event.time}` : ''}
            </div>
            <div className="timeline-title">{event.title}</div>
            {event.detail ? <div className="timeline-desc">{event.detail}</div> : null}
            <div className={`timeline-chip timeline-chip-${chip.tone}`}>{chip.label}</div>
          </div>
        );
      })}
    </div>
  );
}
