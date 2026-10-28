import Link from "next/link";
import SiteMark from "@/app/components/SiteMark";
import { RISING_RANGES, RISING_SORTS, risingRange } from "@/lib/rising-articles";
import { ShowMore } from "./ShowMore";

// Rising Articles: our pages whose Google impressions jumped this week.
//
// One small bar chart per article: impressions per day for 28 days, the last 7
// in the accent colour and the 21 before in muted ink, so the jump is visible
// at a glance. A single series per chart, so no legend; the header says what
// the bars are and the window, and each bar has a hover tooltip with its date
// and value. Each chart is on its own scale (the header says so), because the
// point is the shape of each article's rise, not comparing heights across rows.

const W = 224;
const H = 52;
const GAP = 2;

function fmtDay(iso, opts = { day: "numeric", month: "short" }) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "Europe/London" });
}

export function Bars({ daily, dates, title, highlight = 7 }) {
  const max = Math.max(1, ...daily);
  const n = daily.length;
  const bw = (W - GAP * (n - 1)) / n;
  return (
    <svg width={W} height={H + 1} viewBox={`0 0 ${W} ${H + 1}`} role="img" aria-label={`${title}: impressions per day, last ${n} days`} style={{ display: "block", maxWidth: "100%" }}>
      {daily.map((v, i) => {
        const h = v ? Math.max(2, (v / max) * H) : 0;
        const recent = i >= n - highlight;
        return (
          <g key={i}>
            {/* Full-height hit area so a zero day still has a tooltip. */}
            <rect x={i * (bw + GAP)} y={0} width={bw} height={H} fill="transparent">
              <title>{`${fmtDay(dates[i], { weekday: "short", day: "numeric", month: "short" })}: ${v.toLocaleString("en-GB")} impressions`}</title>
            </rect>
            {h > 0 && (
              <rect
                x={i * (bw + GAP)}
                y={H - h}
                width={bw}
                height={h}
                rx={Math.min(2, bw / 2)}
                fill={recent ? "var(--neon-cyan)" : "var(--muted)"}
                opacity={recent ? 1 : 0.35}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--line)" />
    </svg>
  );
}

/**
 * One stat tile. Label in sentence case above, figure below, delta under it.
 *
 * The old version shouted four uppercase mono captions across four columns and
 * wrapped "clicks, all time / 0 in the last 7 days" onto three lines, which is
 * what made the row look cluttered. Three tiles, quiet labels, one loud number
 * each. The rise belongs to impressions, so it rides in that tile rather than
 * taking a column of its own.
 */
function Stat({ label, value, delta, deltaTone = "flat", sub }) {
  return (
    <div className="rstat">
      <div className="rstat-label">{label}</div>
      <div className="rstat-value">{value}</div>
      {delta && <div className={`rstat-delta ${deltaTone}`}>{delta}</div>}
      {sub && <div className="rstat-sub">{sub}</div>}
    </div>
  );
}

/** Compact: 1,284 stays, 12,900 becomes 12.9K. */
function compact(n) {
  if (n == null) return "—";
  return n >= 10000 ? `${Math.round(n / 100) / 10}K` : n.toLocaleString("en-GB");
}

export function Figures({ row, range = RISING_RANGES[0] }) {
  // A fall in the position number is a climb up the results, so the arrow and
  // the colour follow the meaning rather than the arithmetic.
  const moved =
    row.positionPrev != null && row.position != null
      ? Math.round((row.positionPrev - row.position) * 10) / 10
      : null;

  return (
    <div className="rising-figures">
      <Stat
        label={`Impressions, ${range.phrase}`}
        value={compact(row.recent)}
        delta={
          row.change == null
            ? null
            : row.change >= 0
              ? `▲ ${compact(row.change)}${row.pct != null ? ` · +${row.pct}%` : ""}`
              : `▼ ${compact(-row.change)}${row.pct != null ? ` · ${row.pct}%` : ""}`
        }
        deltaTone={row.change == null ? "flat" : row.change >= 0 ? "up" : "down"}
        sub={range.before ? `from ${compact(row.previous)} ${range.before}` : null}
      />
      <Stat
        label="Average position"
        value={row.position ?? "—"}
        delta={moved ? `${moved > 0 ? "▲" : "▼"} ${Math.abs(moved)}` : moved === 0 ? "no change" : null}
        deltaTone={moved > 0 ? "up" : moved < 0 ? "down" : "flat"}
        sub={row.positionPrev != null ? `from ${row.positionPrev}` : range.before ? `new in ${range.phrase === "7 days" ? "this week" : "this period"}` : null}
      />
      <Stat
        label={`Clicks, ${range.phrase}`}
        value={compact(row.clicks)}
        // All time is already the whole figure; a shorter period shows the
        // lifetime total underneath, where it is more than the period's.
        sub={range.days && row.clicksAll > row.clicks ? `${row.clicksAll.toLocaleString("en-GB")} all time` : null}
      />
    </div>
  );
}

// trendUrls: the live URLs of articles commissioned from the Trending tab.
// Rising Articles covers every article on every title, so without a marker a
// wire story's clicks read as if they belonged in the trending summary above,
// which counts trending commissions only (16 Oct 2026: 112 clicks across the
// top three rows against 86 in the summary, two of the three being wire).
const bare = (u) => String(u || "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

// hrefFor({ sort, range }) builds the page address for a control, keeping
// everything else on the page as it is.
export default function RisingArticles({ data, sites, trendUrls = [], hrefFor = null }) {
  const fromTrending = new Set(trendUrls.map(bare));
  const { dates = [], rows = [], errors = [], sort = "rising" } = data || {};
  const range = risingRange(data?.range);
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const last = dates[dates.length - 1];
  const W = range.days;
  const recentFrom = W ? dates[dates.length - W] : null;
  const prevFrom = W ? dates[dates.length - 2 * W] : null;
  const prevTo = W ? dates[dates.length - W - 1] : null;
  const span = (a, b) => (a && b ? `${fmtDay(a)}–${fmtDay(b)}` : "");
  const strong = (t) => <strong style={{ color: "var(--text)" }}>{t}</strong>;

  const how = {
    rising: <>Ranked by the rise in Google impressions from {strong(span(prevFrom, prevTo))} to {strong(span(recentFrom, last))}.</>,
    impressions: <>Ranked by Google impressions over {strong(W ? span(recentFrom, last) : "all time")}.</>,
    position: <>Ranked by average Google position over {strong(W ? span(recentFrom, last) : "all time")}, best first, for articles seen {range.posMin}+ times.</>,
    clicks: <>Ranked by Google clicks over {strong(W ? span(recentFrom, last) : "all time")}.</>,
  }[sort];

  return (
    <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
      <div className="rising-head">
        <h3 style={{ margin: 0, fontSize: 14 }}>Rising Articles</h3>
        {hrefFor && (
          <div className="rising-controls">
            <nav className="trend-range" aria-label="Sort by">
              {RISING_SORTS.map((s) => {
                const off = s.key === "rising" && !W;
                return off ? (
                  <span key={s.key} className="fleet-nav-btn" style={{ opacity: 0.4 }} title="All time has no earlier period to rise against">
                    {s.label}
                  </span>
                ) : (
                  <Link key={s.key} href={hrefFor({ sort: s.key })} scroll={false} className={`fleet-nav-btn${sort === s.key ? " is-active" : ""}`}>
                    {s.label}
                  </Link>
                );
              })}
            </nav>
            <nav className="trend-range" aria-label="Period">
              {RISING_RANGES.map((r) => (
                <Link key={r.key} href={hrefFor({ range: r.key })} scroll={false} className={`fleet-nav-btn${range.key === r.key ? " is-active" : ""}`}>
                  {r.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
      <p style={{ margin: "8px 0 4px", fontSize: 13, color: "var(--muted)", maxWidth: 820 }}>
        Our articles across every title, from Google Search Console. {how}
      </p>
      <p className="rising-note">
        bars: impressions per day, {dates.length} days to {last ? fmtDay(last) : "yesterday"}
        {W ? `, last ${W} highlighted` : ""} · each chart on its own scale · a lower position number is better · Search Console, hourly
      </p>

      {rows.length ? (
        <ShowMore>
          {rows.map((r) => {
            const site = siteById.get(r.siteId);
            return (
              <div key={r.url} className="rising-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    {site && <SiteMark site={site} size={18} showStatus={false} />}
                    <span className="micro">{site?.name}</span>
                    {fromTrending.has(bare(r.url)) && <span className="chip chip-content" style={{ fontSize: 9, padding: "1px 7px" }}>From Trending</span>}
                  </div>
                  <a href={r.url} target="_blank" rel="noreferrer noopener" style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                    {r.title} ↗
                  </a>
                </div>
                <Bars daily={r.daily} dates={dates} title={r.title} highlight={W || dates.length} />
                <Figures row={r} range={range} />
              </div>
            );
          })}
        </ShowMore>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          {errors.length
            ? `Search Console could not be read: ${errors[0]}`
            : sort === "rising"
              ? `No article has risen meaningfully over the last ${range.phrase}.`
              : "No article has enough search data for this view yet."}
        </p>
      )}
    </section>
  );
}
