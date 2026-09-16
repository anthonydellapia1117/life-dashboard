import { useMemo, useState } from 'react';
import type { SectionId } from '../lib/routing';
import type { EditFields } from '../lib/edits';
import type { ResolvedNode } from '../lib/live';
import { Board } from '../components/Board';
import { Brain } from '../components/Brain';
import { Momentum } from '../components/Momentum';
import { Roadmap } from '../components/Roadmap';
import { GradeDistribution, ProgressBar } from '../components/Progress';
import { countNodes, countsByArea } from '../lib/progress';

/**
 * Map - the same items as everywhere else, seen four ways.
 *
 * Nothing here is a separate copy of the data. The board, the roadmap, the
 * graph and the progress view all read the one resolved list, so checking
 * something off in any of them moves every number on all four.
 *
 * The filter row sits above the view rather than inside it: a filter that
 * only applies to one visualisation is a filter you have to set again every
 * time you switch, and then stop trusting.
 */
export function MapTab({
  section,
  nodes,
  now,
  onPatch,
  onToggle,
  onOpen,
}: {
  section: SectionId | undefined;
  nodes: ResolvedNode[];
  now: Date;
  onPatch: (id: string, fields: EditFields) => void;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [area, setArea] = useState<string>('all');
  const [hideDone, setHideDone] = useState(false);

  const areas = useMemo(() => [...countsByArea(nodes).keys()].sort(), [nodes]);
  const filtered = useMemo(
    () => nodes.filter((n) => (area === 'all' || n.area === area) && (!hideDone || !n.done)),
    [nodes, area, hideDone],
  );
  const counts = useMemo(() => countNodes(filtered), [filtered]);

  return (
    <div className="tab-page map-page">
      <div className="filters" role="group" aria-label="Filters">
        <label className="filter">
          <span className="filter-label">Area</span>
          <select className="filter-select" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">Everything</option>
            {areas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter filter-check">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          <span className="filter-label">Hide done</span>
        </label>
        <span className="filter-count">{filtered.length} shown</span>
      </div>

      {section === 'progress' ? (
        <Momentum nodes={nodes} now={now} />
      ) : (
        <>
          <ProgressBar counts={counts} label={area === 'all' ? 'Everything' : area} />
          <GradeDistribution nodes={filtered} now={now} title="Where it all sits" />
          {section === 'roadmap' ? (
            <Roadmap nodes={filtered} now={now} onOpen={onOpen} onToggle={onToggle} />
          ) : section === 'brain' ? (
            <Brain nodes={filtered} now={now} onOpen={onOpen} />
          ) : (
            <Board nodes={filtered} now={now} onPatch={onPatch} onToggle={onToggle} onOpen={onOpen} />
          )}
        </>
      )}
    </div>
  );
}
