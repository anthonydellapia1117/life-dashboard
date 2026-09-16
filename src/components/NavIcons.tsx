import type { ZoneId } from '../lib/routing';

/**
 * One small line icon per zone (20px, stroke 1.5, currentColor - recolors
 * with the nav item's own text colour, active or not, for free). Purely
 * decorative next to the always-present text label, so aria-hidden.
 */
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true' as const,
  className: 'nav-icon',
};

function TodayIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2" />
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2.5" y="6.5" width="15" height="10" rx="1.5" />
      <rect x="7" y="3.5" width="6" height="3.5" rx="1.5" />
      <path d="M2.5 11h15" />
    </svg>
  );
}

function LifeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M10 17s-6.5-4.35-8.5-8.1C.5 6.2 2 3.5 5 3.2c2-.2 3.6 1 5 2.8 1.4-1.8 3-3 5-2.8 3 .3 4.5 3 3.5 5.7C16.5 12.65 10 17 10 17z" />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 6L3 10l4 4M13 6l4 4-4 4M11.5 4.5l-3 11" />
    </svg>
  );
}

export function NavIcon({ zone }: { zone: ZoneId }) {
  switch (zone) {
    case 'work':
      return <WorkIcon />;
    case 'life':
      return <LifeIcon />;
    case 'build':
      return <BuildIcon />;
    default:
      return <TodayIcon />;
  }
}
