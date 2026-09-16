import { useEffect, useRef, useState } from 'react';
import { BOARD_GRADES, GRADE_META, gradeOf, type Grade } from '../lib/grade';
import { dueForGrade } from '../lib/board';
import type { EditFields } from '../lib/edits';
import type { ResolvedNode } from '../lib/live';
import { GradeIcon } from './GradeIcon';

/**
 * The editor. A native <dialog> so the browser handles the focus trap, the
 * backdrop and the Escape key rather than a hand-rolled modal that gets one of
 * those wrong. On a phone it sits at the bottom, inside the safe area, where a
 * thumb already is.
 *
 * Dates are set two ways and both write the same absolute ISO string: the
 * "when" row for the common case (a tap), and the date field for a specific
 * day. There is no relative word stored anywhere - "Tomorrow" resolves to a
 * real date the moment it is tapped, so it does not quietly mean something
 * different next week.
 */
export function EditSheet({
  node,
  now,
  onSave,
  onRevert,
  onClose,
}: {
  node: ResolvedNode;
  now: Date;
  onSave: (id: string, fields: EditFields) => void;
  onRevert: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(node.title);
  const [detail, setDetail] = useState(node.detail ?? '');
  const [due, setDue] = useState(node.due ?? '');
  const [note, setNote] = useState(node.note ?? '');
  const [done, setDone] = useState(node.done);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const grade = gradeOf({ due: due || undefined, horizon: node.horizon, done }, now);

  function setWhen(target: Grade) {
    if (target === 'done') {
      setDone(true);
      return;
    }
    const next = dueForGrade(target, now);
    setDue(next === null || next === undefined ? '' : next);
    setDone(false);
  }

  function handleSave() {
    const trimmedTitle = title.trim();
    onSave(node.id, {
      title: trimmedTitle.length > 0 ? trimmedTitle : node.title,
      detail: detail.trim(),
      due: due ? due : null,
      note: note.trim(),
      done,
      doneAt: done ? (node.doneAt ?? new Date().toISOString()) : null,
    });
    onClose();
  }

  function handleArchive() {
    onSave(node.id, { archived: true });
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose} onCancel={onClose} aria-label="Edit item">
      <form method="dialog" className="sheet-form" onSubmit={(e) => e.preventDefault()}>
        <div className="sheet-grab" aria-hidden="true" />

        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoCapitalize="sentences"
            autoCorrect="on"
            enterKeyHint="done"
          />
        </label>

        <label className="field">
          <span className="field-label">Detail</span>
          <textarea
            className="field-input field-textarea"
            rows={2}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Dictate or type"
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
          />
        </label>

        <div className="field">
          <span className="field-label">When</span>
          <div className="when-row" role="group" aria-label="When">
            {BOARD_GRADES.filter((g) => g !== 'done').map((g) => (
              <button
                key={g}
                type="button"
                className={`when-item grade-${g}${grade === g ? ' active' : ''}`}
                aria-pressed={grade === g}
                onClick={() => setWhen(g)}
              >
                <GradeIcon grade={g} size={13} />
                {GRADE_META[g].short}
              </button>
            ))}
            <button
              type="button"
              className="when-item grade-someday"
              aria-pressed={grade === 'someday'}
              onClick={() => {
                setDue('');
                setDone(false);
              }}
            >
              <GradeIcon grade="someday" size={13} />
              {GRADE_META.someday.short}
            </button>
          </div>
          <input
            className="field-input field-date"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Exact date"
          />
        </div>

        <label className="field field-inline">
          <input type="checkbox" className="field-checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
          <span className="field-label">Done</span>
        </label>

        <label className="field">
          <span className="field-label">Note</span>
          <textarea
            className="field-input field-textarea"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you want to remember about this"
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
          />
        </label>

        <div className="sheet-actions">
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="sheet-actions sheet-actions-quiet">
          <button type="button" className="btn btn-quiet" onClick={handleArchive}>
            Hide this
          </button>
          {node.edited && !node.created ? (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                onRevert(node.id);
                onClose();
              }}
            >
              Undo my changes
            </button>
          ) : null}
        </div>
      </form>
    </dialog>
  );
}
