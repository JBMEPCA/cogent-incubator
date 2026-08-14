import Link from "next/link";
import { fleetCosts } from "@/lib/fleet-costs";

export const dynamic = "force-dynamic";

// What the whole operation costs.
//
// The per-title Costs tab answers "is this magazine worth running". This page
// answers "what am I spending, in total, and on what" — which is a different
// question the moment there is more than one title, and the one that decides
// whether a third is affordable.

const SURFACE = { background: "var(--surface-2, #111a36)", border: "1px solid rgba(255,255,255,.07)" };

const gbp = (usd, rate) =>
  usd == null ? "—" : `£${(usd * rate).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pence = (usd, rate) => (usd == null ? "—" : `${Math.round(usd * rate * 100)}p`);

const AGENT_LABELS = {
  director: "Director", editor: "Editor", researcher: "Researcher", seo: "SEO Expert",
  designer: "Graphic Designer", finance: "Finance Manager", linkedin: "LinkedIn Manager",
  backlink: "Backlink Manager", newsletter: "Newsletter Manager",
};

function Stat({ label, value, hint, tone }) {
  return (
    <div style={{ ...SURFACE, flex: 1, minWidth: 170, padding: "14px 16px", borderRadius: 12 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 3, color: tone }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** A proportion bar. Reads faster than a column of numbers for "where does it go". */
function Bar({ parts, total }) {
  if (!total) return null;
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.06)" }}>
      {parts
        .filter((p) => p.usd > 0)
        .map((p) => (
          <div
            key={p.key}
            title={`${p.label}: ${((p.usd / total) * 100).toFixed(1)}%`}
            style={{ width: `${(p.usd / total) * 100}%`, background: p.colour }}
          />
        ))}
    </div>
  );
}

export default async function FleetCostsPage() {
  let data = null;
  let error = null;
  try {
    data = await fleetCosts({ days: 30 });
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <main className="fleet-wrap">
        <header className="fleet-head">
          <div><span className="micro">Cogent Incubator</span><h1>Spend</h1></div>
          <Link href="/" className="nav-link">Back to all titles</Link>
        </header>
        <p style={{ color: "#fca5a5" }}>Could not read the numbers: {error}</p>
      </main>
    );
  }

  const { titles, subscriptions, fleetByAgent, totals, rate } = data;

  const split = [
    { key: "model", label: "AI model spend", usd: totals.modelMonthUsd, colour: "#2E3EEE" },
    { key: "subs", label: "Shared subscriptions", usd: totals.fleetSubscriptionsUsd, colour: "#059669" },
    { key: "fixed", label: "Per-title fixed", usd: totals.titleFixedUsd, colour: "#d97706" },
  ];

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Spend</h1>
        </div>
        <Link href="/" className="nav-link">Back to all titles</Link>
      </header>

      <p style={{ fontSize: 13.5, opacity: 0.65, margin: "0 0 6px" }}>
        Everything the operation costs this month. Model spend is measured from real token usage on
        every agent run; subscriptions are declared. Converted at {rate} USD to GBP.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="Total this month" value={gbp(totals.monthUsd, rate)} hint={`${titles.length} title${titles.length === 1 ? "" : "s"}`} />
        <Stat label="AI model spend" value={gbp(totals.modelMonthUsd, rate)} hint="measured, per run" />
        {/*
          One per-article figure, not two. An earlier version showed the
          production cost beside a total-spend-divided-by-output number, which
          looked like the same measure disagreeing with itself. The second one
          is still worth having, so it sits in the detail line under each title
          rather than in a headline tile competing with this.
        */}
        <Stat
          label="Per article"
          value={pence(totals.medianArticleUsd, rate)}
          hint={`typical cost to write one, from ${totals.producedCount} articles`}
        />
      </div>

      <section style={{ ...SURFACE, borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>Where it goes</h2>
        <Bar parts={split} total={totals.monthUsd} />
        <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap", fontSize: 12.5 }}>
          {split.map((p) => (
            <span key={p.key} style={{ opacity: 0.75 }}>
              <span style={{ color: p.colour }}>&#9632;</span> {p.label} — {gbp(p.usd, rate)}
            </span>
          ))}
        </div>
      </section>

      {/* By title, with each title's own agents underneath it. */}
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>By title</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {titles.map((t) => (
            <div key={t.id} style={{ ...SURFACE, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.accentHex, display: "inline-block" }} />
                <Link href={`/s/${t.slug}/engine-room/costs`} style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                  {t.name}
                </Link>
                <span className="micro" style={{ opacity: 0.5 }}>
                  {t.engineEnabled ? "engine on" : "engine off"} · {t.status}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700 }}>{gbp(t.totalMonthUsd, rate)}</span>
                <span className="micro" style={{ opacity: 0.5 }}>/month</span>
              </div>

              <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, opacity: 0.65, flexWrap: "wrap" }}>
                <span>model {gbp(t.modelMonthUsd, rate)}</span>
                <span>fixed {gbp(t.fixedUsd, rate)}</span>
                <span>share of shared {gbp(t.shareOfFleetUsd, rate)}</span>
                <span>{t.publishedThisMonth} published</span>
                <span>{t.medianArticleUsd != null ? `${pence(t.medianArticleUsd, rate)} per article` : "nothing produced yet"}</span>
              </div>

              {t.agents.length > 0 && (
                <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ opacity: 0.5, textAlign: "left" }}>
                      <th style={{ fontWeight: 500, padding: "4px 0" }}>Agent (last {data.days} days)</th>
                      <th style={{ fontWeight: 500, textAlign: "right" }}>Runs</th>
                      <th style={{ fontWeight: 500, textAlign: "right" }}>In</th>
                      <th style={{ fontWeight: 500, textAlign: "right" }}>Out</th>
                      <th style={{ fontWeight: 500, textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.agents.map((a) => (
                      <tr key={a.agent} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                        <td style={{ padding: "4px 0" }}>{AGENT_LABELS[a.agent] || a.agent}</td>
                        <td style={{ textAlign: "right", opacity: 0.7 }}>{a.runs}</td>
                        <td style={{ textAlign: "right", opacity: 0.55 }}>{(a.inputTokens / 1000).toFixed(0)}k</td>
                        <td style={{ textAlign: "right", opacity: 0.55 }}>{(a.outputTokens / 1000).toFixed(0)}k</td>
                        <td style={{ textAlign: "right" }}>{gbp(a.usd, rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {/* Shared bills. Held once, not once per title — see lib/fleet-costs.js. */}
        <section style={{ ...SURFACE, borderRadius: 14, padding: "14px 16px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>Software and subscriptions</h2>
          <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 8px" }}>
            Shared across every title. Adding a magazine does not add another copy of these.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.key} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "6px 0" }}>
                    {s.label}
                    {s.confirm && (
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: "#fcd34d", opacity: 0.9 }}>confirm</span>
                    )}
                    {s.note && <div style={{ fontSize: 11, opacity: 0.45 }}>{s.note}</div>}
                  </td>
                  <td style={{ textAlign: "right", verticalAlign: "top", paddingTop: 6 }}>
                    {Number(s.monthlyUsd) ? gbp(Number(s.monthlyUsd), rate) : <span style={{ opacity: 0.4 }}>free</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* The same agent across every title, so the biggest line is visible. */}
        <section style={{ ...SURFACE, borderRadius: 14, padding: "14px 16px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>By agent, across the fleet</h2>
          <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 8px" }}>
            Last {data.days} days. This is where a cost change is worth making.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {fleetByAgent.map((a) => (
                <tr key={a.agent} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "6px 0" }}>{AGENT_LABELS[a.agent] || a.agent}</td>
                  <td style={{ textAlign: "right", opacity: 0.6 }}>{a.runs} runs</td>
                  <td style={{ textAlign: "right" }}>{gbp(a.usd, rate)}</td>
                </tr>
              ))}
              {!fleetByAgent.length && (
                <tr><td style={{ padding: "6px 0", opacity: 0.5 }}>No agent runs in this window.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
