import { weekPosition } from '../lib/rail';

/**
 * The 3 px progress rail under the nav: three marks, Today, this week and
 * this month, each a thin track filled to how much of it has gone. It never
 * animates on its own; it moves only when the page renders again.
 */
export function Rail({ now }: { now: Date }) {
  const pos = weekPosition(now);
  const marks = [
    { id: 'day', label: 'Today', pct: pos.dayPct },
    { id: 'week', label: 'This week', pct: pos.weekPct },
    { id: 'month', label: 'This month', pct: pos.monthPct },
  ];
  return (
    <div className="rail" role="img" aria-label={pos.label} title={pos.label}>
      {marks.map((m) => (
        <div className={`rail-mark rail-${m.id}`} key={m.id}>
          <span className="rail-label">{m.label}</span>
          <span className="rail-track">
            <span className="rail-fill" style={{ width: `${m.pct.toFixed(1)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
