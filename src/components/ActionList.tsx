import type { ActionItem, Horizon } from '../types';
import { EmptyState } from './ui';

const GROUP_ORDER: Horizon[] = ['now', 'week', 'later', 'routine'];
const GROUP_LABELS: Record<Horizon, string> = {
  now: 'Now',
  week: 'This week',
  later: 'Later',
  routine: 'Routine',
};

export function ActionList({ actions }: { actions: ActionItem[] | undefined }) {
  if (!actions || actions.length === 0) return <EmptyState label="No open actions." />;

  const groups = GROUP_ORDER.map((horizon) => ({
    horizon,
    items: actions.filter((a) => a.horizon === horizon),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="action-groups">
      {groups.map((group) => (
        <div className="action-group" key={group.horizon}>
          <div className={`action-group-label action-group-label-${group.horizon}`}>{GROUP_LABELS[group.horizon]}</div>
          {group.items.map((action) => (
            <div className="action-item" key={action.id}>
              <div className={`action-check action-check-${group.horizon}`} aria-hidden="true" />
              <div className="action-text">
                <div className="action-title">{action.title}</div>
                {action.detail ? <div className="action-meta">{action.detail}</div> : null}
              </div>
              <div className="action-area">{action.area}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
