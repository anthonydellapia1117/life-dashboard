import { useMemo } from 'react';
import type { LifeData } from '../types';
import { computeAreaBreakdown, computeBalanceTotals } from '../lib/balance';
import { groupUpcoming } from '../lib/grouping';
import { compareByGrade, gradeOf, isPressing } from '../lib/grade';
import type { Live } from '../lib/live';
import { countNodes } from '../lib/progress';
import { TRACK_META, partitionByTrack } from '../lib/track';
import { Agenda } from '../components/Agenda';
import { Alerts } from '../components/Alerts';
import { Balance } from '../components/Balance';
import { Capture } from '../components/Capture';
import { Disclosure } from '../components/Disclosure';
import { KpiStrip } from '../components/KpiStrip';
import { NodeList } from '../components/NodeRow';
import { GradeDistribution, ProgressBar } from '../components/Progress';

/**
 * Today answers one question: what do I do next.
 *
 * Everything on this screen now reads from the resolved list (base data plus
 * your edits), so the hero figure is a live count that drops the moment you
 * check something off rather than a number baked into the data file.
 *
 * Focus holds three items and no more. The whole point of a ranking is that
 * it ends - a list of everything, sorted, is still a list of everything.
 *
 * Focus and the hero figure draw only from what is YOURS (src/lib/track.ts):
 * something you are waiting on, or that may already be done, or that has sat
 * there since last year, is not work you can do next. Those get their own
 * sections below, in that order, so none of them is lost and none of them
 * competes with the three things that actually move.
 */
export function Today({
  data,
  cryptoKey,
  salt,
  live,
  now,
  onOpen,
}: {
  data: LifeData;
  cryptoKey: CryptoKey | undefined;
  salt: string;
  live: Live;
  now: Date;
  onOpen: (id: string) => void;
}) {
  const calendar = data.calendar ?? [];

  // Actionable items only: a repo's visibility or a tool's row is reference,
  // not something you finish, and padding Today with those would bury the work.
  const actionable = useMemo(
    () => live.nodes.filter((n) => n.kind === 'action' || n.kind === 'milestone' || n.kind === 'payment'),
    [live.nodes],
  );

  const open = useMemo(
    () => actionable.filter((n) => !n.done).sort((a, b) => compareByGrade(a, b, now)),
    [actionable, now],
  );
  const { mine, tracks } = useMemo(() => partitionByTrack(open), [open]);
  const focus = mine.slice(0, 3);
  const rest = mine.slice(3);
  const done = useMemo(() => actionable.filter((n) => n.done), [actionable]);

  const pressing = mine.filter((n) => isPressing(gradeOf({ due: n.due, horizon: n.horizon, done: false }, now))).length;
  const counts = countNodes(actionable);

  // Every slice that carries actions, not just the top-level list - the UNICO
  // and Work items live in their own slices and Balance has to see them too.
  const allActions = useMemo(
    () => [...(data.actions ?? []), ...(data.work?.actionItems ?? []), ...(data.unico?.actionItems ?? [])],
    [data.actions, data.work?.actionItems, data.unico?.actionItems],
  );

  const days = groupUpcoming(calendar, now, 14);
  const totals = computeBalanceTotals(allActions, calendar, now, 14);
  const areas = computeAreaBreakdown(allActions);

  return (
    <div className="tab-page today-page">
      <Capture cryptoKey={cryptoKey} salt={salt} captureEmail={data.meta.captureEmail} />

      <div className="today-grid">
        <div className="today-main">
          <section className="hero" aria-label="Summary">
            <div className="hero-eyebrow">To do now</div>
            <div className="hero-figure">{pressing}</div>
            <div className="hero-sub">
              <strong>{counts.done}</strong> of {counts.total} finished. {counts.left} still open.
            </div>
            <ProgressBar counts={counts} bare />
          </section>

          <GradeDistribution nodes={actionable} now={now} title="Where everything sits" />

          <section aria-label="Focus">
            <h2 className="section-heading">Focus</h2>
            <p className="caption">The three most urgent. Tap the box to finish one, the row to change it.</p>
            <NodeList
              nodes={focus}
              now={now}
              onToggle={live.toggleDone}
              onOpen={onOpen}
              empty="Nothing open. That is the whole list, not a loading state."
              cards
            />
          </section>

          <section aria-label="Up next">
            <h2 className="section-heading">Up next</h2>
            <NodeList nodes={rest} now={now} onToggle={live.toggleDone} onOpen={onOpen} empty="Nothing behind Focus." />
          </section>

          {tracks.map(({ track, items }) => (
            <section aria-label={TRACK_META[track].heading} key={track}>
              <h2 className="section-heading">
                {TRACK_META[track].heading} <span className="section-count">{items.length}</span>
              </h2>
              <p className="caption">{TRACK_META[track].caption}</p>
              <NodeList nodes={items} now={now} onToggle={live.toggleDone} onOpen={onOpen} />
            </section>
          ))}

          {done.length > 0 ? (
            <Disclosure summary={`${done.length} done`}>
              <NodeList nodes={done} now={now} onToggle={live.toggleDone} onOpen={onOpen} />
            </Disclosure>
          ) : null}
        </div>

        <div className="today-side">
          <section aria-label="Alerts">
            <h2 className="section-heading">Alerts</h2>
            <Alerts alerts={data.alerts} folded />
          </section>

          <section aria-label="Next 14 days">
            <h2 className="section-heading">Next 14 days</h2>
            <Agenda days={days} />
          </section>

          <section aria-label="Balance">
            <h2 className="section-heading">Balance</h2>
            <Balance totals={totals} areas={areas} />
          </section>
        </div>
      </div>

      <section aria-label="Snapshot">
        <h2 className="section-heading">Snapshot</h2>
        <KpiStrip kpis={data.kpis} />
      </section>
    </div>
  );
}
