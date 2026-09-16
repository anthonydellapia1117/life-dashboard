import { useMemo } from 'react';
import { completionsByDay, countNodes } from '../lib/progress';
import { levelFor, momentumFrom, streakFrom, xpFor } from '../lib/game';
import { gradeOf } from '../lib/grade';
import type { ResolvedNode } from '../lib/live';
import { ProgressBar, ProgressRing } from './Progress';

/**
 * Progress over time - the part that makes finishing things feel like it adds
 * up rather than evaporating.
 *
 * The scoring is deliberately not "one point per item". An item is worth what
 * it was worth when you finished it: clearing something overdue scores twelve,
 * clearing something with no date scores one. Otherwise the cheapest way to
 * score is to do the easy things, which is precisely the habit a dashboard
 * should not be paying for.
 *
 * Every figure here comes from real completions in the edit overlay. Nothing
 * is seeded and nothing is estimated, so an empty history reads as zero and
 * says so, rather than inventing a streak that was never earned.
 */
export function Momentum({ nodes, now, days = 28 }: { nodes: ResolvedNode[]; now: Date; days?: number }) {
  const history = useMemo(() => completionsByDay(nodes, days, now), [nodes, days, now]);
  const streak = useMemo(() => streakFrom(history, now), [history, now]);
  const momentum = useMemo(() => momentumFrom(history, now), [history, now]);

  const totalXp = useMemo(
    () =>
      nodes
        .filter((n) => n.done && n.doneAt)
        .reduce((sum, n) => sum + xpFor(gradeOf({ due: n.due, horizon: n.horizon, done: false }, now)), 0),
    [nodes, now],
  );
  const level = useMemo(() => levelFor(totalXp), [totalXp]);
  const counts = useMemo(() => countNodes(nodes), [nodes]);

  const peak = Math.max(1, ...history.map((d) => d.count));
  const everFinished = history.some((d) => d.count > 0);

  return (
    <div className="momentum">
      <section className="momentum-hero hero" aria-label="Streak">
        <div className="hero-eyebrow">Days in a row</div>
        <div className="hero-figure">{streak.current}</div>
        <div className="hero-sub">
          {everFinished
            ? `Longest ${streak.longest}. ${momentum.thisWeek} done this week, ${momentum.lastWeek} the week before.`
            : 'Check something off and this starts counting.'}
        </div>
      </section>

      <div className="momentum-grid">
        <section className="momentum-card" aria-label="Level">
          <ProgressRing counts={{ total: 100, done: level.pct, left: 100 - level.pct, pct: level.pct }} size={84} />
          <div className="momentum-card-body">
            <div className="momentum-card-value">Level {level.level}</div>
            <div className="momentum-card-label">{level.title}</div>
            <div className="momentum-card-sub">
              {level.xpIntoLevel} of {level.xpForNextLevel} to the next one
            </div>
          </div>
        </section>

        <section className="momentum-card" aria-label="Trend">
          <div className="momentum-card-body">
            <div className="momentum-card-value">
              {momentum.delta > 0 ? '+' : ''}
              {momentum.delta}
            </div>
            <div className="momentum-card-label">
              {momentum.trend === 'up' ? 'Ahead of last week' : momentum.trend === 'down' ? 'Behind last week' : 'Level with last week'}
            </div>
            <div className="momentum-card-sub">Seven days against the seven before.</div>
          </div>
        </section>
      </div>

      <section aria-label="Last four weeks">
        <h3 className="section-heading">Last {days} days</h3>
        <div className="spark" role="img" aria-label={`Completions per day over ${days} days, highest ${peak}`}>
          {history.map((day) => (
            <div key={day.date} className="spark-col" title={`${day.date}: ${day.count}`}>
              <div
                className={`spark-bar${day.count === 0 ? ' spark-zero' : ''}`}
                style={{ height: `${Math.max(3, Math.round((day.count / peak) * 100))}%` }}
              />
            </div>
          ))}
        </div>
        <p className="caption">
          One bar per day, tallest is {peak}. Days you finished nothing stay visible as a floor, not a gap.
        </p>
      </section>

      <section aria-label="Everything">
        <h3 className="section-heading">Everything</h3>
        <ProgressBar counts={counts} label="All items" />
      </section>
    </div>
  );
}
