// Charts for the Costs tab.
//
// Colours are NOT the agents' office accents: those contain three blues and
// fail a colourblindness check (#059669 vs #0891b2 sit 11.8 apart in normal
// vision, below the 15 floor). This is the validated categorical set instead,
// which passes lightness band, chroma, CVD separation, normal-vision floor and
// contrast against the dark surface.
//
// Everything is server-rendered SVG with native <title> tooltips: no chart
// library, no hydration, and identity is never carried by colour alone.

export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const INK = "#ffffff";
const INK_2 = "#c3c2b7";
const GRID = "rgba(255,255,255,.10)";

const STATUS = {
  good: { colour: "#0ca30c", label: "On budget" },
  warning: { colour: "#fab219", label: "Close to budget" },
  critical: { colour: "#d03b3b", label: "Over budget" },
};

/* ------------------------------------------------------- budget meter */

export function BudgetMeter({ spentGbp, targetGbp, breakdown }) {
  const pct = targetGbp ? (spentGbp / targetGbp) * 100 : 0;
  const state = pct >= 100 ? "critical" : pct >= 80 ? "warning" : "good";
  const s = STATUS[state];
  const W = 620, H = 20;
  const fill = Math.min(pct, 100);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 9 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: INK }}>£{spentGbp.toFixed(2)}</span>
        <span style={{ fontSize: 13, color: INK_2 }}>of £{targetGbp.toFixed(0)} a month</span>
        {/* Status is a labelled chip, never colour on its own. */}
        <span
          style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 700, letterSpacing: ".05em",
            textTransform: "uppercase", padding: "3px 9px", borderRadius: 999,
            background: `${s.colour}22`, color: s.colour,
          }}
        >
          {s.label} · {Math.round(pct)}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="20"
        role="img"
        aria-label={`£${spentGbp.toFixed(2)} of a £${targetGbp} monthly budget, ${Math.round(pct)} percent used`}
      >
        <rect x="0" y="4" width={W} height="12" rx="6" fill="rgba(255,255,255,.08)" />
        <rect x="0" y="4" width={(fill / 100) * W} height="12" rx="6" fill={s.colour}>
          <title>{`£${spentGbp.toFixed(2)} spent of £${targetGbp}`}</title>
        </rect>
        {/* 80% marker, so "close to budget" has a visible threshold */}
        <line x1={W * 0.8} y1="1" x2={W * 0.8} y2="19" stroke={GRID} strokeWidth="2" />
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: INK_2, flexWrap: "wrap" }}>
        {breakdown.map((b) => (
          <span key={b.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: b.colour }} />
            {b.label} £{b.gbp.toFixed(2)}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>
          £{Math.max(0, targetGbp - spentGbp).toFixed(2)} headroom
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- donut */

// Part-to-whole: where the AI spend goes. Small agents fold into "Other"
// rather than becoming unreadable slivers with generated hues.
export function SpendDonut({ items, rate }) {
  const total = items.reduce((s, i) => s + i.cost, 0);
  if (!total) return <p style={{ fontSize: 13, color: INK_2, margin: 0 }}>No spend recorded yet.</p>;

  const top = items.slice(0, 4);
  const rest = items.slice(4);
  const slices = [...top];
  if (rest.length) slices.push({ key: "other", label: `Other (${rest.length})`, cost: rest.reduce((s, i) => s + i.cost, 0) });

  const R = 78, r = 48, CX = 95, CY = 95;
  const GAP = 0.018; // radians of surface gap between segments
  let angle = -Math.PI / 2;

  const arcs = slices.map((s, i) => {
    const frac = s.cost / total;
    const sweep = frac * Math.PI * 2;
    const a0 = angle + GAP / 2;
    const a1 = angle + sweep - GAP / 2;
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad, radius) => `${CX + Math.cos(rad) * radius} ${CY + Math.sin(rad) * radius}`;
    const d =
      a1 <= a0
        ? ""
        : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    return { ...s, d, colour: SERIES[i % SERIES.length], pct: Math.round(frac * 100) };
  });

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 190 190" width="190" height="190" role="img" aria-label="Share of AI spend by agent">
        {arcs.map((a) => (
          <path key={a.key} d={a.d} fill={a.colour}>
            <title>{`${a.label}: $${a.cost.toFixed(3)} (${a.pct}%)`}</title>
          </path>
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="21" fontWeight="700" fill={INK}>
          £{(total * rate).toFixed(2)}
        </text>
        <text x={CX} y={CY + 13} textAnchor="middle" fontSize="10.5" fill={INK_2}>30 days</text>
      </svg>

      {/* Legend carries identity in text, so colour is never the only cue. */}
      <div style={{ flex: 1, minWidth: 150 }}>
        {arcs.map((a) => (
          <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.colour, flexShrink: 0 }} />
            <span style={{ flex: 1, color: INK }}>{a.label}</span>
            <span style={{ color: INK_2 }}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- daily trend */

export function DailyTrend({ daily, rate }) {
  const W = 620, H = 150, PAD_L = 34, PAD_B = 22, PAD_T = 10;
  const max = Math.max(...daily.map((d) => d.cost), 0.01);
  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_B - PAD_T;
  const bw = Math.max(6, (plotW / daily.length) * 0.62);

  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Agent spend per day for the last 14 days">
      {ticks.map((t, i) => {
        const y = PAD_T + plotH - (t / max) * plotH;
        return (
          <g key={i}>
            <line x1={PAD_L} y1={y} x2={W - 8} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" fontSize="9.5" fill={INK_2}>
              £{(t * rate).toFixed(2)}
            </text>
          </g>
        );
      })}
      {daily.map((d, i) => {
        const x = PAD_L + (i + 0.5) * (plotW / daily.length) - bw / 2;
        const h = Math.max(d.cost > 0 ? 2 : 0, (d.cost / max) * plotH);
        const y = PAD_T + plotH - h;
        const day = new Date(d.date);
        return (
          <g key={d.date}>
            {/* 4px rounded data-end anchored to the baseline */}
            <rect x={x} y={y} width={bw} height={h} rx="3" fill={SERIES[0]}>
              <title>{`${day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: £${(d.cost * rate).toFixed(3)}`}</title>
            </rect>
            {i % 3 === 0 && (
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="9.5" fill={INK_2}>
                {day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </text>
            )}
          </g>
        );
      })}
      <line x1={PAD_L} y1={PAD_T + plotH} x2={W - 8} y2={PAD_T + plotH} stroke={GRID} strokeWidth="1.5" />
    </svg>
  );
}
