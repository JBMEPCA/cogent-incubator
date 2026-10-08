import { Widget, WidgetNote, Gauge, gbp } from "./Widget";
import { AGENT_LABELS } from "@/lib/fleet-costs";

// Two widgets from the same spend figures for the chosen period (see
// lib/period-spend.js): the total against the monthly cap spread over the
// same number of days, and the split by title. The footer always gives this
// calendar month from Group costs, so the bill-shaped number is one glance away.

const AGENT_COLORS = ["var(--brand-2)", "var(--neon-cyan)", "var(--neon-violet)", "var(--neon-green)"];
const MONTH_DAYS = 365.25 / 12;

function Unavailable({ title }) {
  return (
    <Widget span={3} title={title} href="/costs" linkLabel="Open costs">
      <WidgetNote>Costs couldn&apos;t be read just now.</WidgetNote>
    </Widget>
  );
}

export function SpendWidget({ costs, spend, period, targets }) {
  if (!costs || !spend) return <Unavailable title="Spend" />;
  const rate = spend.rate;
  const spent = spend.totalUsd * rate;
  const monthCap = Number(targets?.values?.spend) || 0;
  // The monthly cap scaled to the period, so a week is judged against a
  // week's worth of budget. All time has no cap to scale.
  const cap = period.key === "all" ? 0 : (monthCap * spend.days) / MONTH_DAYS;
  const pct = cap ? spent / cap : 0;
  const color = !cap ? "var(--muted)" : pct > 1 ? "var(--neon-red)" : pct > 0.85 ? "var(--neon-amber)" : "var(--neon-green)";

  // The four biggest agents, then everything else, then the fixed bills.
  const top = spend.byAgent.slice(0, 4);
  const rest = spend.byAgent.slice(4).reduce((n, a) => n + a.usd, 0);
  const lines = [
    ...top.map((a, i) => ({ label: AGENT_LABELS[a.agent] || a.agent, v: a.usd * rate, color: AGENT_COLORS[i] })),
    ...(rest ? [{ label: "Other agents", v: rest * rate, color: "var(--cat-slate)" }] : []),
    { label: "Fixed bills, spread by day", v: spend.fixedUsd * rate, color: "var(--neon-amber)" },
  ];

  return (
    <Widget
      span={3}
      title="Spend"
      sub={cap ? `${period.phrase}, against the cap for that many days` : period.phrase}
      href="/costs"
      linkLabel="Open costs"
    >
      <div className="dw-spend">
        <Gauge pct={pct} label={gbp(spent)} sub={cap ? `of ${gbp(cap)}` : "spent"} color={color} size={136} />
        <div className="dw-legend">
          {lines.map((l) => (
            <div key={l.label}>
              <span className="dw-sw" style={{ background: l.color }} />
              <span className="dw-legend-l">{l.label}</span>
              <span className="num">{gbp(l.v)}</span>
            </div>
          ))}
        </div>
      </div>
      <footer className="dw-foot">
        <span>
          {costs.month.label.split(" ")[0]} so far <b className="num">{gbp(costs.totals.thisUsd * costs.rate)}</b>, on
          pace for <b className="num">{gbp(costs.totals.projectedUsd * costs.rate)}</b>
        </span>
      </footer>
    </Widget>
  );
}

export function SpendByTitleWidget({ spend, period }) {
  if (!spend) return <Unavailable title="Spend by title" />;
  const rows = [...spend.titles].sort((a, b) => b.usd - a.usd);
  const max = Math.max(1e-9, ...rows.map((t) => t.usd));
  return (
    <Widget span={3} title="Spend by title" sub={period.phrase} href="/costs" linkLabel="Open costs">
      <div className="dw-hbars">
        {rows.map((t) => (
          <div key={t.id} className="dw-hbar">
            <span className="dw-hbar-l">{t.name}</span>
            <span className="dw-hbar-track">
              <i style={{ width: `${(t.usd / max) * 100}%`, background: t.accentHex }} />
            </span>
            <span className="num">{gbp(t.usd * spend.rate)}</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}
