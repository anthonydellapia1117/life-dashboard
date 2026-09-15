/**
 * The only three reserved status colours in the app (critical/warning/good).
 * Always paired with a visible text label next to it - see global.css: text
 * itself never wears a status colour, only this small icon does.
 */

export type StatusTone = 'critical' | 'warning' | 'good';

export function StatusIcon({ tone }: { tone: StatusTone }) {
  const className = `status-icon status-icon-${tone}`;
  if (tone === 'critical') {
    return (
      <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="5" />
      </svg>
    );
  }
  if (tone === 'warning') {
    return (
      <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M5 0 L10 9 L0 9 Z" />
      </svg>
    );
  }
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 5.3 L4 7.8 L8.5 2" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
