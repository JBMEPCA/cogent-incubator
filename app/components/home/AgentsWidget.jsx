import { fleetRead } from "@/lib/prisma";
import { Widget, WidgetNote } from "./Widget";

// What the engine is doing right now, across every title.

const STATES = [
  { key: "working", label: "Working", color: "var(--brand-2)" },
  { key: "reporting", label: "Reporting", color: "var(--neon-cyan)" },
  { key: "idle", label: "Idle", color: "var(--cat-slate)" },
  { key: "blocked", label: "Blocked", color: "var(--neon-red)" },
];

export default async function AgentsWidget({ awaiting }) {
  let counts = null;
  try {
    const rows = await fleetRead().agent.groupBy({ by: ["state"], _count: { _all: true } });
    counts = Object.fromEntries(rows.map((r) => [r.state, r._count._all]));
  } catch {
    counts = null;
  }

  if (!counts) {
    return (
      <Widget title="Agents" href="/engine-hub" linkLabel="Open engine hub">
        <WidgetNote>Agent states couldn&apos;t be read just now.</WidgetNote>
      </Widget>
    );
  }

  const total = STATES.reduce((n, s) => n + (counts[s.key] || 0), 0);
  const r = 46;
  const c = 60;
  const gap = total > 1 ? 0.06 : 0;
  // Each state's start angle, worked out before drawing.
  const present = STATES.filter((s) => counts[s.key]);
  const spans = present.map((s) => (counts[s.key] / total) * Math.PI * 2);
  const starts = spans.map((_, i) => -Math.PI / 2 + spans.slice(0, i).reduce((n, v) => n + v, 0));
  const segs = present.map((s, i) => {
    const span = spans[i];
    const from = starts[i];
    const to = from + span - gap;
    // One state filling the whole ring is drawn as a circle: an SVG arc
    // cannot start and end at the same point.
    if (span >= Math.PI * 2 - 0.001) {
      return <circle key={s.key} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth="12" />;
    }
    const p = (t) => `${(c + r * Math.cos(t)).toFixed(2)},${(c + r * Math.sin(t)).toFixed(2)}`;
    return (
      <path
        key={s.key}
        d={`M${p(from)}A${r},${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p(to)}`}
        fill="none"
        stroke={s.color}
        strokeWidth="12"
      />
    );
  });

  return (
    <Widget title="Agents" sub="what the engine is doing right now" href="/engine-hub" linkLabel="Open engine hub">
      <div className="dw-spend">
        <svg viewBox="0 0 120 120" width="120" role="img" aria-label={`${total} agents`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
          {segs}
          <text x={c} y={c + 7} fill="var(--text)" fontSize="22" fontWeight="600" textAnchor="middle" className="dw-gauge-v">
            {total}
          </text>
        </svg>
        <div className="dw-legend">
          {STATES.map((s) => (
            <div key={s.key}>
              <span className="dw-sw" style={{ background: s.color }} />
              <span className="dw-legend-l">{s.label}</span>
              <span className="num">{counts[s.key] || 0}</span>
            </div>
          ))}
        </div>
      </div>
      <footer className="dw-foot">
        <span>
          <b className="num" style={{ color: awaiting ? "var(--neon-amber)" : undefined }}>{awaiting}</b> drafts and
          replies awaiting you
        </span>
      </footer>
    </Widget>
  );
}
