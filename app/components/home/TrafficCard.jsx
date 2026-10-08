"use client";

import { useState } from "react";
import { Widget, WidgetNote, fmtK } from "./Widget";

// Fleet traffic with its own Today / 7D / 1M / All time switch. Every period
// arrives with the page (lib/fleet-traffic.js), so switching is instant: the
// totals are looked up and the chart is a slice of one daily line.

const TABS = [
  { key: "today", label: "Today", days: 1, phrase: "today so far" },
  { key: "7d", label: "7D", days: 7, phrase: "last 7 days" },
  { key: "1m", label: "1M", days: 30, phrase: "last 30 days" },
  { key: "all", label: "All time", days: null, phrase: "all time" },
];

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

function Chart({ series, phrase }) {
  const vals = series.map(([, u]) => u);
  const max = niceMax(Math.max(...vals));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / (vals.length - 1);
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(vals.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const labelAt = [0, Math.floor((vals.length - 1) / 2), vals.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Fleet visitors per day, ${phrase}`}>
      <defs>
        <linearGradient id="dw-traffic-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--neon-cyan)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--neon-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, max / 2, max].map((t) => (
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
        <text
          key={i}
          x={x(i)}
          y={H - 5}
          fill="var(--muted)"
          fontSize="10"
          textAnchor={i === 0 ? "start" : i === vals.length - 1 ? "end" : "middle"}
          className="dw-axis"
        >
          {dayLabel(series[i][0])}
        </text>
      ))}
    </svg>
  );
}

export default function TrafficCard({ data }) {
  const [key, setKey] = useState("1m");
  const tab = TABS.find((t) => t.key === key);
  const p = data.periods[key];
  // The daily line ends yesterday, so "today" has no line of its own: it
  // shows the last week for shape, and says so.
  const span = tab.days === 1 ? 7 : tab.days;
  const series = span ? data.daily.slice(-span) : data.daily;
  const change = p.before ? (p.users - p.before) / p.before : null;
  const mins = Math.floor(p.duration / 60);
  const secs = Math.round(p.duration % 60);

  return (
    <Widget
      span={8}
      className="dw-traffic"
      title="Fleet traffic"
      sub={`visitors, ${data.connected} of ${data.total} titles, ${tab.phrase}`}
      href="/analytics"
      linkLabel="Open analytics"
      actions={
        <div className="period-tabs period-tabs-sm" role="group" aria-label="Time period">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`period-tab${t.key === key ? " is-active" : ""}`}
              aria-pressed={t.key === key}
              onClick={() => setKey(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="dw-traffic-figs">
        <span>
          <b className="num dw-big">{fmtK(p.users)}</b> visitors
        </span>
        {change != null && isFinite(change) && (
          <span className={`num ${change >= 0 ? "dw-up" : "dw-down"}`}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}% {key === "today" ? "on yesterday" : "on the period before"}
          </span>
        )}
        <span className="num dw-muted">
          {mins}m {secs}s average visit
        </span>
      </div>
      {series.length >= 2 ? (
        <>
          <Chart series={series} phrase={tab.phrase} />
          {key === "today" && <p className="dw-note">Chart shows the last 7 days; today is still being counted.</p>}
        </>
      ) : (
        <WidgetNote>Not enough days yet to draw a chart.</WidgetNote>
      )}
    </Widget>
  );
}
