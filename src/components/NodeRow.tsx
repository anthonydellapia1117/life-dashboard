import { gradeOf } from '../lib/grade';
import type { ResolvedNode } from '../lib/live';
import { GradeChip } from './GradeIcon';

/**
 * One item, anywhere in the app. Two targets, both a full 44px tall: the box
 * on the left checks it off in place, the rest of the row opens the editor.
 * The check is the fast path - the whole point is that finishing something is
 * one tap, and the counters above move the moment you do it.
 */
export function NodeRow({
  node,
  now,
  onToggle,
  onOpen,
  showArea = true,
}: {
  node: ResolvedNode;
  now: Date;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  showArea?: boolean;
}) {
  const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);

  return (
    <div className={`node-row${node.done ? ' node-done' : ''}`}>
      <button
        type="button"
        className="node-check"
        role="checkbox"
        aria-checked={node.done}
        aria-label={node.done ? `Mark "${node.title}" not done` : `Mark "${node.title}" done`}
        onClick={() => onToggle(node.id)}
      >
        <span className="node-check-box">
          {node.done ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
              <path d="m3.5 8.5 3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      </button>

      <button type="button" className="node-body" onClick={() => onOpen(node.id)}>
        <span className="node-title">{node.title}</span>
        {node.detail ? <span className="node-detail">{node.detail}</span> : null}
        <span className="node-meta">
          <GradeChip grade={grade} short />
          {showArea ? <span className="node-area">{node.area}</span> : null}
          {node.note ? <span className="node-note-flag">Note</span> : null}
          {node.edited ? <span className="node-edited">Edited</span> : null}
        </span>
      </button>
    </div>
  );
}

/** A list of rows with a quiet empty state, since every slice here can legitimately be empty. */
export function NodeList({
  nodes,
  now,
  onToggle,
  onOpen,
  empty = 'Nothing here.',
  showArea = true,
  cards = false,
}: {
  nodes: ResolvedNode[];
  now: Date;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  empty?: string;
  showArea?: boolean;
  /** Each item as its own card instead of rows sharing one container - for the short lists that matter most. */
  cards?: boolean;
}) {
  if (nodes.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className={cards ? 'node-list node-list-cards' : 'node-list'}>
      {nodes.map((node) => (
        <NodeRow key={node.id} node={node} now={now} onToggle={onToggle} onOpen={onOpen} showArea={showArea} />
      ))}
    </div>
  );
}
