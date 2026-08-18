// Charts for the group analytics page.
//
// Same approach as CostCharts: server-rendered SVG with native <title>
// tooltips, no chart library, no hydration. The categorical palette is
// imported from there rather than restated, so a title is the same colour on
// both screens and there is only one set of hues to keep validated. It passes
// lightness band, chroma floor, CVD separation, normal-vision floor and
// contrast against the dark panel surface.
import { SERIES } from "./CostCharts";

const INK = "#eef2ff";
const INK_2 = "#8b97c6";

// Deliberately outside the categorical order. "Other" is not an identity — it
// is the absence of one — so it must not look like the sixth title.
const OTHER = "#64748b";

/**
 * A stable colour per entity.
 *
 * Assigned from a fixed key order and never from rank, so Smart SME stays the
 * same colour whether it is first by audience and third by output, and adding
 * a title does not repaint the ones already there. Rank-assigned colour is the
 * classic way a set of charts ends up quietly contradicting itself.
 */
export function colourMap(keys) {
  const map = {};
  keys.forEach((key, i) => {
    map[key] = SERIES[i % SERIES.length];
  });
  return map;
}

/**
 * Part-to-whole, at a glance.
 *
 * Capped at five named slices plus Other: past about six segments adjacent
 * slices stop being tellable apart, and a donut is the wrong form for reading
 * close values precisely anyway — that is what the table above it is for.
 */
export function SharePie({ slices, centre, centreLabel, ariaLabel, empty = "Nothing to show yet." }) {
  const usable = (slices || []).filter((s) => s.value > 0);
  const total = usable.reduce((n, s) => n + s.value, 0);
  if (!total) return <p style={{ fontSize: 13, color: INK_2, margin: 0 }}>{empty}</p>;

  // A ring drawn from a single slice is a circle that says "100%", which is
  // not a part-to-whole reading — it is a stat tile pretending to be a chart.
  // Real state on a young fleet: until the second title has traffic, one
  // magazine genuinely is all of it, and saying so is more use than drawing it.
  if (usable.length === 1) {
    const only = usable[0];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: only.colour, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>
            {only.display ?? only.value.toLocaleString()}
          </div>
          <div style={{ fontSize: 12.5, color: INK_2 }}>all of it — {only.label}</div>
        </div>
      </div>
    );
  }

  const sorted = [...usable].sort((a, b) => b.value - a.value);
  const named = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const shown = rest.length
    ? [...named, { key: "other", label: `Other (${rest.length})`, value: rest.reduce((n, s) => n + s.value, 0), colour: OTHER }]
    : named;

  const R = 78, r = 48, CX = 95, CY = 95;
  // ~2px of surface between segments, computed from the radius rather than
  // guessed, so the gap is the same visual width on every donut.
  const GAP = 2 / R;

  // Where each slice starts, accumulated up front rather than by carrying a
  // running total through the map below — the running-total version reassigns
  // a variable from inside a render callback, which the React compiler rejects.
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
    return { ...s, d, pct: (frac * 100).toFixed(frac < 0.1 ? 1 : 0) };
  });

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 190 190" width="170" height="170" role="img" aria-label={ariaLabel}>
        {arcs.map((a) => (
          <path key={a.key} d={a.d} fill={a.colour}>
            <title>{`${a.label}: ${a.display ?? a.value.toLocaleString()} (${a.pct}%)`}</title>
          </path>
        ))}
        {centre && (
          <text x={CX} y={CY - 3} textAnchor="middle" fontSize="20" fontWeight="700" fill={INK}>
            {centre}
          </text>
        )}
        {centreLabel && (
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="10" fill={INK_2}>
            {centreLabel}
          </text>
        )}
      </svg>

      {/* Identity lives in the legend text. Colour is the second cue, never the
          only one — and the values stay in ink, not in the series hue. */}
      <div style={{ flex: 1, minWidth: 145 }}>
        {arcs.map((a) => (
          <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.colour, flexShrink: 0 }} />
            <span style={{ flex: 1, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.label}
            </span>
            <span style={{ color: INK_2, whiteSpace: "nowrap" }}>
              {a.display ?? a.value.toLocaleString()} · {a.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One title's shape, small.
 *
 * Small multiples rather than one chart with a line per title: five lines on
 * one axis is a plate of spaghetti, and the titles differ in size by an order
 * of magnitude, so a shared y-scale would flatten the small ones to the floor.
 * Each panel is scaled to its own peak — which makes these readable as SHAPE
 * only, never as magnitude against each other. The figure beside each one
 * carries the magnitude.
 */
export function Sparkline({ points, colour, label }) {
  if (!points || points.length < 2) {
    return <div style={{ height: 34, display: "flex", alignItems: "center", fontSize: 11, color: INK_2 }}>not enough history</div>;
  }
  const W = 160, H = 34, PAD = 3;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${H - PAD} L ${x(0).toFixed(1)} ${H - PAD} Z`;
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={label}>
      <title>{`${label} — peak ${peak.value.toLocaleString()} on ${peak.date}`}</title>
      <path d={area} fill={colour} opacity="0.13" />
      <path d={line} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
