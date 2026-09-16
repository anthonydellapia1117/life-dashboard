import { useMemo } from 'react';
import { compareByGrade } from '../lib/grade';
import type { ResolvedNode } from '../lib/live';
import { countNodes } from '../lib/progress';
import { GradeDistribution, ProgressBar } from './Progress';
import { NodeList } from './NodeRow';
import { Disclosure } from './Disclosure';

/**
 * The strip every section page now opens with: how much of this part of life
 * is done, where the rest of it sits in time, and the items themselves as
 * things you can check off rather than rows you can only read.
 *
 * It sits above each tab's own tables instead of replacing them. The tables
 * carry detail that is specific to their slice - amounts, roles, statuses -
 * and flattening all of that into one generic list would lose the reason
 * those pages exist. This adds the two things every page was missing: a
 * count that moves, and a tap that does something.
 */
export function SectionOverview({
  title,
  nodes,
  now,
  onToggle,
  onOpen,
}: {
  title: string;
  nodes: ResolvedNode[];
  now: Date;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const counts = useMemo(() => countNodes(nodes), [nodes]);
  const sorted = useMemo(() => [...nodes].sort((a, b) => compareByGrade(a, b, now)), [nodes, now]);
  const open = useMemo(() => sorted.filter((n) => !n.done), [sorted]);
  const done = useMemo(() => sorted.filter((n) => n.done), [sorted]);

  if (nodes.length === 0) return null;

  return (
    <section className="overview" aria-label={`${title} progress`}>
      <ProgressBar counts={counts} label={title} />
      <GradeDistribution nodes={nodes} now={now} />
      <NodeList
        nodes={open}
        now={now}
        onToggle={onToggle}
        onOpen={onOpen}
        empty="All clear here."
        showArea={false}
      />
      {done.length > 0 ? (
        <Disclosure summary={`${done.length} done`}>
          <NodeList nodes={done} now={now} onToggle={onToggle} onOpen={onOpen} showArea={false} />
        </Disclosure>
      ) : null}
    </section>
  );
}
