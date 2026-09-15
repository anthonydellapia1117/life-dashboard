import type { ActionItem } from '../types';
import { countdown } from '../lib/date';
import { StatusIcon, type StatusTone } from './StatusIcon';

function dueTone(due: string | undefined, today: Date): StatusTone | undefined {
  if (!due) return undefined;
  const tone = countdown(due, false, today).tone;
  if (tone === 'overdue' || tone === 'today') return 'critical';
  if (tone === 'soon') return 'warning';
  return undefined;
}

/** Focus: the top 3 actions by priority score, numbered 1-3. */
export function FocusList({ actions, today }: { actions: ActionItem[]; today: Date }) {
  if (actions.length === 0) {
    return <p className="empty-state">Nothing urgent right now - see Up next.</p>;
  }
  return (
    <ol className="focus-list">
      {actions.map((action, i) => {
        const tone = dueTone(action.due, today);
        const chip = action.due ? countdown(action.due, false, today).label : undefined;
        return (
          <li className="focus-item" key={action.id}>
            <span className="focus-rank" aria-hidden="true">
              {i + 1}
            </span>
            <div className="focus-body">
              <div className="focus-title">{action.title}</div>
              {action.detail ? <div className="focus-detail">{action.detail}</div> : null}
              <div className="focus-meta">
                {chip ? (
                  <span className="chip-due">
                    {tone ? <StatusIcon tone={tone} /> : null}
                    {chip}
                  </span>
                ) : null}
                <span className="chip-area">{action.area}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
