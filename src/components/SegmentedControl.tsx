import { useRef } from 'react';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

/** Sticky segmented control that switches sections within a zone - one visible at a time. */
export function SegmentedControl<T extends string>({
  options,
  active,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusAt(index: number) {
    const id = options[(index + options.length) % options.length].id;
    refs.current[id]?.focus();
    onChange(id);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(options.length - 1);
    }
  }

  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((opt, index) => (
        <button
          key={opt.id}
          ref={(el) => {
            refs.current[opt.id] = el;
          }}
          type="button"
          role="tab"
          aria-selected={active === opt.id}
          aria-current={active === opt.id ? 'true' : undefined}
          tabIndex={active === opt.id ? 0 : -1}
          className={`segmented-item${active === opt.id ? ' active' : ''}`}
          onClick={() => onChange(opt.id)}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
