import { useRef } from 'react';
import { TAB_IDS, TAB_LABELS, type TabId } from '../types';

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(index: number) {
    const id = TAB_IDS[(index + TAB_IDS.length) % TAB_IDS.length];
    refs.current[id]?.focus();
    onChange(id);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(TAB_IDS.length - 1);
    }
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="Dashboard sections">
      {TAB_IDS.map((id, index) => (
        <button
          key={id}
          ref={(el) => {
            refs.current[id] = el;
          }}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={active === id}
          aria-controls={`panel-${id}`}
          tabIndex={active === id ? 0 : -1}
          className={`tab-button${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {TAB_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
