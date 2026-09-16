import { useMemo } from 'react';
import type { LifeData } from '../types';
import { computeAreaBreakdown, computeBalanceTotals } from '../lib/balance';
import { groupUpcoming } from '../lib/grouping';
import { compareByGrade, gradeOf, isPressing } from '../lib/grade';
import type { Live } from '../lib/live';
import { countNodes } from '../lib/progress';
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
  const focus = open.slice(0, 3);
  const rest = open.slice(3);
  const done = useMemo(() => actionable.filter((n) => n.done), [actionable]);

  const pressing = open.filter((n) => isPressing(gradeOf({ due: n.due, horizon: n.horizon, done: false }, now))).length;
  const counts = countNodes(actionable);

  const days = groupUpcoming(calendar, now, 14);
  const totals = computeBalanceTotals(data.actions ?? [], calendar, now, 14);
  const areas = computeAreaBreakdown(data.actions ?? []);

  return (
    <div className="tab-page today-page">
      <Capture cryptoKey={cryptoKey} salt={salt} captureEmail={data.meta.captureEmail} />

      <div className="today-grid">
        <div className="today-main">
          <section className="hero" aria-label="Summary">
            <div className="hero-value">{pressing} to do now</div>
            <div className="hero-sub">
              {counts.done} of {counts.total} done, {counts.left} left
            </div>
          </section>

          <ProgressBar counts={counts} />
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
            />
          </section>

          <section aria-label="Up next">
            <h2 className="section-heading">Up next</h2>
            <NodeList nodes={rest} now={now} onToggle={live.toggleDone} onOpen={onOpen} empty="Nothing behind Focus." />
          </section>

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
