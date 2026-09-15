import { ZONE_IDS, ZONE_LABELS, type ZoneId } from '../lib/routing';

/**
 * The 4 top-level zones (Hick's law). Fitts's law: a bottom bar within
 * thumb reach on phone (56px tall targets), a left rail at >=1024px - see
 * global.css for the responsive switch; this component just renders the
 * list once.
 */
export function NavBar({ active, onChange }: { active: ZoneId; onChange: (id: ZoneId) => void }) {
  return (
    <nav className="nav-bar" aria-label="Zones">
      {ZONE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-current={active === id ? 'true' : undefined}
          className={`nav-item${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
        >
          {ZONE_LABELS[id]}
        </button>
      ))}
    </nav>
  );
}
