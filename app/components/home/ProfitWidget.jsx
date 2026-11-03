import { Widget, WidgetNote, gbp } from "./Widget";
import { prisma } from "@/lib/prisma";
import { revenueByMonth } from "@/lib/campaigns";

// Revenue against cost, month by month: what the incubator earns from booked
// campaigns (the Campaigns tab's payments) less what it spends (the same
// fleetCosts() figures as the Spend widget and the Group costs page).
//
// Revenue for a month is every instalment that landed in it plus every one
// still due in it, so a month's figure is what it should bring in; the
// received part is shown separately so a late payer is visible. The current
// month's cost is the on-pace projection, and the forecast months reuse it,
// because there is no better estimate of next month's spend than this one's.
//
// Layout (JB, 3 Nov 2026): the month's profit as the headline, then the chart
// with numbers on hover rather than a figure under every column.

// The incubator's books start on 1 Nov 2026 (JB, 3 Nov): spend before then
// was set-up, not trading, so it is left off rather than shown as losses.
const START_MONTH = "2026-11";
// Columns on the chart: the months since the start, topped up with forecast
// months, never fewer than three of those.
const COLUMNS = 6;
const MIN_FORECAST = 3;
const startLabel = new Date(`${START_MONTH}-01T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 15));
  return d.toISOString().slice(0, 7);
}
const monthName = (ym, style = "short") => new Date(`${ym}-15T12:00:00Z`).toLocaleString("en-GB", { month: style, timeZone: "UTC" });
const signed = (v) => (v < 0 ? `−${gbp(-v)}` : gbp(v));
// Compact axis labels: £1.5k rather than £1,500.
const axis = (v) => (v >= 1000 ? `£${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `£${Math.round(v)}`);

/** The smallest round number at or above v, so gridlines land on £500, £1k, £2.5k. */
function niceCeil(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((s) => s * p).find((s) => s >= v);
}

export default async function ProfitWidget({ costs }) {
  const props = { span: 12, title: "Revenue, costs and profit", href: "/campaigns", linkLabel: "Open campaigns" };
  if (!costs) {
    return (
      <Widget {...props}>
        <WidgetNote>Costs couldn&apos;t be read just now, so profit can&apos;t be worked out.</WidgetNote>
      </Widget>
    );
  }

  let revenue;
  try {
    revenue = await revenueByMonth(prisma);
  } catch {
    return (
      <Widget {...props}>
        <WidgetNote>Campaign payments couldn&apos;t be read just now.</WidgetNote>
      </Widget>
    );
  }

  const rate = costs.rate;
  const revBy = new Map(revenue.map((r) => [r.month, r]));
  const current = costs.months.at(-1)?.key || new Date().toISOString().slice(0, 7);
  const projectedCost = costs.totals.projectedUsd * rate;
  // What has actually gone out so far this month (JB, 3 Nov: the projection
  // alone read as if it were already spent).
  const spentNow = costs.totals.thisUsd * rate;

  const actual = costs.months.filter((m) => m.key >= START_MONTH);
  const forecastMonths = Math.max(MIN_FORECAST, COLUMNS - actual.length);
  const rows = [
    ...actual.map((m) =>
      m.key === current
        ? { key: m.key, cost: projectedCost, spent: Math.min(spentNow, projectedCost), forecast: false }
        : { key: m.key, cost: m.usd * rate, spent: m.usd * rate, forecast: false }
    ),
    ...Array.from({ length: forecastMonths }, (_, i) => ({ key: addMonths(current, i + 1), cost: projectedCost, spent: 0, forecast: true })),
  ].map((r) => {
    const rv = revBy.get(r.key);
    const paid = (rv?.paidPence || 0) / 100;
    const due = (rv?.expectedPence || 0) / 100;
    return { ...r, paid, due, revenue: paid + due, profit: paid + due - r.cost };
  });

  const now = rows.find((r) => r.key === current);
  const past = rows.filter((r) => !r.forecast);
  const totalRev = past.reduce((s, r) => s + r.revenue, 0);
  const totalCost = past.reduce((s, r) => s + r.cost, 0);
  const ahead = rows.filter((r) => r.forecast);
  const bookedAhead = revenue.filter((r) => r.month > current).reduce((s, r) => s + r.expectedPence, 0) / 100;
  const forecastProfit = ahead.reduce((s, r) => s + r.profit, 0);

  const top = niceCeil(Math.max(...rows.flatMap((r) => [r.revenue, r.cost])));
  const grid = [1, 0.5, 0].map((f) => top * f);
  const pct = (v) => `${Math.max(0, (v / top) * 100)}%`;

  const inProfit = now.profit >= 0;
  const margin = now.revenue > 0 ? Math.round((now.profit / now.revenue) * 100) : null;
  const daysPct = Math.min(1, costs.month.daysElapsed / costs.month.daysInMonth);
  const profitSoFar = now.paid - spentNow;

  return (
    <Widget {...props} sub="Campaign payments from the Advertising tab, against fleet spend">
      <div className="pl">
        {/* ---------------- the month in numbers */}
        <div className="pl-side">
          <div className="pl-hero">
            <span className="pl-eyebrow">Projected profit, {monthName(current, "long")}</span>
            <span className="pl-hero-value num">{signed(now.profit)}</span>
            <span className={`pl-status ${inProfit ? "is-up" : "is-down"}`}>
              <span aria-hidden="true">{inProfit ? "▲" : "▼"}</span>
              {inProfit ? "On course for a profit" : "On course for a loss"}
              {margin != null && ` · ${margin}% margin`}
            </span>
            <span className="pl-note">
              So far: {gbp(now.paid)} in, {gbp(spentNow)} out, <b className="num pl-sofar">{signed(profitSoFar)}</b>
            </span>
          </div>

          <div className="pl-line">
            <div className="pl-line-head">
              <span><i className="pl-dot pl-rev" /> Revenue</span>
              <b className="num">{gbp(now.revenue)}</b>
            </div>
            <div className="pl-meter" aria-hidden="true">
              <span className="pl-rev" style={{ width: now.revenue ? `${(now.paid / now.revenue) * 100}%` : 0 }} />
            </div>
            <span className="pl-note">
              {!now.revenue ? "Nothing due this month yet" : now.due ? `${gbp(now.paid)} received, ${gbp(now.due)} to come` : "All received"}
            </span>
          </div>

          <div className="pl-line">
            <div className="pl-line-head">
              <span><i className="pl-dot pl-cost" /> Costs</span>
              <b className="num">
                {gbp(spentNow)} <span className="pl-of">of {gbp(projectedCost)}</span>
              </b>
            </div>
            <div className="pl-meter" aria-hidden="true">
              <span className="pl-cost" style={{ width: `${projectedCost ? Math.min(100, (spentNow / projectedCost) * 100) : 0}%` }} />
            </div>
            <span className="pl-note">
              {gbp(spentNow)} spent so far, on pace for {gbp(projectedCost)} by month end ({Math.round(daysPct * 100)}% of the month gone)
            </span>
          </div>

          <div className="pl-mini">
            <div>
              <span className="pl-note">Booked ahead</span>
              <b className="num">{gbp(bookedAhead)}</b>
            </div>
            <div>
              <span className="pl-note">{past.length > 1 ? `Since ${startLabel}` : `Next ${ahead.length} months`}</span>
              <b className="num">{signed(past.length > 1 ? totalRev - totalCost : forecastProfit)}</b>
            </div>
          </div>
        </div>

        {/* ---------------- month by month */}
        <div className="pl-chart">
          <div className="pl-legend">
            <span><i className="pl-dot pl-rev" /> Revenue</span>
            <span><i className="pl-dot pl-cost" /> Costs</span>
            <span className="pl-note">Solid is actual, faint is still to come · hover for figures</span>
          </div>
          <div className="pl-plot" role="table" aria-label="Revenue and costs by month">
            <div className="pl-grid" aria-hidden="true">
              {grid.map((g) => (
                <div key={g} style={{ bottom: pct(g) }}>
                  <span>{axis(g)}</span>
                </div>
              ))}
            </div>
            <div className="pl-cols">
              {rows.map((r, i) => (
                <div
                  key={r.key}
                  role="row"
                  tabIndex={0}
                  className={`pl-col${r.forecast ? " is-forecast" : ""}${r.key === current ? " is-now" : ""}${i === past.length ? " is-first-forecast" : ""}`}
                >
                  {i === past.length && <span className="pl-forecast-tag" aria-hidden="true">Forecast</span>}
                  <div className="pl-bars">
                    <span className="pl-bar pl-rev-due" style={{ height: pct(r.revenue) }}>
                      {r.paid > 0 && <i className="pl-rev" style={{ height: `${(r.paid / r.revenue) * 100}%` }} />}
                    </span>
                    {/* Solid is spent, faint is still to come: only the current month has both. */}
                    <span className="pl-bar pl-cost-due" style={{ height: pct(r.cost) }}>
                      {r.spent > 0 && <i className="pl-cost" style={{ height: `${(r.spent / r.cost) * 100}%` }} />}
                    </span>
                  </div>
                  <span role="cell" className="pl-month">
                    {monthName(r.key)}
                    {r.forecast && <small>est.</small>}
                  </span>
                  <div className="pl-tip" role="cell">
                    <strong>
                      {monthName(r.key, "long")} {r.key.slice(0, 4)}
                      {r.forecast ? " (forecast)" : ""}
                    </strong>
                    <span><i className="pl-dot pl-rev" /> Revenue <b className="num">{gbp(r.revenue)}</b></span>
                    {r.due > 0 && r.paid > 0 && <span className="pl-tip-sub">{gbp(r.paid)} received</span>}
                    <span>
                      <i className="pl-dot pl-cost" /> {r.key === current ? "Costs, projected" : r.forecast ? "Costs, estimated" : "Costs"}{" "}
                      <b className="num">{gbp(r.cost)}</b>
                    </span>
                    {r.key === current && <span className="pl-tip-sub">{gbp(r.spent)} spent so far</span>}
                    <span className="pl-tip-total">
                      {r.key === current || r.forecast ? "Profit, projected" : "Profit"} <b className="num">{signed(r.profit)}</b>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Widget>
  );
}
