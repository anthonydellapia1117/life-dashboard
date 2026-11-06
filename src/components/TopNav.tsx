import { useEffect, useRef } from 'react';
import { BUCKETS } from '../lib/bucket';
import { useBucketFilter } from '../lib/filter';
import { ZONE_IDS, ZONE_LABELS, type ZoneId } from '../lib/routing';
import { Rail } from './Rail';

/**
 * Sticky glass top nav, on every tab once unlocked. Left: wordmark. Center:
 * the zone tabs as an iOS segmented control (hash routes). Right: the six
 * bucket chips that drive the global filter (src/lib/filter.ts), plus Clear
 * filters while one is set. Under it, the progress rail (Rail.tsx). On
 * phones the tabs scroll sideways and the chips wrap to their own row
 * (global.css).
 *
 * The chips carry data-bucket-chip, not data-bucket, so the filter never dims
 * the control that changes it.
 */
export function TopNav({ active, onChange, now }: { active: ZoneId; onChange: (id: ZoneId) => void; now: Date }) {
  const { selected, toggle, clear } = useBucketFilter();
  const tabsRef = useRef<HTMLElement>(null);
  // On a phone the tab strip scrolls sideways; bring the active tab to the middle so it is never off-screen.
  useEffect(() => {
    const strip = tabsRef.current?.querySelector<HTMLElement>('.seg');
    const item = strip?.querySelector<HTMLElement>('.seg-item.is-active');
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2;
  }, [active]);
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <a className="topnav-mark" href="#lifeos" onClick={() => onChange('lifeos')}>
          Life OS
        </a>
        <nav className="topnav-tabs" aria-label="Tabs" ref={tabsRef}>
          <div className="seg" role="tablist">
            {ZONE_IDS.map((id) => (
              <a
                key={id}
                href={`#${id}`}
                role="tab"
                aria-selected={active === id}
                aria-current={active === id ? 'page' : undefined}
                className={`seg-item${active === id ? ' is-active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onChange(id);
                }}
              >
                {ZONE_LABELS[id]}
              </a>
            ))}
          </div>
        </nav>
        <div className="topnav-chips" role="group" aria-label="Filter by bucket">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              data-bucket-chip={b.id}
              className={`bchip ${b.className}${selected === b.id ? ' is-on' : ''}${selected && selected !== b.id ? ' is-off' : ''}`}
              aria-pressed={selected === b.id}
              title={`${b.id} ${b.name}`}
              onClick={() => toggle(b.id)}
            >
              <span className="bchip-dot" aria-hidden="true" />
              <span className="bchip-num">{b.id}</span>
              <span className="bchip-name">{b.name}</span>
            </button>
          ))}
          {selected ? (
            <button type="button" className="topnav-clear" onClick={clear}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
      <Rail now={now} />
    </header>
  );
}
