import Header from "@/app/components/Header";
import SubTabs, { ENGINE_TABS } from "@/app/components/SubTabs";
import { buildCostReport, getStoredReport } from "@/lib/agents/costs";
import { updateFixedCost, updateCostTarget } from "@/lib/actions";
import { BudgetMeter, SpendDonut, DailyTrend, SERIES } from "@/app/components/CostCharts";

export const dynamic = "force-dynamic";

const AGENT_NAMES = {
  director: "Director",
  researcher: "Researcher",
  seo: "SEO Expert",
  editor: "Editor",
  designer: "Graphic Designer",
  finance: "Finance Manager",
  linkedin: "LinkedIn Manager",
};

const usd = (n) => `$${Number(n || 0).toFixed(2)}`;

function Stat({ label, value, hint, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 165, padding: "14px 16px", borderRadius: 12, background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 700, marginTop: 3, color: accent || "inherit" }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <section style={{ background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 15 }}>{title}</h3>
      {sub && <p style={{ margin: "0 0 11px", fontSize: 11.5, opacity: 0.5, lineHeight: 1.45 }}>{sub}</p>}
      {children}
    </section>
  );
}

export default async function CostsPage() {
  const [report, stored] = await Promise.all([buildCostReport(), getStoredReport()]);
  const perArticleAll = report.published30
    ? (report.projectedMonthly + report.fixedMonthly) / report.published30
    : null;

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={ENGINE_TABS} active="/engine-room/costs" />

        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 5px", fontSize: 25 }}>Costs</h1>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.7, maxWidth: 760, lineHeight: 1.55 }}>
            AI spend is measured from real token usage on every agent run, not estimated. Infrastructure is
            whatever you enter below. The Finance Manager is advisory: it reports and recommends, it never
            blocks another agent.
          </p>
        </div>

        {report.daysLive < 7 && (
          <div
            style={{
              marginBottom: 16,
              padding: "11px 14px",
              borderRadius: 11,
              background: "rgba(217,119,6,.10)",
              border: "1px solid rgba(217,119,6,.35)",
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#d97706" }}>Projection is low confidence.</strong> The agents have only been
            running for {report.daysLive} day{report.daysLive === 1 ? "" : "s"}, and much of that is setup and test
            runs rather than steady output. Extrapolating a month from it will be wrong in either direction. Treat
            the projected figure as indicative until roughly a week of normal operation has accumulated.
          </div>
        )}

        <section style={{ background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Monthly budget</h3>
            <form action={updateCostTarget} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 11.5, opacity: 0.55 }}>Target £</label>
              <input
                name="targetGbp"
                type="number"
                step="1"
                min="1"
                defaultValue={report.targetGbp}
                style={{ width: 68, padding: "4px 7px", borderRadius: 7, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "inherit", fontSize: 13 }}
              />
              <button type="submit" className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>Set</button>
            </form>
          </div>
          <BudgetMeter
            spentGbp={report.totalMonthlyGbp}
            targetGbp={report.targetGbp}
            breakdown={[
              { label: "AI", gbp: report.projectedMonthly * report.rate, colour: SERIES[0] },
              { label: "Infrastructure", gbp: report.fixedMonthly * report.rate, colour: SERIES[1] },
            ]}
          />
          <p style={{ fontSize: 11, opacity: 0.45, margin: "10px 0 0" }}>
            Converted at {report.rate} USD to GBP. Anthropic bills in dollars.
          </p>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Card title="Where the AI spend goes" sub="Last 30 days, measured from token usage.">
            <SpendDonut
              items={report.byAgent.map((a) => ({ key: a.key, label: AGENT_NAMES[a.key] || a.key, cost: a.cost }))}
              rate={report.rate}
            />
          </Card>
          <Card title="Daily spend" sub="Last 14 days. Quiet days are genuine zeros, not gaps.">
            <DailyTrend daily={report.daily} rate={report.rate} />
          </Card>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <Stat label="Last 24 hours" value={usd(report.spend24h)} hint={`${report.runs24h} agent runs`} />
          <Stat label="Last 7 days" value={usd(report.spend7)} hint={`${report.runs7} runs`} />
          <Stat label="Last 30 days" value={usd(report.spend30)} hint={`${report.runs30} runs over ${report.daysLive} days live`} />
          <Stat
            label="Projected AI / month"
            value={usd(report.projectedMonthly)}
            hint="at the current daily rate"
            accent="#2E3EEE"
          />
          <Stat
            label="Total run rate"
            value={usd(report.totalMonthly)}
            hint={`AI ${usd(report.projectedMonthly)} + fixed ${usd(report.fixedMonthly)}`}
            accent="#059669"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>

          <Card title="Cost per article" sub="The number that decides whether this scales.">
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}>
                <div style={{ fontSize: 11, opacity: 0.55 }}>AI only</div>
                <div style={{ fontSize: 21, fontWeight: 700 }}>
                  {report.perArticle ? `$${report.perArticle.toFixed(2)}` : "—"}
                </div>
              </div>
              <div style={{ flex: 1, padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}>
                <div style={{ fontSize: 11, opacity: 0.55 }}>All in</div>
                <div style={{ fontSize: 21, fontWeight: 700 }}>
                  {perArticleAll ? `$${perArticleAll.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, opacity: 0.65, margin: 0, lineHeight: 1.5 }}>
              {report.published30} article{report.published30 === 1 ? "" : "s"} published in the last 30 days.
              Only the Editor and Designer scale with output; the Director, Researcher, LinkedIn and Finance
              costs are broadly fixed however much you publish.
            </p>
          </Card>

          <Card title="Fixed infrastructure" sub="Edit any figure. Lines marked to confirm are ones only you can settle.">
            {report.fixed.map((f) => (
              <form key={f.key} action={updateFixedCost} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <input type="hidden" name="key" value={f.key} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {f.label}
                    {f.confirm && (
                      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "#d9770622", color: "#d97706", fontWeight: 700 }}>
                        CONFIRM
                      </span>
                    )}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 13 }}>$</span>
                  <input
                    name="monthlyUsd"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={f.monthlyUsd}
                    style={{ width: 78, padding: "4px 7px", borderRadius: 7, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "inherit", fontSize: 13 }}
                  />
                  <button type="submit" className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>Save</button>
                </div>
                {f.note && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3, lineHeight: 1.4 }}>{f.note}</div>}
              </form>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 11, fontSize: 13, fontWeight: 700 }}>
              <span>Fixed total</span>
              <span>{usd(report.fixedMonthly)} / month</span>
            </div>
          </Card>

          <Card
            title="Finance Manager's recommendations"
            sub={stored?.generatedAt ? `Last reviewed ${new Date(stored.generatedAt).toLocaleString("en-GB")}` : "Not yet reviewed."}
          >
            {!stored?.recommendations?.length && (
              <p style={{ fontSize: 13, opacity: 0.55, margin: 0, lineHeight: 1.5 }}>
                Nothing yet. Wake the Finance Manager from the Engine Room and it will review the numbers and
                report back here.
              </p>
            )}
            {stored?.headline && (
              <p style={{ fontSize: 13.5, margin: "0 0 12px", lineHeight: 1.5 }}>{stored.headline}</p>
            )}
            {(stored?.recommendations || []).map((r, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong style={{ fontSize: 13 }}>{r.title}</strong>
                  {r.saving && r.saving !== "null" && (
                    <span style={{ fontSize: 11, color: "#059669", fontWeight: 700, whiteSpace: "nowrap" }}>{r.saving}</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 3, lineHeight: 1.45 }}>{r.detail}</div>
              </div>
            ))}
          </Card>
        </div>
      </main>
    </>
  );
}
