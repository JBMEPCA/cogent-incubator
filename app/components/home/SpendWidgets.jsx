import { Widget, WidgetNote, Gauge, gbp } from "./Widget";
import { AGENT_LABELS } from "@/lib/fleet-costs";

// Two widgets from the same Group costs figures: the month's spend against the
// cap set in targets, and the split by title. Both read fleetCosts(), so they
// always match the Group costs page they link to.

const AGENT_COLORS = ["var(--brand-2)", "var(--neon-cyan)", "var(--neon-violet)", "var(--neon-green)"];

export function SpendWidget({ costs, targets }) {
  if (!costs) {
    return (
      <Widget span={3} title="Spend this month" href="/costs" linkLabel="Open costs">
        <WidgetNote>Costs couldn&apos;t be read just now.</WidgetNote>
      </Widget>
    );
  }
  const rate = costs.rate;
  const spent = costs.totals.thisUsd * rate;
  const projected = costs.totals.projectedUsd * rate;
  const cap = Number(targets?.values?.spend) || 0;
  const pct = cap ? spent / cap : 0;
  const color = !cap ? "var(--muted)" : pct > 1 ? "var(--neon-red)" : pct > 0.85 ? "var(--neon-amber)" : "var(--neon-green)";

  // The four biggest agents, then everything else, then the fixed bills.
  const agents = costs.byAgent.filter((a) => a.thisUsd > 0);
  const top = agents.slice(0, 4);
  const rest = agents.slice(4).reduce((n, a) => n + a.thisUsd, 0);
  const lines = [
    ...top.map((a, i) => ({ label: AGENT_LABELS[a.agent] || a.agent, v: a.thisUsd * rate, color: AGENT_COLORS[i] })),
    ...(rest ? [{ label: "Other agents", v: rest * rate, color: "var(--cat-slate)" }] : []),
    { label: "Fixed bills", v: costs.totals.fixedUsd * rate, color: "var(--neon-amber)" },
  ];

  const samePoint = costs.totals.prevSamePointUsd;
  const change = samePoint ? (costs.totals.thisUsd - samePoint) / samePoint : null;

  return (
    <Widget span={3} title="Spend this month" sub={cap ? "fleet total against the cap in targets" : "fleet total, no cap set yet"} href="/costs" linkLabel="Open costs">
      <div className="dw-spend">
        <Gauge
          pct={pct}
          label={gbp(spent)}
          sub={cap ? `of ${gbp(cap)}` : "spent"}
          color={color}
          size={136}
        />
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
          On pace for <b className="num">{gbp(projected)}</b> by month end
        </span>
        {change != null && (
          <span className={`num ${change > 0 ? "dw-down" : "dw-up"}`}>
            {change > 0 ? "▲" : "▼"} {Math.abs(Math.round(change * 100))}% vs {costs.month.prevLabel.split(" ")[0]}
          </span>
        )}
      </footer>
    </Widget>
  );
}

export function SpendByTitleWidget({ costs }) {
  if (!costs) {
    return (
      <Widget span={3} title="Spend by title" href="/costs" linkLabel="Open costs">
        <WidgetNote>Costs couldn&apos;t be read just now.</WidgetNote>
      </Widget>
    );
  }
  const rate = costs.rate;
  const rows = [...costs.titles].sort((a, b) => b.thisUsd - a.thisUsd);
  const max = Math.max(1, ...rows.map((t) => t.thisUsd));
  return (
    <Widget span={3} title="Spend by title" sub={`${costs.month.label}, so far`} href="/costs" linkLabel="Open costs">
      <div className="dw-hbars">
        {rows.map((t) => (
          <div key={t.id} className="dw-hbar">
            <span className="dw-hbar-l">{t.name}</span>
            <span className="dw-hbar-track">
              <i style={{ width: `${(t.thisUsd / max) * 100}%`, background: t.accentHex }} />
            </span>
            <span className="num">{gbp(t.thisUsd * rate)}</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}
