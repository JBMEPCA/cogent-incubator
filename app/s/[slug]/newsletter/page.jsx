import Header from "@/app/components/Header";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import SubTabs, { ANALYTICS_TABS } from "@/app/components/SubTabs";
import { newsletterReport } from "@/lib/newsletter-stats";
import { isNewsletterConfigured } from "@/lib/newsletter";
import { prospectStats } from "@/lib/prospects";

export const dynamic = "force-dynamic";

const SURFACE = { background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)" };

function Stat({ label, value, hint, tone }) {
  return (
    <div style={{ ...SURFACE, flex: 1, minWidth: 160, padding: "13px 15px", borderRadius: 12 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 3, color: tone }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

const pct = (v) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const day = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Industry benchmarks for a B2B publisher newsletter, so a number reads as good
// or bad without having to remember what good looks like.
const OPEN_OK = 0.2;
const CLICK_OK = 0.02;
const BOUNCE_BAD = 0.02;

/** Open and click rate across issues. Pointless with one issue, so it hides. */
function Trend({ issues }) {
  if (issues.length < 2) return null;
  const series = [...issues].reverse();
  const w = 640, h = 120, pad = 24;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
  const maxRate = Math.max(0.5, ...series.map((s) => s.openRate ?? 0));
  const y = (v) => h - pad - ((v ?? 0) / maxRate) * (h - pad * 2);
  const path = (key) => series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(" ");

  return (
    <section style={{ ...SURFACE, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Engagement across issues</h3>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Open and click rate by issue">
        <line x1={pad} y1={y(OPEN_OK)} x2={w - pad} y2={y(OPEN_OK)} stroke="rgba(255,255,255,.14)" strokeDasharray="4 4" />
        <path d={path("openRate")} fill="none" stroke="#2E3EEE" strokeWidth="2.5" />
        <path d={path("clickRate")} fill="none" stroke="#059669" strokeWidth="2.5" />
        {series.map((s, i) => (
          <circle key={s.id} cx={x(i)} cy={y(s.openRate)} r="3" fill="#2E3EEE" />
        ))}
      </svg>
      <div style={{ fontSize: 11.5, opacity: 0.6, display: "flex", gap: 16 }}>
        <span><span style={{ color: "#2E3EEE" }}>&#9632;</span> open rate</span>
        <span><span style={{ color: "#059669" }}>&#9632;</span> click rate</span>
        <span style={{ opacity: 0.6 }}>dashed: 20% benchmark</span>
      </div>
    </section>
  );
}

export default async function NewsletterStatsPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  if (!isNewsletterConfigured(creds.mailchimp)) {
    return (
      <>
        <Header />
        <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
          <SubTabs items={ANALYTICS_TABS} active="/newsletter" />
          <h1 style={{ margin: "0 0 5px", fontSize: 25 }}>Newsletter</h1>
          <p style={{ fontSize: 13.5, opacity: 0.7 }}>Mailchimp is not connected. Add MAILCHIMP_API_KEY and redeploy.</p>
        </main>
      </>
    );
  }

  const [r, drip] = await Promise.all([
    newsletterReport(site.id, creds.mailchimp.audienceId).catch((e) => ({
      error: e.message, issues: [], growth: [], latestLinks: [],
    })),
    prospectStats(site.id).catch(() => null),
  ]);

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={ANALYTICS_TABS} active="/newsletter" />

        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 5px", fontSize: 25 }}>Newsletter</h1>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.7, maxWidth: 760, lineHeight: 1.55 }}>
            Smart SME Weekly, read live from Mailchimp. Rates are against emails delivered, so a bounce is not
            quietly counted as someone who chose not to open.
          </p>
        </div>

        {r.error && (
          <p style={{ ...SURFACE, borderRadius: 12, padding: 14, fontSize: 13, color: "#dc2626" }}>
            Could not reach Mailchimp: {r.error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <Stat label="Subscribers" value={(r.subscribers ?? 0).toLocaleString()}
            hint={drip ? `${drip.readyToImport.toLocaleString()} verified and queued` : null} />
          <Stat label="Issues sent" value={r.issues.length}
            hint={r.totalSent ? `${r.totalSent.toLocaleString()} emails all time` : null} />
          <Stat label="Average open" value={pct(r.avgOpenRate)}
            tone={r.avgOpenRate == null ? undefined : r.avgOpenRate >= OPEN_OK ? "#059669" : "#d97706"}
            hint="20% is a solid B2B benchmark" />
          <Stat label="Average click" value={pct(r.avgClickRate)}
            tone={r.avgClickRate == null ? undefined : r.avgClickRate >= CLICK_OK ? "#059669" : "#d97706"}
            hint="2% and up is healthy" />
          <Stat label="Unsubscribes" value={(r.unsubscribes ?? 0).toLocaleString()}
            hint={r.cleaned ? `${r.cleaned} cleaned` : "all time"} />
        </div>

        <Trend issues={r.issues} />

        <section style={{ ...SURFACE, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Past issues</h3>
          {r.issues.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.5, margin: 0 }}>
              No issue has been sent yet. The Newsletter Manager runs Thursdays at 09:05.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.5 }}>
                    <th style={{ padding: "0 10px 8px 0" }}>Sent</th>
                    <th style={{ padding: "0 10px 8px 0" }}>Subject</th>
                    <th style={{ padding: "0 10px 8px 0", textAlign: "right" }}>Delivered</th>
                    <th style={{ padding: "0 10px 8px 0", textAlign: "right" }}>Opens</th>
                    <th style={{ padding: "0 10px 8px 0", textAlign: "right" }}>Clicks</th>
                    <th style={{ padding: "0 10px 8px 0", textAlign: "right" }}>Bounced</th>
                    <th style={{ padding: "0 0 8px 0", textAlign: "right" }}>Unsubs</th>
                  </tr>
                </thead>
                <tbody>
                  {r.issues.map((i) => {
                    const bounceRate = i.sent ? (i.hardBounces + i.softBounces) / i.sent : 0;
                    return (
                      <tr key={i.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        <td style={{ padding: "9px 10px 9px 0", whiteSpace: "nowrap", opacity: 0.7 }}>{day(i.sentAt)}</td>
                        <td style={{ padding: "9px 10px 9px 0", lineHeight: 1.4 }}>
                          <a href={`https://us4.admin.mailchimp.com/reports/summary?id=${i.webId}`} target="_blank" rel="noreferrer"
                            style={{ color: "inherit", textDecoration: "none" }}>
                            {i.subject || i.title}
                          </a>
                        </td>
                        <td style={{ padding: "9px 10px 9px 0", textAlign: "right" }}>{i.delivered.toLocaleString()}</td>
                        <td style={{ padding: "9px 10px 9px 0", textAlign: "right", color: i.openRate >= OPEN_OK ? "#059669" : undefined }}>
                          {pct(i.openRate)}
                          <span style={{ opacity: 0.45, fontSize: 11 }}> ({i.uniqueOpens})</span>
                        </td>
                        <td style={{ padding: "9px 10px 9px 0", textAlign: "right", color: i.clickRate >= CLICK_OK ? "#059669" : undefined }}>
                          {pct(i.clickRate)}
                          <span style={{ opacity: 0.45, fontSize: 11 }}> ({i.uniqueClicks})</span>
                        </td>
                        <td style={{ padding: "9px 10px 9px 0", textAlign: "right", color: bounceRate > BOUNCE_BAD ? "#dc2626" : undefined }}>
                          {i.hardBounces + i.softBounces}
                        </td>
                        <td style={{ padding: "9px 0", textAlign: "right", color: i.unsubscribed ? "#d97706" : undefined }}>
                          {i.unsubscribed}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          <section style={{ ...SURFACE, borderRadius: 14, padding: 16 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>What they clicked</h3>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, opacity: 0.5 }}>Most recent issue</p>
            {r.latestLinks.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.5, margin: 0 }}>No clicks recorded yet.</p>
            ) : (
              r.latestLinks.map((l) => (
                <div key={l.url} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <a href={l.url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12.5, lineHeight: 1.4, color: "inherit", textDecoration: "none", wordBreak: "break-all" }}>
                      {l.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 62)}
                    </a>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{l.clicks}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          <section style={{ ...SURFACE, borderRadius: 14, padding: 16 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>List growth</h3>
            {r.growth.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.5, margin: 0 }}>
                Mailchimp reports growth by calendar month, so this fills in from next month.
              </p>
            ) : (
              r.growth.map((g) => (
                <div key={g.month} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ opacity: 0.7 }}>{g.month}</span>
                  <span>
                    <span style={{ fontWeight: 700 }}>+{(g.imports + g.optins).toLocaleString()}</span>
                    {g.unsubscribed > 0 && <span style={{ color: "#d97706" }}> &minus;{g.unsubscribed}</span>}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      </main>
    </>
  );
}
