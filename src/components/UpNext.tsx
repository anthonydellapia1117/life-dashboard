import type { ActionItem } from '../types';
import { EmptyState } from './ui';
import { Disclosure } from './Disclosure';

function Row({ action }: { action: ActionItem }) {
  return (
    <div className="upnext-item">
      <div className="upnext-text">
        <div className="upnext-title">{action.title}</div>
        {action.detail ? <div className="upnext-detail">{action.detail}</div> : null}
      </div>
      <div className="chip-area">{action.area}</div>
    </div>
  );
}

/** Up next: remaining non-routine actions, This week shown, Later folded. */
export function UpNext({ thisWeek, later }: { thisWeek: ActionItem[]; later: ActionItem[] }) {
  if (thisWeek.length === 0 && later.length === 0) {
    return <EmptyState label="Nothing else open." />;
  }
  return (
    <div className="upnext">
      {thisWeek.length > 0 ? (
        <div className="upnext-group">
          <div className="upnext-group-label">This week</div>
          {thisWeek.map((a) => (
            <Row action={a} key={a.id} />
          ))}
        </div>
      ) : null}
      {later.length > 0 ? (
        <Disclosure summary={`+${later.length} more (Later)`}>
          <div className="upnext-group">
            {later.map((a) => (
              <Row action={a} key={a.id} />
            ))}
          </div>
        </Disclosure>
      ) : null}
    </div>
  );
}
