import type { LifeData } from '../types';
import type { ResolvedNode } from '../lib/live';

/**
 * Claude tab (route #claude) - a placeholder seam for the next build.
 *
 * Contract for whoever fills it in:
 *   - App.tsx renders <ClaudeTab data nodes now onOpen /> when route.zone is
 *     'claude'. `data` is the decrypted LifeData (add a typed slice to
 *     src/types.ts and data/life.json, or a sibling data/*.json that
 *     scripts/seal.mjs folds in, the way data/lifeos.json is). `nodes` are
 *     the resolved items (base plus edits). `onOpen(id)` opens the editor.
 *   - Put data-bucket={1..6} on every row, card or chip. The global filter
 *     (src/lib/filter.ts, installFilterDom) then dims and rings them with no
 *     extra wiring; canvas views read useBucketFilter() instead.
 *   - Never fetch plaintext from the network: there is no server, and the
 *     only data on the public site is the sealed blob.
 */
export function ClaudeTab({
  nodes,
}: {
  data: LifeData;
  nodes: ResolvedNode[];
  now: Date;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="tab-page claude-page">
      <section className="group group-pad" aria-label="Claude">
        <h2 className="title3">Nothing here yet</h2>
        <p className="subhead">
          This tab is where Claude work will show up next. {nodes.length} items are ready for it.
        </p>
      </section>
    </div>
  );
}
