import type { Alert } from '../types';
import { SeverityDot } from './ui';

export function Alerts({ alerts }: { alerts: Alert[] | undefined }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="alerts">
      {alerts.map((alert) => (
        <div className={`alert alert-${alert.severity}`} key={alert.id}>
          <SeverityDot severity={alert.severity} />
          {alert.text}
        </div>
      ))}
    </div>
  );
}
