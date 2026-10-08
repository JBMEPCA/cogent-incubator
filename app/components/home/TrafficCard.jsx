"use client";

import { useState } from "react";
import { Widget, WidgetNote, fmtK } from "./Widget";

// Fleet traffic, two ways side by side, with its own Today / 7D / 1M / All
// time switch. Every period arrives with the page (lib/fleet-traffic.js), so
// switching is instant.
//
// Left: visitors each day, which shows what happened, spikes and all.
// Right: visitors in the last 28 days, worked out for every day. Smooth enough
// to show the direction, and it still bends down if a month goes badly, which
// a running total never would (JB chose this pairing, 8 Oct 2026). The
// running total is a figure in the header instead, for the milestone feel.
// The 28-day figure adds up daily visitors, so someone who came on two days
// counts twice; Group analytics' 28-day "users" counts them once, and reads a
// little lower.

const TABS = [
  { key: "today", label: "Today", days: 1, phrase: "today so far" },
  { key: "7d", label: "7D", days: 7, phrase: "last 7 days" },
  { key: "1m", label: "1M", days: 30, phrase: "last 30 days" },
  { key: "all", label: "All time", days: null, phrase: "all time" },
];

const W = 400;
const H = 160;
const PAD = { l: 34, r: 8, t: 12, b: 22 };

function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Monotone cubic: a smooth line that never swings below zero or past a real
// peak, so smoothing changes the look and not the numbers.
function smoothPath(pts) {
  const n = pts.length;
  if (n < 2) return "";
  const dx = [];
  const m = [];
  const t = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + h * t[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

function Chart({ id, title, value, dates, values, color, label }) {
  const max = niceMax(Math.max(...values));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / (values.length - 1);
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = smoothPath(values.map((v, i) => [x(i), y(v)]));
  const area = `${line}L${x(values.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const at = [0, Math.floor((values.length - 1) / 2), values.length - 1];
  return (
    <figure className="dw-tchart">
      <figcaption>
        <span>{title}</span>
        <b className="num" style={{ color }}>
          {value}
        </b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={PAD.l - 5} y={y(t) + 3} fill="var(--muted)" fontSize="10" textAnchor="end" className="dw-axis">
              {fmtK(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />
        {at.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 5}
            fill="var(--muted)"
            fontSize="10"
            textAnchor={i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"}
            className="dw-axis"
          >
            {dayLabel(dates[i])}
          </text>
        ))}
      </svg>
    </figure>
  );
}

export default function TrafficCard({ data }) {
  const [key, setKey] = useState("1m");
  const tab = TABS.find((t) => t.key === key);
  const p = data.periods[key];

  const dates = data.daily.map(([d]) => d);
  const daily = data.daily.map(([, u]) => u);
  // Visitors in the 28 days up to and including each day.
  const rolling = daily.map((_, i) => daily.slice(Math.max(0, i - 27), i + 1).reduce((a, v) => a + v, 0));
  const sinceLaunch = daily.reduce((a, v) => a + v, 0);

  // The daily line ends yesterday, so "today" has no line of its own: both
  // charts show the last week for shape, and the note says so.
  const span = tab.days === 1 ? 7 : tab.days;
  const from = span ? Math.max(0, daily.length - span) : 0;
  const shown = daily.length - from;
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
        <span className="num dw-muted dw-launch">
          <b>{fmtK(sinceLaunch)}</b> since launch
        </span>
      </div>
      {shown >= 2 ? (
        <>
          <div className="dw-tcharts">
            <Chart
              id="dw-tc-daily"
              title="Each day"
              value={fmtK(daily.at(-1))}
              dates={dates.slice(from)}
              values={daily.slice(from)}
              color="var(--neon-cyan)"
              label={`Visitors each day, ${tab.phrase}`}
            />
            <Chart
              id="dw-tc-rolling"
              title="Last 28 days, rolling"
              value={fmtK(rolling.at(-1))}
              dates={dates.slice(from)}
              values={rolling.slice(from)}
              color="var(--neon-green)"
              label={`Visitors in the 28 days to each day, ${tab.phrase}`}
            />
          </div>
          {key === "today" && <p className="dw-note">Charts show the last 7 days; today is still being counted.</p>}
        </>
      ) : (
        <WidgetNote>Not enough days yet to draw a chart.</WidgetNote>
      )}
    </Widget>
  );
}
