// The authority picture over time.
//
// Not Domain Authority: that is Moz's proprietary number, it costs money to
// read, and on a title with no referring domains it reads 1 and stays there for
// months. These are the things DA models anyway — how well we rank, how widely,
// and who links to us — measured directly and free.
//
// Position is drawn INVERTED, because position 12 is better than position 60
// and a line that falls while things improve is a graph nobody trusts twice.

const SURFACE = { background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)" };

const fmt = (n, dp = 0) => (n == null ? "—" : Number(n).toFixed(dp));

/** Positive when the metric is moving the way we want, whichever way that is. */
function Delta({ now, was, lowerIsBetter = false, dp = 0, suffix = "" }) {
  if (now == null || was == null) return null;
  const diff = now - was;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.05) return <span style={{ opacity: 0.5, fontSize: 12 }}>level</span>;
  return (
    <span style={{ fontSize: 12, color: good ? "#6ee7b7" : "var(--neon-amber)" }}>
      {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff), dp)}
      {suffix}
    </span>
  );
}

function Stat({ label, value, children, hint }) {
  return (
    <div style={{ ...SURFACE, flex: 1, minWidth: 150, padding: "11px 13px", borderRadius: 11 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{value}</span>
        {children}
      </div>
      {hint && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function AuthorityTrend({ rows = [], summary }) {
  // Two points is the minimum that can honestly be called a trend. Below that
  // the panel says so rather than drawing a line through one dot.
  if (rows.length < 2) {
    return (
      <section style={{ ...SURFACE, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Authority</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Not enough history yet. The Backlink Manager records one snapshot a day, so this fills
          in from the next sweep.
        </p>
      </section>
    );
  }

  const w = 680;
  const h = 132;
  const pad = 26;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(rows.length - 1, 1);

  const impressions = rows.map((r) => r.impressions || 0);
  const maxImp = Math.max(1, ...impressions);
  const yImp = (v) => h - pad - (v / maxImp) * (h - pad * 2);

  // Positions run 1 (best) to ~100. Clamped so one freak day at 300 does not
  // flatten the entire line into the floor.
  const positions = rows.map((r) => (r.position == null ? null : Math.min(100, r.position)));
  const yPos = (v) => pad + ((v - 1) / 99) * (h - pad * 2);

  const path = (vals, y) => {
    let d = "";
    let started = false;
    vals.forEach((v, i) => {
      if (v == null) return;
      d += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      started = true;
    });
    return d;
  };

  const first = rows[0].day;
  const last = rows[rows.length - 1].day;
  const label = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <section style={{ ...SURFACE, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: "0 0 2px", fontSize: 15 }}>Authority</h3>
        <span style={{ fontSize: 11.5, opacity: 0.5 }}>
          {label(first)} – {label(last)}
        </span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
        How well we rank, how widely, and who links to us. Ranking higher and appearing for more
        queries is what a rising domain looks like before the clicks arrive.
      </p>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
        <Stat label="Avg position" value={fmt(summary?.position?.now, 1)} hint="lower is better">
          <Delta now={summary?.position?.now} was={summary?.position?.was} lowerIsBetter dp={1} />
        </Stat>
        <Stat label="Impressions / day" value={fmt(summary?.impressions?.now)}>
          <Delta now={summary?.impressions?.now} was={summary?.impressions?.was} />
        </Stat>
        <Stat label="Queries / day" value={fmt(summary?.queries?.now)} hint="distinct searches we appear for">
          <Delta now={summary?.queries?.now} was={summary?.queries?.was} />
        </Stat>
        <Stat
          label="Referring domains"
          value={fmt(summary?.referringDomains)}
          hint="sites linking to us"
        />
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Average position and impressions over time">
        <path d={path(impressions, yImp)} fill="none" stroke="#2E3EEE" strokeWidth="2.5" />
        <path d={path(positions, yPos)} fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeDasharray="5 3" />
      </svg>
      <div style={{ fontSize: 11.5, opacity: 0.6, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><span style={{ color: "#2E3EEE" }}>&#9632;</span> impressions</span>
        <span><span style={{ color: "#6ee7b7" }}>&#9632;</span> average position (higher on the chart is better)</span>
      </div>
    </section>
  );
}
