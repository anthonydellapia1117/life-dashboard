import { boardColumns, dueForGrade } from '../lib/board';
import { GRADE_META, gradeClass, gradeOf, type Grade } from '../lib/grade';
import type { EditFields } from '../lib/edits';
import type { ResolvedNode } from '../lib/live';
import { GradeIcon } from './GradeIcon';

/**
 * Kanban board. The columns are grades, so a card's column and its due date
 * are the same fact seen twice and cannot disagree.
 *
 * Cards move with the two chevrons rather than by dragging. Dragging on a
 * touch screen fights the page scroll, needs a long press to start, and has
 * no keyboard equivalent; two buttons are one tap, work the same on a Mac,
 * and are reachable by tab. Moving a card left or right writes a real date -
 * "Next week" becomes the Monday after this one, not the word.
 */
function Card({
  node,
  grade,
  onMove,
  onToggle,
  onOpen,
  canLeft,
  canRight,
}: {
  node: ResolvedNode;
  grade: Grade;
  onMove: (id: string, target: Grade) => void;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  canLeft: boolean;
  canRight: boolean;
}) {
  return (
    <div className={`bcard ${gradeClass(grade)}${node.done ? ' bcard-done' : ''}`}>
      <button type="button" className="bcard-body" onClick={() => onOpen(node.id)}>
        <span className="bcard-title">{node.title}</span>
        <span className="bcard-area">{node.area}</span>
      </button>
      <div className="bcard-controls">
        <button
          type="button"
          className="bcard-move"
          disabled={!canLeft}
          aria-label={`Move "${node.title}" to a nearer date`}
          onClick={() => onMove(node.id, prevGrade(grade))}
        >
          <Chevron dir="left" />
        </button>
        <button
          type="button"
          className="bcard-check"
          role="checkbox"
          aria-checked={node.done}
          aria-label={node.done ? `Mark "${node.title}" not done` : `Mark "${node.title}" done`}
          onClick={() => onToggle(node.id)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
            <path d="m3.5 8.5 3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="bcard-move"
          disabled={!canRight}
          aria-label={`Move "${node.title}" to a later date`}
          onClick={() => onMove(node.id, nextGrade(grade))}
        >
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d={dir === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The order cards move along. "Done" is reached by the check, not by sliding. */
const MOVE_ORDER: Grade[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later', 'someday'];

function prevGrade(grade: Grade): Grade {
  const i = MOVE_ORDER.indexOf(grade);
  return MOVE_ORDER[Math.max(0, i - 1)];
}

function nextGrade(grade: Grade): Grade {
  const i = MOVE_ORDER.indexOf(grade);
  return MOVE_ORDER[Math.min(MOVE_ORDER.length - 1, i + 1)];
}

export function Board({
  nodes,
  now,
  onPatch,
  onToggle,
  onOpen,
}: {
  nodes: ResolvedNode[];
  now: Date;
  onPatch: (id: string, fields: EditFields) => void;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const columns = boardColumns(nodes, now);

  function move(id: string, target: Grade) {
    if (target === 'done') {
      onToggle(id);
      return;
    }
    const due = dueForGrade(target, now);
    onPatch(id, { due: due === undefined ? null : due, done: false, doneAt: null });
  }

  return (
    <div className="board" role="list" aria-label="Board">
      {columns.map((column) => (
        <section key={column.grade} className={`board-col ${gradeClass(column.grade)}`} role="listitem">
          <header className="board-head">
            <GradeIcon grade={column.grade} size={14} />
            <h3 className="board-title">{column.label}</h3>
            <span className="board-count">{column.items.length}</span>
          </header>
          <div className="board-items">
            {column.items.length === 0 ? (
              <p className="board-empty">Empty</p>
            ) : (
              column.items.map((node) => {
                const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);
                const movable = grade !== 'done';
                return (
                  <Card
                    key={node.id}
                    node={node}
                    grade={grade}
                    onMove={move}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    canLeft={movable && grade !== MOVE_ORDER[0]}
                    canRight={movable && grade !== MOVE_ORDER[MOVE_ORDER.length - 1]}
                  />
                );
              })
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Column labels for the legend under the board, so the colours are named once on the page. */
export const BOARD_LEGEND = MOVE_ORDER.map((grade) => ({ grade, label: GRADE_META[grade].label }));
