"use client";

import { useState } from "react";

const INK = "#eef2ff";
const INK_2 = "#8b97c6";

// Deliberately outside the categorical order. "Other" is not an identity — it
// is the absence of one — so it must not look like another title.
const OTHER = "#64748b";

// Every title gets its own slice now the palette has a colour per title; the
// cap only exists so a fleet of thirty does not become a ring of slivers.
const MAX_NAMED = 12;

/**
 * Part-to-whole, at a glance.
 *
 * The legend carries names only and the figures live in the centre of the
 * ring: hovering (or tapping) a slice or a legend row swaps the total for that
 * title's value and share. That keeps a ten-title legend to one short line per
 * title instead of truncated names squeezed beside two numbers each.
 */
export default function SharePie({ slices, centre, centreLabel, ariaLabel, empty = "Nothing to show yet." }) {
  const [active, setActive] = useState(null);

  const usable = (slices || []).filter((s) => s.value > 0);
  const total = usable.reduce((n, s) => n + s.value, 0);
  if (!total) return <p style={{ fontSize: 13, color: INK_2, margin: 0 }}>{empty}</p>;

  // A ring drawn from a single slice is a circle that says "100%", which is a
  // stat tile pretending to be a chart. Say so instead.
  if (usable.length === 1) {
    const only = usable[0];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: only.colour, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>{only.display ?? only.value.toLocaleString()}</div>
          <div style={{ fontSize: 12.5, color: INK_2 }}>all of it — {only.label}</div>
        </div>
      </div>
    );
  }

  const sorted = [...usable].sort((a, b) => b.value - a.value);
  const named = sorted.slice(0, MAX_NAMED);
  const rest = sorted.slice(MAX_NAMED);
  const shown = rest.length
    ? [...named, { key: "other", label: `Other (${rest.length})`, value: rest.reduce((n, s) => n + s.value, 0), colour: OTHER }]
    : named;

  const R = 80, r = 54, CX = 95, CY = 95;
  const GAP = 2 / R;

  // Slice starts accumulated up front rather than via a running total inside
  // the map, which the React compiler rejects.
  const starts = [];
  for (let i = 0, at = -Math.PI / 2; i < shown.length; i++) {
    starts.push(at);
    at += (shown[i].value / total) * Math.PI * 2;
  }

  const arcs = shown.map((s, i) => {
    const frac = s.value / total;
    const sweep = frac * Math.PI * 2;
    const a0 = starts[i] + GAP / 2;
    const a1 = starts[i] + sweep - GAP / 2;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad, radius) => `${CX + Math.cos(rad) * radius} ${CY + Math.sin(rad) * radius}`;
    // A slice thinner than the gap would render inside-out; drop the arc and
    // let the legend carry it.
    const d =
      a1 <= a0
        ? ""
        : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    // Nudged outward along its own bisector when active, so the hovered slice
    // lifts out of the ring rather than changing colour.
    const mid = starts[i] + sweep / 2;
    return { ...s, d, mid, pct: (frac * 100).toFixed(frac < 0.1 ? 1 : 0) };
  });

  const hot = arcs.find((a) => a.key === active) || null;
  const toggle = (key) => setActive((k) => (k === key ? null : key));

  return (
    <div className="pie" onMouseLeave={() => setActive(null)}>
      <svg viewBox="0 0 190 190" width="180" height="180" role="img" aria-label={ariaLabel} className="pie-svg">
        {arcs.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill={a.colour}
            className="pie-slice"
            style={{
              opacity: hot && hot.key !== a.key ? 0.28 : 1,
              transform: hot?.key === a.key ? `translate(${Math.cos(a.mid) * 4}px, ${Math.sin(a.mid) * 4}px)` : undefined,
            }}
            onMouseEnter={() => setActive(a.key)}
            onClick={() => toggle(a.key)}
          >
            <title>{`${a.label}: ${a.display ?? a.value.toLocaleString()} (${a.pct}%)`}</title>
          </path>
        ))}
        <text x={CX} y={CY - (hot ? 9 : 3)} textAnchor="middle" fontSize="21" fontWeight="700" fill={INK}>
          {hot ? (hot.display ?? hot.value.toLocaleString()) : centre}
        </text>
        <text x={CX} y={CY + (hot ? 8 : 14)} textAnchor="middle" fontSize="10" fill={INK_2}>
          {hot ? `${hot.pct}% of the total` : centreLabel}
        </text>
        {hot && (
          <text x={CX} y={CY + 22} textAnchor="middle" fontSize="9.5" fill={hot.colour} fontWeight="600">
            {hot.label.length > 18 ? `${hot.label.slice(0, 17)}…` : hot.label}
          </text>
        )}
      </svg>

      {/* Identity lives in the legend text; colour is the second cue, never
          the only one. Rows are hover and tap targets for the same readout. */}
      <ul className="pie-legend">
        {arcs.map((a) => (
          <li
            key={a.key}
            className={`pie-key${hot ? (hot.key === a.key ? " is-hot" : " is-dim") : ""}`}
            onMouseEnter={() => setActive(a.key)}
            onClick={() => toggle(a.key)}
          >
            <span className="pie-swatch" style={{ background: a.colour }} />
            <span className="pie-name">{a.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
