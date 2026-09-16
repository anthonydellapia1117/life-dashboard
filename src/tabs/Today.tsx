import type { LifeData } from '../types';
import { computeAreaBreakdown, computeBalanceTotals } from '../lib/balance';
import { groupUpcoming } from '../lib/grouping';
import { focusActions, heroCounts, upNextGroups } from '../lib/priority';
import { Agenda } from '../components/Agenda';
import { Alerts } from '../components/Alerts';
import { Balance } from '../components/Balance';
import { Capture } from '../components/Capture';
import { FocusList } from '../components/FocusList';
import { KpiStrip } from '../components/KpiStrip';
import { UpNext } from '../components/UpNext';

/** Today answers one question: what do I do next. */
export function Today({
  data,
  cryptoKey,
  salt,
}: {
  data: LifeData;
  cryptoKey: CryptoKey | undefined;
  salt: string;
}) {
  const today = new Date();
  const actions = data.actions ?? [];
  const calendar = data.calendar ?? [];

  const focus = focusActions(actions, today, 3);
  const { thisWeek, later } = upNextGroups(actions, focus);
  const hero = heroCounts(actions);
  const days = groupUpcoming(calendar, today, 14);
  const totals = computeBalanceTotals(actions, calendar, today, 14);
  const areas = computeAreaBreakdown(actions);

  return (
    <div className="tab-page today-page">
      <Capture cryptoKey={cryptoKey} salt={salt} captureEmail={data.meta.captureEmail} />

      <div className="today-grid">
        <div className="today-main">
          <section className="hero" aria-label="Summary">
            <div className="hero-value">{hero.now} to do now</div>
            <div className="hero-sub">
              {hero.thisWeek} this week, {hero.open} open
            </div>
          </section>

          <section aria-label="Focus">
            <h2 className="section-heading">Focus</h2>
            <p className="caption">Ranked by horizon and days to due.</p>
            <FocusList actions={focus} today={today} />
          </section>

          <section aria-label="Up next">
            <h2 className="section-heading">Up next</h2>
            <UpNext thisWeek={thisWeek} later={later} />
          </section>
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
