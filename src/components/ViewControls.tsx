import type { ReactNode } from 'react';

/**
 * Shared zoom bar for the web, the Board and the Brain: Zoom out, Fit, Zoom
 * in, then any extra controls, then optional mini-map dots (one per column or
 * region; tap one to jump there). Icons are drawn as SVG, never arrow glyphs.
 */
export interface ViewDots {
  count: number;
  active: number;
  label: (i: number) => string;
  onPick: (i: number) => void;
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="vc-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ViewControls({
  onZoomOut,
  onFit,
  onZoomIn,
  zoomLabel,
  children,
  dots,
  className,
}: {
  onZoomOut: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  /** Current zoom, shown as a percentage beside the buttons. */
  zoomLabel?: string;
  children?: ReactNode;
  dots?: ViewDots;
  className?: string;
}) {
  return (
    <div className={`view-controls${className ? ` ${className}` : ''}`}>
      <div className="vc-group" role="group" aria-label="Zoom">
        <button type="button" className="btn-tinted vc-btn" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
          <Icon d="M3.5 8h9" />
        </button>
        <button type="button" className="btn-tinted vc-fit" onClick={onFit}>
          Fit
        </button>
        <button type="button" className="btn-tinted vc-btn" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
          <Icon d="M3.5 8h9M8 3.5v9" />
        </button>
        {zoomLabel ? <span className="vc-zoom" aria-live="polite">{zoomLabel}</span> : null}
      </div>
      {children}
      {dots && dots.count > 1 ? (
        <div className="vc-dots" role="group" aria-label="Jump to">
          {Array.from({ length: dots.count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`vc-dot${i === dots.active ? ' is-active' : ''}`}
              aria-label={dots.label(i)}
              aria-current={i === dots.active ? 'true' : undefined}
              onClick={() => dots.onPick(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
