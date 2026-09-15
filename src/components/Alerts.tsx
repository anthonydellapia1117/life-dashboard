import type { Alert, Severity } from '../types';
import { StatusIcon, type StatusTone } from './StatusIcon';
import { Disclosure } from './Disclosure';
import { EmptyState } from './ui';

const TONE: Record<Severity, StatusTone | undefined> = {
  urgent: 'critical',
  warning: 'warning',
  info: undefined,
};

function AlertRow({ alert }: { alert: Alert }) {
  const tone = TONE[alert.severity];
  return (
    <div className={`alert${tone ? '' : ' alert-info'}`}>
      {tone ? <StatusIcon tone={tone} /> : null}
      <span>{alert.text}</span>
    </div>
  );
}

/**
 * Urgent and warning alerts show inline (icon + label); info folds into "+N notes".
 * `folded` (Today): everything folds behind one line of counts, because the same
 * items already lead the Focus list and the agenda - a second copy is noise.
 */
export function Alerts({ alerts, folded = false }: { alerts: Alert[] | undefined; folded?: boolean }) {
  if (!alerts || alerts.length === 0) return <EmptyState label="No alerts." />;
  const primary = alerts.filter((a) => a.severity !== 'info');
  const info = alerts.filter((a) => a.severity === 'info');

  if (folded) {
    const urgent = alerts.filter((a) => a.severity === 'urgent').length;
    const warning = alerts.filter((a) => a.severity === 'warning').length;
    return (
      <Disclosure
        summary={
          <span className="alert-summary">
            {urgent > 0 ? (
              <span>
                <StatusIcon tone="critical" /> {urgent} urgent
              </span>
            ) : null}
            {warning > 0 ? (
              <span>
                <StatusIcon tone="warning" /> {warning} heads-up
              </span>
            ) : null}
            {info.length > 0 ? <span>{info.length} notes</span> : null}
            <span className="alert-more">Show</span>
          </span>
        }
      >
        {[...primary, ...info].map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </Disclosure>
    );
  }

  return (
    <div className="alerts">
      {primary.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
      {info.length > 0 ? (
        <Disclosure summary={`+${info.length} notes`}>
          {info.map((alert) => (
            <div className="alert alert-info" key={alert.id}>
              <span>{alert.text}</span>
            </div>
          ))}
        </Disclosure>
      ) : null}
    </div>
  );
}
