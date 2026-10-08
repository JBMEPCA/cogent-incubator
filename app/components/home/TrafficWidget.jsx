import { Widget, WidgetNote, fmtK } from "./Widget";
import { fleetAnalytics } from "@/lib/fleet-analytics";

// Visitors per day across every title GA4 can see, over the same 28-day window
// as Group analytics. Google is asked once per title (cached for fifteen
// minutes), so the page streams this in rather than waiting on it.

const W = 560;
const H = 150;
const PAD = { l: 38, r: 10, t: 12, b: 22 };

function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function TrafficWidget() {
  let data = null;
  try {
    data = await fleetAnalytics();
  } catch {
    data = null;
  }
  const series = data?.trend?.audience || [];

  if (!data?.totals || series.length < 2) {
    return (
      <Widget span={8} title="Fleet traffic" href="/analytics" linkLabel="Open analytics">
        <WidgetNote>No GA4 figures yet. Connect Google Analytics on a title to see traffic here.</WidgetNote>
      </Widget>
    );
  }

  const { totals, windowDays, connected } = data;
  const vals = series.map((p) => p.users);
  const max = niceMax(Math.max(...vals));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / (vals.length - 1);
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(vals.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, max / 2, max];
  const labelAt = [0, Math.floor((vals.length - 1) / 2), vals.length - 1];
  const change = totals.prevUsers ? (totals.users - totals.prevUsers) / totals.prevUsers : null;
  const mins = Math.floor((totals.avgDuration || 0) / 60);
  const secs = Math.round((totals.avgDuration || 0) % 60);

  return (
    <Widget
      span={8}
      title="Fleet traffic"
      sub={`visitors per day, ${connected.ga4} of ${connected.total} titles, last ${windowDays} days`}
      href="/analytics"
      linkLabel="Open analytics"
    >
      <div className="dw-traffic-figs">
        <span>
          <b className="num dw-big">{fmtK(totals.users)}</b> visitors
        </span>
        {change != null && (
          <span className={`num ${change >= 0 ? "dw-up" : "dw-down"}`}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}% on the {windowDays} days before
          </span>
        )}
        <span className="num dw-muted">
          {mins}m {secs}s average visit
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Fleet visitors per day, last ${windowDays} days`}>
        <defs>
          <linearGradient id="dw-traffic-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--neon-cyan)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--neon-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={PAD.l - 6} y={y(t) + 3} fill="var(--muted)" fontSize="10" textAnchor="end" className="dw-axis">
              {fmtK(t)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#dw-traffic-fill)" />
        <path d={line} fill="none" stroke="var(--neon-cyan)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(vals.length - 1)} cy={y(vals.at(-1))} r="4" fill="var(--neon-cyan)" stroke="var(--surface)" strokeWidth="2" />
        {labelAt.map((i) => (
          <text key={i} x={x(i)} y={H - 5} fill="var(--muted)" fontSize="10" textAnchor={i === 0 ? "start" : i === vals.length - 1 ? "end" : "middle"} className="dw-axis">
            {dayLabel(series[i].date)}
          </text>
        ))}
      </svg>
    </Widget>
  );
}
