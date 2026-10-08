import Link from "next/link";
import FleetNav from "../components/FleetNav";
import { fleetCosts, AGENT_LABELS } from "@/lib/fleet-costs";
import { SERIES } from "@/app/components/CostCharts";
import { canEdit } from "@/lib/permissions";
import { updateFleetSubscription, addFleetSubscription, removeFleetSubscription } from "@/lib/actions";

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
  const W = 860, H = 330, L = 52, R = 118, T = 30, B = 34;
  const days = Math.max(month.daysInMonth, month.prevDays);
  const yMax = Math.max(totals.projectedUsd, totals.prevUsd, 1) * 1.12;
  const x = (d) => L + (d / days) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const floor = y(0);

  // Day 0 is the 1st at midnight, where the month's fixed bills already sit.
  const pts = (vals, lastX) => [
    [x(0), y(totals.fixedUsd)],
    ...vals.map((v, i) => [x(lastX && i === vals.length - 1 ? lastX : i + 1), y(v)]),
  ];
  const path = (p) => p.map(([px, py], i) => `${i ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = (p) => `${path(p)} L ${p.at(-1)[0].toFixed(1)} ${floor} L ${p[0][0].toFixed(1)} ${floor} Z`;

  const todayX = month.daysElapsed;
  const thisPts = pts(running.this, todayX);
  const prevPts = pts(running.prev);
  const [tx, ty] = [x(todayX), y(totals.thisUsd)];
  const [ex, ey] = [x(month.daysInMonth), y(totals.projectedUsd)];
  const ticks = niceTicks(yMax * rate).map((g) => g / rate);


  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="gc-chart" role="img"
      aria-label={`Running total: ${gbp(totals.thisUsd, rate)} so far, projected ${gbp(totals.projectedUsd, rate)}, against ${gbp(totals.prevUsd, rate)} last month`}>
      <defs>
        <linearGradient id="gc-area-this" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={THIS} stopOpacity="0.55" />
          <stop offset="100%" stopColor={THIS} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gc-area-prev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PREV} stopOpacity="0.16" />
          <stop offset="100%" stopColor={PREV} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gc-area-proj" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={THIS} stopOpacity="0.16" />
          <stop offset="100%" stopColor={THIS} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gc-line-this" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5ab0ff" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="gc-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t ? "3 6" : undefined} />
          <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={INK_2}>£{Math.round(t * rate).toLocaleString("en-GB")}</text>
        </g>
      ))}
      {[1, 8, 15, 22, days].map((d) => (
        <text key={d} x={x(d - 0.5)} y={H - 10} textAnchor="middle" fontSize="12" fill={INK_2}>{d}</text>
      ))}

      {/* Last month, for comparison: quiet, behind everything. */}
      <path d={area(prevPts)} fill="url(#gc-area-prev)" />
      <path d={path(prevPts)} fill="none" stroke={PREV} strokeWidth="2" strokeOpacity="0.75" strokeLinejoin="round" />
      <circle cx={prevPts.at(-1)[0]} cy={prevPts.at(-1)[1]} r="4" fill={PREV} />
      <Pill cx={prevPts.at(-1)[0] + 10} cy={prevPts.at(-1)[1]} anchor="start" size={12}
        text={`${month.prevLabel.slice(0, 3)} ${gbp(totals.prevUsd, rate)}`} fill="rgba(139,151,198,.18)" ink="#c7cff0" />

      {/* Projection: a soft wedge and a dashed line to the month end. */}
      <path d={`M ${tx} ${ty} L ${ex} ${ey} L ${ex} ${floor} L ${tx} ${floor} Z`} fill="url(#gc-area-proj)" />
      <path d={`M ${tx} ${ty} L ${ex} ${ey}`} fill="none" stroke={THIS} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="9" fill="none" stroke={THIS} strokeOpacity="0.35" strokeWidth="6" />
      <circle cx={ex} cy={ey} r="5" fill="#0b1022" stroke="#5ab0ff" strokeWidth="3" />
      <Pill cx={ex + 14} cy={ey} anchor="start" size={15} text={gbp(totals.projectedUsd, rate)} fill={THIS} ink="#ffffff" />
      <text x={ex + 16} y={ey + 30} fontSize="11" fontWeight="700" letterSpacing="1.2" fill="#8fc2ff">PROJECTED</text>

      {/* This month so far: the hero line, glowing. */}
      <path d={area(thisPts)} fill="url(#gc-area-this)" />
      <path d={path(thisPts)} fill="none" stroke="url(#gc-line-this)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" filter="url(#gc-glow)" />
      <line x1={tx} x2={tx} y1={T - 6} y2={floor} stroke="#5ab0ff" strokeOpacity="0.4" strokeDasharray="2 5" />
      <circle className="gc-pulse" cx={tx} cy={ty} r="7" fill="#22d3ee" />
      <circle cx={tx} cy={ty} r="7" fill="#22d3ee" stroke="#0b1022" strokeWidth="2.5">
        <title>{`Spent so far: ${gbp(totals.thisUsd, rate)}`}</title>
      </circle>
      <Pill cx={tx} cy={ty - 26} size={13} text={gbp(totals.thisUsd, rate)} fill="#22d3ee" ink="#05070f" />
      <text x={tx} y={T - 12} textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="1.2" fill="#8fc2ff">TODAY</text>
    </svg>
  );
}

// A pill-shaped label: SVG has no auto-sizing box, so the width is
// estimated from the character count, which is close enough at these sizes.
function Pill({ cx, cy, text, fill, ink, size = 13, anchor = "middle" }) {
  const w = text.length * size * 0.6 + 18;
  const left = anchor === "start" ? cx : cx - w / 2;
  return (
    <g>
      <rect x={left} y={cy - size} width={w} height={size * 2} rx={size} fill={fill} />
      <text x={left + w / 2} y={cy + size * 0.36} textAnchor="middle" fontSize={size} fontWeight="800" fill={ink}>{text}</text>
    </g>
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
      {months.map((m, i) => {
        const actual = (m.usd / max) * 100;
        const projected = m.projectedUsd != null ? ((m.projectedUsd - m.usd) / max) * 100 : 0;
        const shown = m.projectedUsd ?? m.usd;
        const before = months[i - 1];
        return (
          <div key={m.key} className={`gc-month${m.projectedUsd != null ? " is-current" : ""}`}>
            <div className="gc-month-value num">{gbp(shown, rate)}</div>
            <div className="gc-month-chip">
              {before ? <Delta now={shown} then={before.projectedUsd ?? before.usd} /> : <span className="gc-delta is-flat">first month</span>}
            </div>
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
  const editable = await canEdit();
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

  const { titles, subscriptions, unconfirmed, byAgent, totals, month, running, months, rate } = data;
  const dayNo = Math.ceil(month.daysElapsed);
  const titleMax = Math.max(...titles.map((t) => t.projectedUsd), 1);
  const agentTotal = byAgent.reduce((n, a) => n + a.thisUsd, 0);
  // Largest first, each in its own hue from the validated set; the long tail
  // shares one slate so a fifth colour never stands for "£0.24 of images".
  const spend = byAgent
    .filter((a) => a.thisUsd * rate >= 0.005)
    .map((a, i) => ({
      ...a,
      label: AGENT_LABELS[a.agent] || a.agent,
      colour: i < SERIES.length ? SERIES[i] : "#64748b",
      pct: agentTotal ? Math.round((a.thisUsd / agentTotal) * 100) : 0,
    }));

  return (
    <main className="fleet-wrap">
      {head}

      <div className="gc-actions">
        <a href="/costs/report?print=1" target="_blank" rel="noopener" className="gc-btn gc-btn-lg">
          Director report (PDF)
        </a>
        <span className="gc-panel-note">covers {month.prevLabel}, with {month.label}&apos;s projection</span>
      </div>

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
          <div className="gc-mini-label">per article, AI only</div>
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

      {unconfirmed.length > 0 && (
        <a href="#subscriptions" className="gc-warn">
          <strong>{unconfirmed.length} bill{unconfirmed.length === 1 ? " is" : "s are"} not in these totals yet:</strong>{" "}
          {unconfirmed.join(", ")}. They count as £0 until a figure is saved below. Everything else here is measured.
        </a>
      )}

      {/* ---- Pace. */}
      <section className="gc-panel">
        <div className="gc-panel-head">
          <h2>Running total this month</h2>
          <div className="gc-legend">
            <span className="gc-key"><i style={{ background: "#22d3ee" }} />{month.label} so far <b className="num">{gbp(totals.thisUsd, rate)}</b></span>
            <span className="gc-key"><i className="is-dash" style={{ borderColor: THIS }} />Projected <b className="num">{gbp(totals.projectedUsd, rate)}</b></span>
            <span className="gc-key"><i style={{ background: PREV }} />{month.prevLabel} <b className="num">{gbp(totals.prevUsd, rate)}</b></span>
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
          {agentTotal > 0 && (
            <div className="gc-stack">
              {spend.map((a) => (
                <div key={a.agent} style={{ width: `${(a.thisUsd / agentTotal) * 100}%`, background: a.colour }}
                  title={`${a.label}: ${gbp(a.thisUsd, rate)}`} />
              ))}
            </div>
          )}
          <div className="gc-bars">
            {spend.map((a) => (
              <div key={a.agent} className="gc-bar-row">
                <span className="gc-bar-pct num" style={{ color: a.colour }}>{a.pct}%</span>
                <div className="gc-bar-main">
                  <div className="gc-bar-top">
                    <span>{a.label}</span>
                    <strong className="num">{gbp(a.thisUsd, rate)}</strong>
                  </div>
                  <div className="gc-track">
                    <div className="gc-fill" style={{ width: `${Math.max(1.5, (a.thisUsd / agentTotal) * 100)}%`, background: `linear-gradient(90deg, ${a.colour}99, ${a.colour})`, boxShadow: `0 0 12px ${a.colour}66` }} />
                  </div>
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

      {/* ---- The declared bills, editable in place. */}
      <section className="gc-panel gc-subs" id="subscriptions">
        <div className="gc-panel-head">
          <h2>Software and subscriptions</h2>
          <span className="gc-panel-note">
            shared across every title · <strong className="num">{gbp(totals.subscriptionsUsd, rate, { exact: true })}</strong> a month
          </span>
        </div>
        <div className="gc-sub-list">
          {subscriptions.map((s) => {
            const currency = s.currency || "GBP";
            const amount = s.amount ?? Math.round((Number(s.monthlyUsd) || 0) * rate * 100) / 100;
            return (
              <div key={s.key} className={`gc-sub${s.confirm ? " is-confirm" : ""}`}>
                <div className="gc-sub-name">
                  <span>{s.label}</span>
                  {s.confirm && <span className="gc-confirm">to confirm</span>}
                  {s.note && <div className="gc-note">{s.note}</div>}
                </div>
                {editable ? (
                  <>
                    <form action={updateFleetSubscription} className="gc-sub-form">
                      <input type="hidden" name="key" value={s.key} />
                      <select name="currency" defaultValue={currency} aria-label={`${s.label} currency`}>
                        <option value="GBP">£</option>
                        <option value="USD">$</option>
                      </select>
                      <input name="amount" type="number" step="0.01" min="0" defaultValue={amount}
                        aria-label={`${s.label} monthly cost`} />
                      <button type="submit" className="gc-btn">Save</button>
                    </form>
                    <form action={removeFleetSubscription}>
                      <input type="hidden" name="key" value={s.key} />
                      <button type="submit" className="gc-btn-x" title={`Remove ${s.label}`} aria-label={`Remove ${s.label}`}>×</button>
                    </form>
                  </>
                ) : (
                  <span className="gc-sub-value num">{currency === "USD" ? `$${amount.toFixed(2)}` : `£${amount.toFixed(2)}`}</span>
                )}
                {currency === "USD" && Number(s.monthlyUsd) > 0 && (
                  <span className="gc-sub-conv num">≈ {gbp(Number(s.monthlyUsd), rate, { exact: true })}</span>
                )}
              </div>
            );
          })}
        </div>
        {editable && (
          <form action={addFleetSubscription} className="gc-sub-add">
            <input name="label" placeholder="Add a subscription, e.g. Canva" required maxLength={80} aria-label="New subscription name" />
            <select name="currency" defaultValue="GBP" aria-label="New subscription currency">
              <option value="GBP">£</option>
              <option value="USD">$</option>
            </select>
            <input name="amount" type="number" step="0.01" min="0" placeholder="per month" required aria-label="New subscription monthly cost" />
            <button type="submit" className="gc-btn">Add</button>
          </form>
        )}
        <p className="gc-note" style={{ marginTop: 10 }}>
          Monthly cost of each bill, in the currency the invoice is in. Annual plans: divide by twelve.
          Dollar bills convert at {rate}.
        </p>
      </section>

      <p className="gc-foot">
        AI spend is measured from real token usage on every agent run and every batch-written article.
        Fixed bills count in full from the 1st. The projection is spend so far plus the last seven days&apos;
        daily rate for the rest of the month. Months run midnight to midnight UTC. Converted at {rate} USD to GBP.
      </p>
    </main>
  );
}
