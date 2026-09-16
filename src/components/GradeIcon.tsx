import { GRADE_META, gradeClass, type Grade, type GradeMeta } from '../lib/grade';

type IconKey = GradeMeta['icon'];

/**
 * The glyph half of a grade's signal. A grade is never colour alone, so every
 * place a grade colour appears, one of these appears with it, and the word
 * itself is never far away. Shapes are distinguishable in silhouette - an
 * alert bar, a filled dot, an arrow, two calendar forms, a clock, a dashed
 * ring, a check - so the ramp still reads in greyscale or forced colours.
 */
function Glyph({ icon }: { icon: IconKey }) {
  switch (icon) {
    case 'alert':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.75v4" strokeLinecap="round" />
          <circle cx="8" cy="11.25" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case 'dot':
      return <circle cx="8" cy="8" r="4.5" fill="currentColor" stroke="none" />;
    case 'arrow':
      return (
        <>
          <path d="M3 8h9" strokeLinecap="round" />
          <path d="M8.5 4.5 12 8l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'week':
      return (
        <>
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" strokeLinecap="round" />
        </>
      );
    case 'weekNext':
      return (
        <>
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <path d="M2.5 6.5h11" strokeLinecap="round" />
          <path d="M6.5 10h3.5M8.75 8.5 10.25 10l-1.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.75V8l2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'dashed':
      return <circle cx="8" cy="8" r="5.5" strokeDasharray="2.4 2.4" />;
    case 'check':
      return <path d="m3.5 8.5 3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />;
  }
}

export function GradeIcon({ grade, size = 16 }: { grade: Grade; size?: number }) {
  return (
    <svg
      className="grade-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <Glyph icon={GRADE_META[grade].icon} />
    </svg>
  );
}

/**
 * The standard grade chip: tinted ground, coloured glyph, and the word in
 * ordinary ink. The label never wears the grade colour - text keeps its text
 * token so contrast is the type system's job, not the palette's.
 */
export function GradeChip({ grade, short = false }: { grade: Grade; short?: boolean }) {
  const meta = GRADE_META[grade];
  return (
    <span className={`grade-chip ${gradeClass(grade)}`}>
      <GradeIcon grade={grade} size={13} />
      {short ? meta.short : meta.label}
    </span>
  );
}

/** A bare coloured dot for dense rows, with the word supplied as a title for assistive tech. */
export function GradeDot({ grade }: { grade: Grade }) {
  return <span className={`grade-dot ${gradeClass(grade)}`} role="img" aria-label={GRADE_META[grade].label} />;
}
