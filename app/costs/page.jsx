import Link from "next/link";
import FleetNav from "../components/FleetNav";
import { fleetCosts } from "@/lib/fleet-costs";

export const dynamic = "force-dynamic";

// What the whole operation costs.
//
// Built for one reader in particular: the director, who wants three numbers —
// spent so far this month, what last month came to, and where this month is
// heading — readable from across the room, and then the one or two things
// behind them worth acting on. The token-level breakdown lives on each title's
// own Costs tab, one click away from its row here; it does not belong on the
// page someone opens to answer "are we on budget".
//
// Charts are server-rendered SVG with native <title> tooltips, same as
// CostCharts and FleetCharts: no chart library, no hydration.

const INK = "#eef2ff";
const INK_2 = "#8b97c6";
const GRID = "rgba(255,255,255,.08)";
const THIS = "#3987e5"; // SERIES[0] in CostCharts
const PREV = "#8b97c6";

const AGENT_LABELS = {
  editor: "Writing articles",
  researcher: "Research",
  seo: "SEO",
  designer: "Images",
  director: "Planning (Director)",
  finance: "Finance checks",
  linkedin: "LinkedIn posts",
  backlink: "Backlink outreach",
  newsletter: "Newsletters",
  scripted: "Batch-written articles",
};

/** Pounds, sized for reading: whole pounds once a figure is big enough that pence are noise. */
function gbp(usd, rate, { exact = false } = {}) {
  if (usd == null) return "—";
  const v = usd * rate;
  const dp = !exact && Math.abs(v) >= 100 ? 0 : 2;
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

const pence = (usd, rate) => {
  if (usd == null) return "—";
  const p = usd * rate * 100;
  return p >= 100 ? `£${(p / 100).toFixed(2)}` : `${Math.round(p)}p`;
};

/**
 * A change, said in words as well as colour. Costs going up is not
 * automatically bad on a fleet that is adding titles, so up is amber, not red.
 */
function Delta({ now, then, against }) {
  if (!then) return null;
  const pct = ((now - then) / then) * 100;
  const flat = Math.abs(pct) < 2;
  const up = pct > 0;
  const cls = flat ? "is-flat" : up ? "is-up" : "is-down";
  return (
    <span className={`gc-delta ${cls}`}>
      {flat ? "≈ same" : `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`}
      {against && <span className="gc-delta-vs"> {against}</span>}
    </span>
  );
}

function Hero({ label, value, sub, delta, tone }) {
  return (
    <div className={`gc-hero${tone ? ` is-${tone}` : ""}`}>
      <div className="gc-hero-label">{label}</div>
      <div className="gc-hero-value num">{value}</div>
      {delta}
      {sub && <div className="gc-hero-sub">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------- running-total chart */

/**
 * This month's running total against last month's, with the projection drawn
 * on to the month end. The one picture that answers "are we spending faster
 * than last month" without anyone doing arithmetic.
 */
function RunningTotal({ running, month, totals, rate }) {
  const W = 760, H = 280, L = 56, R = 120, T = 16, B = 30;
  const days = Math.max(month.daysInMonth, month.prevDays);
  const yMax = Math.max(totals.projectedUsd, totals.prevUsd, 1) * 1.12;
  const x = (d) => L + (d / days) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);

  // Day 0 is the 1st at midnight, where the month's fixed bills already sit.
  const line = (vals, lastX) =>
    [`M ${x(0)} ${y(totals.fixedUsd)}`, ...vals.map((v, i) => `L ${x(lastX && i === vals.length - 1 ? lastX : i + 1)} ${y(v)}`)].join(" ");

  const todayX = month.daysElapsed;
  const ticks = niceTicks(yMax * rate).map((g) => g / rate);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="gc-chart" role="img"
      aria-label={`Running total: ${gbp(totals.thisUsd, rate)} so far, projected ${gbp(totals.projectedUsd, rate)}, against ${gbp(totals.prevUsd, rate)} last month`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={INK_2}>£{Math.round(t * rate).toLocaleString("en-GB")}</text>
        </g>
      ))}
      {[1, 8, 15, 22, days].map((d) => (
        <text key={d} x={x(d - 0.5)} y={H - 8} textAnchor="middle" fontSize="11" fill={INK_2}>{d}</text>
      ))}

      {/* Last month, for comparison. */}
      <path d={line(running.prev)} fill="none" stroke={PREV} strokeWidth="2" strokeDasharray="1 0" opacity="0.7" />
      <text x={x(month.prevDays) + 8} y={y(totals.prevUsd) + 4} fontSize="12" fill={PREV}>
        {month.prevLabel.slice(0, 3)} {gbp(totals.prevUsd, rate)}
      </text>

      {/* Projection: from now to the month end at the last seven days' rate. */}
      <path d={`M ${x(todayX)} ${y(totals.thisUsd)} L ${x(month.daysInMonth)} ${y(totals.projectedUsd)}`}
        fill="none" stroke={THIS} strokeWidth="3" strokeDasharray="6 6" />
      <circle cx={x(month.daysInMonth)} cy={y(totals.projectedUsd)} r="5" fill="none" stroke={THIS} strokeWidth="2.5" />
      <text x={x(month.daysInMonth) + 10} y={y(totals.projectedUsd) - 2} fontSize="13" fontWeight="700" fill={INK}>
        {gbp(totals.projectedUsd, rate)}
      </text>
      <text x={x(month.daysInMonth) + 10} y={y(totals.projectedUsd) + 13} fontSize="11" fill={INK_2}>projected</text>

      {/* This month so far. */}
      <path d={line(running.this, todayX)} fill="none" stroke={THIS} strokeWidth="3.5" strokeLinejoin="round" />
      <line x1={x(todayX)} x2={x(todayX)} y1={T} y2={H - B} stroke={THIS} strokeOpacity="0.35" strokeDasharray="2 4" />
      <circle cx={x(todayX)} cy={y(totals.thisUsd)} r="6" fill={THIS}>
        <title>{`Spent so far: ${gbp(totals.thisUsd, rate)}`}</title>
      </circle>
      <text x={x(todayX)} y={T + 10} textAnchor="middle" fontSize="11" fill={INK_2}>today</text>
    </svg>
  );
}

