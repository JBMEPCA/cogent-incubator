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

const FORECAST_MONTHS = 3;

function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 15));
  return d.toISOString().slice(0, 7);
}
const shortMonth = (ym) => new Date(`${ym}-15T12:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
const signed = (v) => (v < 0 ? `−${gbp(-v)}` : gbp(v));

export default async function ProfitWidget({ costs }) {
  const title = "Revenue, costs and profit";
  const props = { span: 12, title, href: "/campaigns", linkLabel: "Open campaigns" };
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

  const rows = [
    ...costs.months.map((m) => ({
      key: m.key,
      cost: m.key === current ? projectedCost : m.usd * rate,
      forecast: false,
    })),
    ...Array.from({ length: FORECAST_MONTHS }, (_, i) => ({ key: addMonths(current, i + 1), cost: projectedCost, forecast: true })),
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
  const booked = revenue.filter((r) => r.month > current).reduce((s, r) => s + r.expectedPence, 0) / 100;
  const max = Math.max(1, ...rows.flatMap((r) => [r.revenue, r.cost]));
  const tone = (v) => (v > 0 ? "var(--neon-green)" : v < 0 ? "var(--neon-red)" : "var(--muted)");

  const tiles = [
    { label: `Revenue, ${shortMonth(current)}`, value: gbp(now.revenue), sub: !now.revenue ? "nothing due this month" : now.due ? `${gbp(now.paid)} received so far` : "all received" },
    { label: `Costs, ${shortMonth(current)}`, value: gbp(now.cost), sub: "on pace for month end" },
    { label: `Profit, ${shortMonth(current)}`, value: signed(now.profit), sub: "if everything due is paid", color: tone(now.profit) },
    {
      label: `Profit, last ${past.length} months`,
      value: signed(totalRev - totalCost),
      sub: `${gbp(totalRev)} in, ${gbp(totalCost)} out`,
      color: tone(totalRev - totalCost),
    },
  ];

  return (
    <Widget {...props} sub="Campaign payments from the Advertising tab, against fleet spend">
      <div className="dw-pl-tiles">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className="dw-pl-label">{t.label}</div>
            <div className="dw-pl-value num" style={t.color ? { color: t.color } : undefined}>
              {t.value}
            </div>
            <div className="dw-pl-sub">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="dw-pl-chart" role="table" aria-label="Revenue and costs by month">
        {rows.map((r) => (
          <div
            key={r.key}
            role="row"
            className={`dw-pl-col${r.forecast ? " is-forecast" : ""}${r.key === current ? " is-now" : ""}`}
            title={`${shortMonth(r.key)}: revenue ${gbp(r.revenue)}${r.due ? ` (${gbp(r.due)} not yet received)` : ""}, costs ${gbp(r.cost)}${r.forecast ? " (estimate)" : ""}, profit ${signed(r.profit)}`}
          >
            <div className="dw-pl-bars" aria-hidden="true">
              <span className="dw-pl-bar dw-pl-rev" style={{ height: `${(r.revenue / max) * 100}%` }}>
                {r.paid > 0 && <i style={{ height: `${(r.paid / r.revenue) * 100}%` }} />}
              </span>
              <span className="dw-pl-bar dw-pl-cost" style={{ height: `${(r.cost / max) * 100}%` }} />
            </div>
            <span role="cell" className="dw-pl-month">{shortMonth(r.key)}</span>
            <span role="cell" className="dw-pl-profit num" style={{ color: tone(r.profit) }}>
              {signed(Math.round(r.profit))}
            </span>
          </div>
        ))}
      </div>

      <footer className="dw-foot">
        <span className="dw-pl-key">
          <span><i className="dw-sw" style={{ background: "var(--neon-green)" }} /> Revenue (solid received, faint due)</span>
          <span><i className="dw-sw" style={{ background: "var(--neon-amber)" }} /> Costs</span>
          <span>Last {FORECAST_MONTHS} columns are a forecast</span>
        </span>
        {booked > 0 && (
          <span>
            <b className="num">{gbp(booked)}</b> booked for later months
          </span>
        )}
      </footer>
    </Widget>
  );
}
