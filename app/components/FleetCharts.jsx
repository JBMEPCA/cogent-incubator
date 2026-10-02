// Charts for the group analytics page.
//
// Same approach as CostCharts: server-rendered SVG with native <title>
// tooltips, no chart library, no hydration — except the donut, which reads
// out a slice's value on hover and so is a client component (SharePie.jsx). The categorical palette is
// imported from there rather than restated, so a title is the same colour on
// both screens and there is only one set of hues to keep validated. It passes
// lightness band, chroma floor, CVD separation, normal-vision floor and
// contrast against the dark panel surface.
import { SERIES } from "./CostCharts";

// The five validated hues first, so the first five titles keep the colours
// they have always had, then five more at the same lightness for the rest of
// the fleet. Five repeated round a ten-title fleet put Smart SME and Gym
// Business News in the same blue, which a legend cannot untangle once Other
// is split back into its titles. The second five are picked for separation
// from the first on a dark surface rather than run through the full validator.
const FLEET_SERIES = [...SERIES, "#8f6ae8", "#20a9bd", "#86ad3a", "#e04b4b", "#b98a5e"];
const INK_2 = "#8b97c6";

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
    map[key] = FLEET_SERIES[i % FLEET_SERIES.length];
  });
  return map;
}

// The donut is interactive (hover swaps the centre figure), so it lives in its
// own client component; re-exported here so the page keeps one import.
export { default as SharePie } from "./SharePie";

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

// Search position as a pill whose colour says which page of Google it is on:
// the top three, the rest of page one, page two, and beyond.
export function PositionPill({ position }) {
  if (!position) return null;
  const tone = position <= 3 ? "top" : position <= 10 ? "p1" : position <= 20 ? "p2" : "far";
  return (
    <span className={`rank-pos rank-pos-${tone}`} title="Average position in Google">
      #{position.toFixed(1)}
    </span>
  );
}

/**
 * A ranked list: rank, label with its magazine underneath, the figure on the
 * right and a bar under the row scaled to the top of the list.
 *
 * Bars carry the magazine colour so a title's rows can be picked out at a
 * glance, but the magazine is always named in text too. `grouped` drops a
 * heading in wherever an item's `group` changes, so converters and near misses
 * read as two sets rather than one ranking that silently changes measure.
 */
export function RankedList({ items, grouped = false }) {
  return (
    <ol className="rank-list">
      {items.map((it, i) => {
        const heading = grouped && it.group && (i === 0 || items[i - 1].group !== it.group);
        return (
          <li key={it.key} className={`rank-row${it.faded ? " is-faded" : ""}`}>
            {heading && <div className="rank-group">{it.group}</div>}
            <span className={`rank-n num${i < 3 ? " is-top" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
            <div className="rank-main">
              <div className="rank-primary" title={it.primary}>{it.primary}</div>
              {(it.meta || it.position) && (
                <div className="rank-meta">
                  {it.meta && (
                    <>
                      <span className="rank-swatch" style={{ background: it.colour }} />
                      <span className="rank-meta-text">{it.meta}</span>
                    </>
                  )}
                  <PositionPill position={it.position} />
                </div>
              )}
            </div>
            <div className="rank-fig">
              <div className="rank-value num">
                {it.value}
                {it.unit && <span className="rank-unit"> {it.unit}</span>}
              </div>
              {it.sub && <div className="rank-sub num">{it.sub}</div>}
            </div>
            <div className="rank-track">
              <div className="rank-fill" style={{ width: `${Math.max(2, (it.share || 0) * 100)}%`, background: it.colour }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