/** Round gridline values in pounds: 4–5 lines on 1/2/5 steps. */
function niceTicks(maxGbp) {
  const raw = maxGbp / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = 0; v <= maxGbp; v += step) out.push(v);
  return out;
}

/* ------------------------------------------------------- month bars */

function MonthBars({ months, rate }) {
  const max = Math.max(...months.map((m) => m.projectedUsd ?? m.usd), 1);
  return (
    <div className="gc-months">
      {months.map((m) => {
        const actual = (m.usd / max) * 100;
        const projected = m.projectedUsd != null ? ((m.projectedUsd - m.usd) / max) * 100 : 0;
        const shown = m.projectedUsd ?? m.usd;
        return (
          <div key={m.key} className={`gc-month${m.projectedUsd != null ? " is-current" : ""}`}>
            <div className="gc-month-value num">{gbp(shown, rate)}</div>
            <div className="gc-month-track">
              {projected > 0 && (
                <div className="gc-month-proj" style={{ height: `${projected}%` }}
                  title={`Projected rest of ${m.label}: ${gbp(m.projectedUsd - m.usd, rate)}`} />
              )}
              <div className="gc-month-bar" style={{ height: `${actual}%` }} title={`${m.label}: ${gbp(m.usd, rate)} spent`} />
            </div>
            <div className="gc-month-label">{m.label}{m.projectedUsd != null && <span> (proj.)</span>}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- page */

export default async function FleetCostsPage() {
  let data = null;
  let error = null;
  try {
    data = await fleetCosts();
  } catch (e) {
    error = e.message;
  }

  const head = (
    <header className="fleet-head">
      <div>
        <span className="micro">Cogent Incubator</span>
        <h1>Group costs</h1>
      </div>
      <FleetNav />
    </header>
  );

  if (error) {
    return (
      <main className="fleet-wrap">
        {head}
        <p style={{ color: "#fca5a5" }}>Could not read the numbers: {error}</p>
      </main>
    );
  }

  const { titles, subscriptions, subscriptionsEntered, byAgent, totals, month, running, months, rate } = data;
  const dayNo = Math.ceil(month.daysElapsed);
  const titleMax = Math.max(...titles.map((t) => t.projectedUsd), 1);
  const agentTotal = byAgent.reduce((n, a) => n + a.thisUsd, 0);
  const confirmCount = subscriptions.filter((s) => s.confirm).length;

  return (
    <main className="fleet-wrap">
      {head}

      {/* ---- The three numbers. */}
      <section className="gc-heroes">
        <Hero
          label={`Spent so far · ${month.label}`}
          value={gbp(totals.thisUsd, rate)}
          delta={<Delta now={totals.thisUsd} then={totals.prevSamePointUsd} against={`vs ${gbp(totals.prevSamePointUsd, rate)} by day ${dayNo} of ${month.prevLabel}`} />}
          sub={`Day ${dayNo} of ${month.daysInMonth}`}
        />
        <Hero
          tone="accent"
          label={`Projected · ${month.label}`}
          value={gbp(totals.projectedUsd, rate)}
          delta={<Delta now={totals.projectedUsd} then={totals.prevUsd} against={`vs ${month.prevLabel}`} />}
          sub={`Spent so far + ${gbp(totals.dailyRateUsd, rate, { exact: true })} a day for the ${Math.round(month.daysLeft)} days left`}
        />
        <Hero
          label={`Last month · ${month.prevLabel}`}
          value={gbp(totals.prevUsd, rate)}
          sub={`${totals.publishedPrev} articles published`}
        />
      </section>

      {/* ---- Smaller supporting figures. */}
      <section className="gc-minis">
        <div className="gc-mini">
          <div className="gc-mini-value num">{pence(totals.perArticleUsd, rate)}</div>
          <div className="gc-mini-label">per article, all-in</div>
          <div className="gc-mini-sub">
            {totals.producedThis} produced this month
            {totals.perArticlePrevUsd != null && <> · {pence(totals.perArticlePrevUsd, rate)} in {month.prevLabel}</>}
          </div>
        </div>
        <div className="gc-mini">
          <div className="gc-mini-value num">{totals.publishedThis}</div>
          <div className="gc-mini-label">published so far</div>
          <div className="gc-mini-sub">{titles.length} titles · {totals.publishedPrev} in all of {month.prevLabel}</div>
        </div>
        <div className="gc-mini">
          <div className="gc-mini-value num">{gbp(totals.dailyRateUsd, rate, { exact: true })}</div>
          <div className="gc-mini-label">a day, right now</div>
          <div className="gc-mini-sub">average over the last 7 days</div>
        </div>
        <div className="gc-mini">
          <div className="gc-mini-value num">{gbp(totals.fixedUsd, rate, { exact: true })}</div>
          <div className="gc-mini-label">fixed bills a month</div>
          <div className="gc-mini-sub">domains and subscriptions</div>
        </div>
      </section>

      {!subscriptionsEntered && (
        <div className="gc-warn">
          <strong>Software bills are not in these totals yet.</strong> Vercel, Neon, Mailchimp and the other
          shared subscriptions are still at the £0 placeholder ({confirmCount} marked to confirm). Everything
          else here is measured; the real monthly total is higher by whatever those bills come to.
        </div>
      )}

      {/* ---- Pace. */}
      <section className="gc-panel">
        <div className="gc-panel-head">
          <h2>Running total this month</h2>
          <div className="gc-legend">
            <span><i style={{ background: THIS }} /> {month.label}</span>
            <span><i className="is-dash" style={{ borderColor: THIS }} /> projected</span>
            <span><i style={{ background: PREV, opacity: 0.7 }} /> {month.prevLabel}</span>
          </div>
        </div>
        <RunningTotal running={running} month={month} totals={totals} rate={rate} />
      </section>

      <div className="gc-two">
        {/* ---- Month by month. */}
        <section className="gc-panel">
          <div className="gc-panel-head"><h2>Month by month</h2></div>
          <MonthBars months={months} rate={rate} />
        </section>

        {/* ---- What it is spent on. */}
        <section className="gc-panel">
          <div className="gc-panel-head">
            <h2>What it is spent on</h2>
            <span className="gc-panel-note">{month.label} so far</span>
          </div>
          <div className="gc-bars">
            {byAgent.filter((a) => a.thisUsd * rate >= 0.005).map((a) => (
              <div key={a.agent} className="gc-bar-row">
                <div className="gc-bar-top">
                  <span>{AGENT_LABELS[a.agent] || a.agent}</span>
                  <span className="num">
                    <strong>{gbp(a.thisUsd, rate)}</strong>
                    <span className="gc-bar-pct"> {agentTotal ? Math.round((a.thisUsd / agentTotal) * 100) : 0}%</span>
                  </span>
                </div>
                <div className="gc-track">
                  <div className="gc-fill" style={{ width: `${Math.max(1.5, (a.thisUsd / agentTotal) * 100)}%` }} />
                </div>
              </div>
            ))}
            {!agentTotal && <p className="gc-panel-note">Nothing spent yet this month.</p>}
          </div>
        </section>
      </div>

      {/* ---- By title. */}
      <section className="gc-panel">
        <div className="gc-panel-head">
          <h2>By title</h2>
          <span className="gc-panel-note">bar = projected for {month.label}; solid part is spent so far</span>
        </div>
        <div className="gc-titles">
          {titles.map((t) => (
            <Link key={t.id} href={`/s/${t.slug}/engine-room/costs`} className="gc-title">
              <div className="gc-title-name">
                <span className="gc-dot" style={{ background: t.accentHex }} />
                {t.name}
              </div>
              <div className="gc-title-figs num">
                <span className="gc-title-big">{gbp(t.projectedUsd, rate)}</span>
                <span className="gc-title-tag">projected</span>
                <span className="gc-title-small">
                  {gbp(t.thisUsd, rate)} so far · {gbp(t.prevUsd, rate)} last month
                </span>
              </div>
              <div className="gc-track gc-track-lg">
                <div className="gc-fill is-ghost" style={{ width: `${(t.projectedUsd / titleMax) * 100}%` }} />
                <div className="gc-fill" style={{ width: `${(t.thisUsd / titleMax) * 100}%` }} />
              </div>
              <div className="gc-title-meta">
                {t.launchedLastMonth ? (
                  <span className="gc-delta is-flat">launched in {month.prevLabel}</span>
                ) : (
                  <Delta now={t.projectedUsd} then={t.prevUsd} against={`vs ${month.prevLabel}`} />
                )}
                <span>{t.publishedThis} published</span>
                <span>{t.perArticleUsd != null ? `${pence(t.perArticleUsd, rate)} per article` : "nothing produced yet"}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- The declared bills, kept but quiet. */}
      <details className="gc-panel gc-subs">
        <summary><h2>Software and subscriptions</h2><span className="gc-panel-note">shared across every title · {gbp(totals.subscriptionsUsd, rate, { exact: true })} a month</span></summary>
        <table>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.key}>
                <td>
                  {s.label}
                  {s.confirm && <span className="gc-confirm">confirm</span>}
                  {s.note && <div className="gc-note">{s.note}</div>}
                </td>
                <td className="num">{Number(s.monthlyUsd) ? gbp(Number(s.monthlyUsd), rate, { exact: true }) : <span style={{ opacity: 0.4 }}>£0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="gc-foot">
        AI spend is measured from real token usage on every agent run and every batch-written article.
        Fixed bills count in full from the 1st. The projection is spend so far plus the last seven days&apos;
        daily rate for the rest of the month. Months run midnight to midnight UTC. Converted at {rate} USD to GBP.
      </p>
    </main>
  );
}
