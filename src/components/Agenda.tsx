import type { GroupedDay } from '../lib/grouping';
import { EmptyState } from './ui';
import { bucketOf } from '../lib/bucket';
import { CAPS } from '../lib/rail';
import { useCapped } from './More';

/** Next 14 days: calendar events grouped by day; overdue/past items dimmed. */
export function Agenda({ days }: { days: GroupedDay[] }) {
  if (days.length === 0) return <EmptyState label="Nothing on the calendar." />;
  return (
    <div className="agenda">
      {days.map((day) => (
        <AgendaDay day={day} key={day.key} />
      ))}
    </div>
  );
}

function AgendaDay({ day }: { day: GroupedDay }) {
  const { shown, more } = useCapped(day.items, CAPS.agendaPerDay);
  return (
    <div className="agenda-day">
      <div className="agenda-day-label">{day.label}</div>
      {shown.map(({ event, tone }) => (
        <div
          className={`agenda-item${tone === 'overdue' ? ' agenda-item-dim' : ''}`}
          key={event.id}
          data-bucket={bucketOf({ title: event.title, area: event.area, detail: event.detail })}
        >
          {event.time ? <span className="agenda-time">{event.time}</span> : null}
          <div className="agenda-text">
            <div className="agenda-title">{event.title}</div>
            {event.detail ? <div className="agenda-detail">{event.detail}</div> : null}
          </div>
        </div>
      ))}
      {more}
    </div>
  );
}
