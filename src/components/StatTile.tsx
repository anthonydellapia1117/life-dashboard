/** Stat tile contract used everywhere: label (xs, text-2), value (xl, semibold,
 * proportional digits), optional sub (xs, text-3). */
export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {sub ? <div className="stat-tile-sub">{sub}</div> : null}
    </div>
  );
}
