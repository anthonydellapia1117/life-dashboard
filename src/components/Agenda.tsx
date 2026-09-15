import type { GroupedDay } from '../lib/grouping';
import { EmptyState } from './ui';

/** Next 14 days: calendar events grouped by day; overdue/past items dimmed. */
export function Agenda({ days }: { days: GroupedDay[] }) {
  if (days.length === 0) return <EmptyState label="Nothing on the calendar." />;
  return (
    <div className="agenda">
      {days.map((day) => (
        <div className="agenda-day" key={day.key}>
          <div className="agenda-day-label">{day.label}</div>
          {day.items.map(({ event, tone }) => (
            <div className={`agenda-item${tone === 'overdue' ? ' agenda-item-dim' : ''}`} key={event.id}>
              {event.time ? <span className="agenda-time">{event.time}</span> : null}
              <div className="agenda-text">
                <div className="agenda-title">{event.title}</div>
                {event.detail ? <div className="agenda-detail">{event.detail}</div> : null}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
