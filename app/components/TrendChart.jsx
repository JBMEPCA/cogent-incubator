"use client";

import { useId, useRef, useState } from "react";

// Single-series daily trend: 2px line over a soft area, crosshair + tooltip on
// hover. One measure per chart on one axis — two measures means two charts,
// never a second y-scale.

const W = 800;
const H = 150;
const PAD = { top: 12, right: 4, bottom: 4, left: 4 };

const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function TrendChart({ points, color = "var(--neon-cyan)", label = "value" }) {
  const gradId = useId().replace(/:/g, "");
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!points || points.length === 0) return null;

  // A line needs two days to be a line. On a days-old site, show the number.
  if (points.length === 1) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="stat-value num" style={{ fontSize: 26 }}>
          {points[0].value.toLocaleString()}
        </span>
        <span className="micro">
          {label} on {fmtDay(points[0].date)} — one day of history so far
        </span>
      </div>
    );
  }

  const max = Math.max(1, ...points.map((p) => p.value));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`;

  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
    setHover({ i, left: (x(i) / W) * 100 });
  }

  const hp = hover ? points[hover.i] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Daily ${label}, ${fmtDay(points[0].date)} to ${fmtDay(points[points.length - 1].date)}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={W - PAD.right}
          y2={PAD.top + plotH}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {hover && (
          <>
            <line
              x1={x(hover.i)}
              y1={PAD.top - 6}
              x2={x(hover.i)}
              y2={PAD.top + plotH}
              stroke="var(--line-bright)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(hover.i)}
              cy={y(hp.value)}
              r="5"
              fill={color}
              stroke="var(--surface)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {hover && (
        <div
          style={{
            position: "absolute",
            top: -6,
            left: `${hover.left}%`,
            transform: `translate(${hover.left > 70 ? "-100%" : hover.left < 30 ? "0" : "-50%"}, -100%)`,
            background: "var(--surface-2)",
            border: "1px solid var(--line-bright)",
            borderRadius: 8,
            padding: "6px 10px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div className="micro" style={{ marginBottom: 2 }}>{fmtDay(hp.date)}</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700 }}>
            {hp.value.toLocaleString()} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{label}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span className="micro">{fmtDay(points[0].date)}</span>
        <span className="micro">peak {max.toLocaleString()}</span>
        <span className="micro">{fmtDay(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
