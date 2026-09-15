import { formatDateTime } from '../lib/date';

export function Header({
  asOf,
  unlocked,
  onLock,
}: {
  asOf?: string;
  unlocked: boolean;
  onLock: () => void;
}) {
  return (
    <header className="app-header">
      <div className="app-brand">
        AVD <span className="accent">Life</span>
      </div>
      {asOf ? <div className="app-asof">As of {formatDateTime(asOf)}</div> : null}
      {unlocked ? (
        <button type="button" className="lock-button" onClick={onLock}>
          Lock
        </button>
      ) : null}
    </header>
  );
}
