import { formatDateTime, formatWeekdayMonthDay } from '../lib/date';

function LockIcon() {
  return (
    <svg className="lock-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="none" stroke="currentColor" />
      <path d="M4 5.5V3.6a2 2 0 0 1 4 0V5.5" fill="none" stroke="currentColor" />
    </svg>
  );
}

export function Header({
  title,
  asOf,
  unlocked,
  onLock,
}: {
  title: string;
  asOf?: string;
  unlocked: boolean;
  onLock: () => void;
}) {
  return (
    <header className="app-header">
      <div className="app-header-row">
        <h1 className="app-title">{title}</h1>
        {unlocked ? (
          <button type="button" className="lock-button" onClick={onLock}>
            <LockIcon />
            Lock
          </button>
        ) : null}
      </div>
      <div className="app-header-meta">
        <span>{formatWeekdayMonthDay(new Date())}</span>
        {asOf ? <span>Data as of {formatDateTime(asOf)}</span> : null}
      </div>
    </header>
  );
}
