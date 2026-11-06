import { useState } from 'react';
import { capItems } from '../lib/rail';

/**
 * The one "+N more" control. Every capped list in the app ends with it, so
 * the fold reads the same on every tab. Renders nothing when nothing is
 * folded and the list is closed.
 */
export function More({ hidden, open, onToggle }: { hidden: number; open: boolean; onToggle: () => void }) {
  if (hidden <= 0 && !open) return null;
  return (
    <button type="button" className="more-btn" aria-expanded={open} onClick={onToggle}>
      {open ? 'Show less' : `+${hidden} more`}
    </button>
  );
}

/** Cap state for one list: the rows to draw, plus the More control that unfolds the rest. */
export function useCapped<T>(items: readonly T[], cap: number, showAll = false) {
  const [open, setOpen] = useState(false);
  const { shown, hidden } = capItems(items, cap, open || showAll);
  const more = showAll ? null : <More hidden={hidden} open={open} onToggle={() => setOpen(!open)} />;
  return { shown, more };
}
