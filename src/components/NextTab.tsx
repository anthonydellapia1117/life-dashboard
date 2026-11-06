import { nextZone, SECTIONS_BY_ZONE, ZONE_LABELS, type ZoneId } from '../lib/routing';
import { THEME_COLORS, worldFor } from '../lib/world';

/**
 * The quiet "next" affordance at the bottom of every tab: the next tab's
 * world swatch, its name and a drawn chevron, in the nav's left-to-right
 * order. The last tab has no next, so it draws nothing - the roadmap ends.
 */
export function NextTab({ zone, onGo }: { zone: ZoneId; onGo: (id: ZoneId) => void }) {
  const next = nextZone(zone);
  if (!next) return null;
  const world = worldFor(next, SECTIONS_BY_ZONE[next][0]);
  const swatch = THEME_COLORS[world];
  return (
    <nav className="next-tab-wrap" aria-label="Next tab">
      <a
        className="next-tab"
        href={`#${next}`}
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0 });
          onGo(next);
        }}
      >
        <span
          className="next-tab-swatch"
          aria-hidden="true"
          style={{ '--swatch-light': swatch.light, '--swatch-dark': swatch.dark } as React.CSSProperties}
        />
        <span className="next-tab-text">
          <span className="next-tab-eyebrow">Next</span>
          <span className="next-tab-name">{ZONE_LABELS[next]}</span>
        </span>
        <svg className="next-tab-chevron" width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
          <path d="M2 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </nav>
  );
}
