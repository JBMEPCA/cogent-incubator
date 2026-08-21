import Header from "@/app/components/Header";
import SubTabs, { ANALYTICS_TABS } from "@/app/components/SubTabs";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import {
  saveOutreachEmail,
  approveOutreachEmail,
  confirmOutreachContact,
  dismissOutreachEmail,
  retryOutreachEmail,
  optOutBrand,
  markOutreachLinked,
  markOutreachReplied,
  scanForMentionsNow,
} from "@/lib/actions";
import { isOutreachConfigured, isSendConfigured, outreachSetupHint, outreachStats } from "@/lib/outreach";
import { authorityTrend } from "@/lib/metrics";
import AuthorityTrend from "@/app/components/AuthorityTrend";

export const dynamic = "force-dynamic";

const STATUS_CHIP = {
  pending: { label: "Sending soon", chip: "chip-general" },
  approved: { label: "Sending", chip: "chip-brand" },
  sent: { label: "Sent", chip: "chip-content" },
  replied: { label: "Replied", chip: "chip-monetise" },
  linked: { label: "Linked", chip: "chip-audience" },
  failed: { label: "Held back", chip: "chip-monetise" },
  bounced: { label: "Bounced", chip: "chip-monetise" },
  dismissed: { label: "Dismissed", chip: "chip-general" },
};

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function OutreachPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const [queue, live, stats, trend] = await Promise.all([
    // Bounced rows come back to the review queue rather than sitting in the sent
    // list looking like progress. The fix for one is a working address, and this
    // is the only screen with a box to type it into.
    db.outreachEmail.findMany({
      where: { status: { in: ["pending", "failed", "bounced"] } },
      include: { brand: true },
      orderBy: { createdAt: "desc" },
    }),
    db.outreachEmail.findMany({
      where: { status: { in: ["approved", "sent", "replied", "linked"] } },
      include: { brand: true },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
    outreachStats(site.id),
    authorityTrend(site.id, 60),
  ]);

  const configured = isOutreachConfigured(creds);
  const canSend = isSendConfigured(creds);
  const hint = outreachSetupHint(creds);

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={ANALYTICS_TABS} active="/outreach" />

        <AuthorityTrend rows={trend.rows} summary={trend.summary} />

        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Backlink outreach</h1>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 6px", maxWidth: 620 }}>
                Every brand we write about gets told, with the paragraph and the LinkedIn post
                already written for them. Drafts send themselves on the hourly cycle — edit,
                dismiss or fast-track anything here before it goes.
              </p>
              {hint && (
                <p className="micro" style={{ color: "var(--neon-amber)", margin: "0 0 10px" }}>
                  {hint}
                </p>
              )}
              {configured && !canSend && (
                <p className="micro" style={{ color: "var(--neon-amber)", margin: "0 0 10px" }}>
                  Composing is live, sending is not. Approve still works as a copy-and-paste queue.
                </p>
              )}
              <form action={scanForMentionsNow.bind(null, siteRef)}>
                <button type="submit" className="btn-ghost" style={{ color: "var(--neon-cyan)" }}>
                  ⟳ Scan recent articles now
                </button>
              </form>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Awaiting review", value: stats.pending },
                { label: "Emails sent", value: stats.sent },
                { label: "Links won", value: stats.linked },
                { label: "Link rate", value: stats.linkRate == null ? "—" : `${stats.linkRate}%` },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section>
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Sending on the next cycle{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>
                edit or dismiss now, or approve to send straight away
              </span>
            </h2>
            {queue.length === 0 && (
              <div className="panel" style={{ color: "var(--muted)", fontSize: 14 }}>
                Nothing waiting. New drafts appear within six hours of an article going live.
              </div>
            )}
            <div className="stagger" style={{ display: "grid", gap: 14 }}>
              {queue.map((row) => {
                const guessed = row.brand?.contactConfidence === "guessed";
                return (
                  <div key={row.id} className="panel">
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <span className={`chip ${STATUS_CHIP[row.status].chip}`}>
                        {STATUS_CHIP[row.status].label}
                      </span>
                      <strong style={{ fontSize: 16 }}>{row.brandName}</strong>
                      {row.articleUrl && (
                        <a
                          href={row.articleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="micro"
                          style={{ color: "var(--neon-cyan)" }}
                        >
                          {row.articleTitle}
                        </a>
                      )}
                    </div>

                    {row.mentionQuote && (
                      <p
                        style={{
                          fontSize: 13,
                          fontStyle: "italic",
                          color: "var(--muted)",
                          borderLeft: "2px solid rgba(90,106,255,0.6)",
                          padding: "2px 0 2px 12px",
                          margin: "0 0 12px",
                        }}
                      >
                        “{row.mentionQuote}”
                      </p>
                    )}

                    {row.error && (
                      <p className="micro" style={{ color: "var(--neon-red)", margin: "0 0 10px" }}>
                        {row.error}
                      </p>
                    )}

                    <form style={{ display: "grid", gap: 8 }}>
                      <input type="hidden" name="id" value={row.id} />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                          name="contactEmail"
                          defaultValue={row.contactEmail || ""}
                          placeholder="press@brand.co.uk"
                          style={{ flex: 2, minWidth: 200 }}
                        />
                        <input
                          name="contactName"
                          defaultValue={row.contactName || ""}
                          placeholder="Contact name (optional)"
                          style={{ flex: 1, minWidth: 150 }}
                        />
                      </div>
                      {guessed && (
                        <p className="micro" style={{ color: "var(--neon-amber)", margin: 0 }}>
                          That address was guessed from the domain, not found on their site.
                          It will not send until you confirm it or replace it.
                        </p>
                      )}
                      {!row.contactEmail && (
                        <p className="micro" style={{ color: "var(--neon-amber)", margin: 0 }}>
                          No address found. Add one before sending.
                        </p>
                      )}
                      <input name="subject" defaultValue={row.subject || ""} placeholder="Subject" />
                      <textarea name="body" rows={9} defaultValue={row.body || ""} />

                      <p className="micro" style={{ margin: 0, color: "var(--muted)" }}>
                        The headline, the article address and the “As seen on {site.name}” link
                        instruction are added below the body.
                      </p>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {/* Every one of these MUST be bound to the site, the same way the
                            standalone forms on this page are. A server action here takes
                            (site, formData); handed to formAction unbound, Next calls it
                            with (formData) alone, so `site` is the FormData object,
                            site.id is undefined, and forSite() throws on the action's
                            first line. That is a 5xx with an empty body, which the browser
                            renders as "This page couldn't load" — which is what every
                            button in this row did until 17 August. */}
                        <button
                          formAction={approveOutreachEmail.bind(null, siteRef)}
                          className="btn"
                          style={{ padding: "7px 18px" }}
                        >
                          ✓ Approve &amp; send
                        </button>
                        <button formAction={saveOutreachEmail.bind(null, siteRef)} className="btn-ghost">
                          Save draft
                        </button>
                        {guessed && (
                          <button
                            formAction={confirmOutreachContact.bind(null, siteRef)}
                            className="btn-ghost"
                            style={{ color: "var(--neon-amber)" }}
                          >
                            ✓ I have checked this address
                          </button>
                        )}
                        {["failed", "bounced"].includes(row.status) && (
                          <button
                            formAction={retryOutreachEmail.bind(null, siteRef)}
                            className="btn-ghost"
                            style={{ color: "var(--neon-cyan)" }}
                          >
                            ↻ Reset
                          </button>
                        )}
                        <button formAction={dismissOutreachEmail.bind(null, siteRef)} className="btn-ghost">
                          Dismiss
                        </button>
                      </div>
                    </form>

                    {row.brandId && (
                      <form action={optOutBrand.bind(null, siteRef)} style={{ marginTop: 6 }}>
                        <input type="hidden" name="brandId" value={row.brandId} />
                        <button type="submit" className="btn-ghost" style={{ fontSize: 12, opacity: 0.7 }}>
                          Never contact {row.brandName}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="stagger" style={{ display: "grid", gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Out in the world</h3>
              {live.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                  Nothing sent yet.
                </p>
              )}
              <div style={{ display: "grid", gap: 12 }}>
                {live.map((row) => (
                  <div key={row.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.12)", paddingBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`chip ${STATUS_CHIP[row.status].chip}`} style={{ fontSize: 11 }}>
                        {STATUS_CHIP[row.status].label}
                      </span>
                      <strong style={{ fontSize: 13 }}>{row.brandName}</strong>
                      <span className="micro">{fmtDate(row.sentAt || row.createdAt)}</span>
                      {row.followUpSentAt && <span className="micro">· chased</span>}
                    </div>
                    <p className="micro" style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                      {row.articleTitle}
                    </p>
                    {row.status === "linked" && row.linkUrl && (
                      <a href={row.linkUrl} target="_blank" rel="noreferrer" className="micro" style={{ color: "var(--neon-green)" }}>
                        link live ↗
                      </a>
                    )}
                    {["sent", "replied"].includes(row.status) && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <form action={markOutreachLinked.bind(null, siteRef)} style={{ display: "flex", gap: 4 }}>
                          <input type="hidden" name="id" value={row.id} />
                          <input
                            name="linkUrl"
                            placeholder="URL of the link"
                            style={{ fontSize: 12, padding: "4px 8px", width: 150 }}
                          />
                          <button type="submit" className="btn-ghost" style={{ fontSize: 12 }}>
                            ✓ Linked
                          </button>
                        </form>
                        {row.status === "sent" && (
                          <form action={markOutreachReplied.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className="btn-ghost" style={{ fontSize: 12 }}>
                              Replied
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
