import { costReport } from "@/lib/cost-report";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

// The director's monthly cost report, as one A4 page.
//
// Deliberately not the Group costs page printed: the director wants the month
// that has just closed, the big numbers and one picture, and none of the
// per-title or per-job breakdown. Laid out at A4 so "Save as PDF" from the
// browser produces the file to send, with no PDF library to run on Vercel.
//
// Light paper rather than the app's dark theme: this gets printed and read on
// phones in email previews, where a black page reads as a broken attachment.

const BLUE = "#2E3EEE";
const CYAN = "#0891b2";
const INK = "#0f172a";
const INK_2 = "#64748b";
const LINE = "#e2e8f0";

function gbp(usd, rate, dp) {
  if (usd == null) return "—";
  const v = usd * rate;
  const d = dp ?? (Math.abs(v) >= 100 ? 0 : 2);
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
const pence = (usd, rate) => {
  if (usd == null) return "—";
  const p = usd * rate * 100;
  return p >= 100 ? `£${(p / 100).toFixed(2)}` : `${Math.round(p)}p`;
};
const num = (n) => (n == null ? "—" : n.toLocaleString("en-GB"));

function Change({ now, then, vs, upIsGood = false }) {
  if (!then) return null;
  const pct = ((now - then) / then) * 100;
  if (Math.abs(pct) < 2) return <span className="rp-chg is-flat">about the same as {vs}</span>;
  const up = pct > 0;
  const good = up === upIsGood;
  return (
    <span className={`rp-chg ${good ? "is-good" : "is-bad"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% on {vs}
    </span>
  );
}

const longMonth = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });

function MonthChart({ months, rate }) {
  const W = 640, H = 200, L = 8, R = 8, T = 34, B = 30;
  const max = Math.max(...months.map((m) => m.projectedUsd ?? m.usd), 1) * 1.05;
  const slot = (W - L - R) / months.length;
  const bw = Math.min(96, slot * 0.56);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spend by month">
      <defs>
        <linearGradient id="rp-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f5cff" />
          <stop offset="100%" stopColor={BLUE} />
        </linearGradient>
        <pattern id="rp-stripe" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#e0f2fe" />
          <rect width="3.5" height="8" fill="#7dd3fc" />
        </pattern>
      </defs>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={LINE} strokeWidth="1.5" />
      {months.map((m, i) => {
        const cx = L + slot * i + slot / 2;
        const x = cx - bw / 2;
        const current = m.projectedUsd != null;
        const top = current ? m.projectedUsd : m.usd;
        const fill = m.isPrev ? "url(#rp-bar)" : current ? CYAN : "#cbd5e1";
        return (
          <g key={m.key}>
            {current && (
              <rect x={x} y={y(m.projectedUsd)} width={bw} height={y(m.usd) - y(m.projectedUsd)} rx="6"
                fill="url(#rp-stripe)" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
            )}
            <rect x={x} y={y(m.usd)} width={bw} height={Math.max(2, H - B - y(m.usd))} rx="6" fill={fill} />
            <text x={cx} y={y(top) - 10} textAnchor="middle" fontSize="17" fontWeight="800" fill={INK}>
              {gbp(top, rate, 0)}
            </text>
            <text x={cx} y={H - 9} textAnchor="middle" fontSize="12.5" fontWeight={m.isPrev ? 800 : 600}
              fill={m.isPrev ? INK : INK_2}>
              {longMonth(m.key)}{current ? " (projected)" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The month the report covers, named for the tab title — which is also the PDF's file name. */
export async function generateMetadata() {
  const { reportMonth } = await import("@/lib/cost-report");
  return { title: `Cogent cost report – ${reportMonth()}` };
}

export default async function CostReportPage({ searchParams }) {
  const autoPrint = (await searchParams)?.print === "1";
  let r = null;
  let error = null;
  try {
    r = await costReport();
  } catch (e) {
    error = e.message;
  }
  if (error) return <main style={{ padding: 40 }}>Could not build the report: {error}</main>;

  const { rate, lastMonth: lm, thisMonth: tm, months } = r;
  const now = r.generatedAt;
  const reportYear = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).getUTCFullYear();
  const splitTotal = lm.split.reduce((n, s) => n + s.usd, 0) || 1;
  const SPLIT_COLOURS = [BLUE, CYAN, "#94a3b8"];
  const perThousandReads = lm.reads ? (lm.totalUsd / lm.reads) * 1000 : null;

  return (
    <div className="rp-shell">
      <style>{CSS}</style>
      <div className="rp-toolbar">
        <a href="/costs" className="rp-back">← Group costs</a>
        <PrintButton auto={autoPrint} />
      </div>

      <article className="rp-page">
        <header className="rp-head">
          <div>
            <div className="rp-kicker">Cogent Incubator · Monthly cost report</div>
            <h1>{lm.label} {reportYear}</h1>
          </div>
          <div className="rp-prepared">
            Prepared {now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })}
          </div>
        </header>

        <section className="rp-heroes">
          <div className="rp-hero">
            <div className="rp-label">Spent in {lm.label}</div>
            <div className="rp-big">{gbp(lm.totalUsd, rate, 0)}</div>
            {lm.beforeUsd != null && <Change now={lm.totalUsd} then={lm.beforeUsd} vs={`${lm.beforeLabel} (${gbp(lm.beforeUsd, rate, 0)})`} />}
          </div>
          <div className="rp-hero is-proj">
            <div className="rp-label">Projected for {tm.label}</div>
            <div className="rp-big">{gbp(tm.projectedUsd, rate, 0)}</div>
            <Change now={tm.projectedUsd} then={lm.totalUsd} vs={lm.label} />
            <div className="rp-sub">
              {gbp(tm.soFarUsd, rate)} spent by day {Math.ceil(tm.daysElapsed)} of {tm.daysInMonth}, running at {gbp(tm.dailyUsd, rate)} a day
            </div>
          </div>
        </section>

        <section className="rp-tiles">
          <div className="rp-tile">
            <div className="rp-tile-v">{pence(lm.perArticleUsd, rate)}</div>
            <div className="rp-tile-l">Cost per article</div>
            <div className="rp-tile-s">AI only, {num(lm.produced)} produced</div>
          </div>
          <div className="rp-tile">
            <div className="rp-tile-v">{num(lm.published)}</div>
            <div className="rp-tile-l">Articles published</div>
            <div className="rp-tile-s">across all titles</div>
          </div>
          <div className="rp-tile">
            <div className="rp-tile-v">{lm.readsConnected ? num(lm.reads) : "—"}</div>
            <div className="rp-tile-l">Article reads</div>
            <div className="rp-tile-s">
              {lm.readsConnected ? (
                <>page views{lm.readsBefore ? <> · {num(lm.readsBefore)} in {lm.beforeLabel}</> : null}</>
              ) : "analytics not connected"}
            </div>
          </div>
          <div className="rp-tile">
            <div className="rp-tile-v">{gbp(lm.dailyUsd, rate)}</div>
            <div className="rp-tile-l">Average a day</div>
            <div className="rp-tile-s">{gbp(tm.dailyUsd, rate)} a day this month</div>
          </div>
        </section>

        <section className="rp-card">
          <h2>Spend by month</h2>
          <MonthChart months={months} rate={rate} />
        </section>

        <section className="rp-card">
          <h2>Where {lm.label}&apos;s money went</h2>
          <div className="rp-stack">
            {lm.split.map((s, i) => (
              <div key={s.key} style={{ width: `${(s.usd / splitTotal) * 100}%`, background: SPLIT_COLOURS[i] }} />
            ))}
          </div>
          <div className="rp-split">
            {lm.split.map((s, i) => (
              <div key={s.key} className="rp-split-row">
                <span className="rp-swatch" style={{ background: SPLIT_COLOURS[i] }} />
                <span className="rp-split-l">{s.label}</span>
                <span className="rp-split-v">{gbp(s.usd, rate, 2)}</span>
                <span className="rp-split-p">{Math.round((s.usd / splitTotal) * 100)}%</span>
              </div>
            ))}
            <div className="rp-split-row is-total">
              <span className="rp-swatch" style={{ background: "transparent" }} />
              <span className="rp-split-l">Total</span>
              <span className="rp-split-v">{gbp(lm.totalUsd, rate, 2)}</span>
              <span className="rp-split-p" />
            </div>
          </div>
          {perThousandReads != null && (
            <p className="rp-aside">That is {gbp(perThousandReads, rate)} for every 1,000 article reads.</p>
          )}
        </section>

        <footer className="rp-foot">
          <p>
            AI usage is measured from every model call the system makes. The projection is spend so far plus
            the last seven days&apos; daily rate for the rest of the month. Cost per article is the month&apos;s AI
            usage divided by every article produced, including any not published; software and domains are left out. Reads are Google
            Analytics page views{lm.readsConnected < lm.readsOf ? ` for the ${lm.readsConnected} of ${lm.readsOf} titles connected` : ""}.
            Dollar costs converted at {rate}.
          </p>
        </footer>
      </article>
    </div>
  );
}

const CSS = `
.rp-shell { min-height: 100vh; background: #0b1022; padding: 24px 16px 60px; }
.rp-toolbar { max-width: 794px; margin: 0 auto 14px; display: flex; justify-content: space-between; align-items: center; }
.rp-back { color: #8b97c6; text-decoration: none; font-size: 14px; }
.rp-page {
  width: 794px; max-width: 100%; min-height: 1123px; margin: 0 auto; box-sizing: border-box;
  background: #fff; color: ${INK}; padding: 38px 48px 30px; border-radius: 4px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
  font-family: inherit; -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.rp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 18px; border-bottom: 3px solid ${BLUE}; }
.rp-kicker { font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: ${BLUE}; }
.rp-head h1 { margin: 6px 0 0; font-size: 38px; font-weight: 800; letter-spacing: -.02em; color: ${INK}; }
.rp-prepared { font-size: 12px; color: ${INK_2}; }

.rp-heroes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 22px; }
.rp-hero { border: 1px solid ${LINE}; border-radius: 14px; padding: 18px 20px; background: #f8fafc; }
.rp-hero.is-proj { background: linear-gradient(150deg, #eef2ff, #ecfeff); border-color: #c7d2fe; }
.rp-label { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: ${INK_2}; }
.rp-big { font-size: 60px; line-height: 1.05; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 8px; color: ${INK}; }
.rp-hero.is-proj .rp-big { color: ${BLUE}; }
.rp-chg { display: inline-block; font-size: 12.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.rp-chg.is-bad  { background: #fef3c7; color: #92400e; }
.rp-chg.is-good { background: #d1fae5; color: #065f46; }
.rp-chg.is-flat { background: #f1f5f9; color: ${INK_2}; }
.rp-sub { font-size: 12px; color: ${INK_2}; margin-top: 8px; }

.rp-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
.rp-tile { border: 1px solid ${LINE}; border-radius: 12px; padding: 13px 14px; }
.rp-tile-v { font-size: 27px; font-weight: 800; letter-spacing: -.02em; color: ${INK}; }
.rp-tile-l { font-size: 12.5px; font-weight: 700; margin-top: 2px; color: ${INK}; }
.rp-tile-s { font-size: 11px; color: ${INK_2}; margin-top: 2px; }

.rp-card { border: 1px solid ${LINE}; border-radius: 14px; padding: 16px 20px; margin-top: 14px; }
.rp-card h2 { margin: 0 0 10px; font-size: 15px; font-weight: 800; color: ${INK}; }

.rp-stack { display: flex; gap: 3px; height: 20px; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
.rp-stack > div { min-width: 3px; }
.rp-split-row { display: grid; grid-template-columns: 14px 1fr auto 44px; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid #f1f5f9; font-size: 14px; }
.rp-split-row.is-total { border-top: 2px solid ${LINE}; font-weight: 800; }
.rp-swatch { width: 12px; height: 12px; border-radius: 3px; }
.rp-split-v { font-weight: 800; text-align: right; }
.rp-split-p { text-align: right; color: ${INK_2}; font-size: 12.5px; }
.rp-aside { margin: 10px 0 0; font-size: 12.5px; color: ${INK_2}; }

.rp-foot { margin-top: 16px; font-size: 10.5px; line-height: 1.55; color: ${INK_2}; }
.rp-foot p { margin: 0 0 6px; }

@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .rp-shell { padding: 0; background: #fff; min-height: 0; }
  .rp-toolbar { display: none; }
  .rp-page { box-shadow: none; border-radius: 0; width: 210mm; min-height: 297mm; }
}
@media screen and (max-width: 820px) {
  .rp-page { padding: 24px 18px; min-height: 0; }
  .rp-heroes { grid-template-columns: 1fr; }
  .rp-tiles { grid-template-columns: 1fr 1fr; }
  .rp-big { font-size: 46px; }
}
`;
