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
  ignoreReferrer,
  recordBacklink,
} from "@/lib/actions";
import { isOutreachConfigured, isSendConfigured, outreachSetupHint, outreachStats } from "@/lib/outreach";
import { authorityTrend } from "@/lib/metrics";
import { listReferrers } from "@/lib/referrers";
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

  const [queue, live, stats, trend, referrers] = await Promise.all([
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
    listReferrers(site.id),
  ]);

  const configured = isOutreachConfigured(creds);
  const canSend = isSendConfigured(creds);
  const hint = outreachSetupHint(creds);

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
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
                // Counted apart from "Links won" on purpose. That one is the
                // outreach scoreboard — brands we asked, who said yes. This is
                // every site linking us however it found us, which is the
                // number that actually answers "are we earning links".
                { label: "Sites linking to us", value: referrers.length },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel stagger" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Sites linking to us</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px", maxWidth: 720 }}>
            Found from referral traffic in GA4, so a site appears here the first time a reader
            clicks through — whether or not we ever emailed them. A link nobody has clicked yet is
            invisible to this, and &ldquo;first seen&rdquo; is the day we noticed, not the day the
            link went up.
          </p>

          <form
            action={recordBacklink.bind(null, siteRef)}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
          >
            <input
              type="url"
              name="linkUrl"
              required
              placeholder="https://example.com/the-page-linking-to-us"
              style={{ flex: 1, minWidth: 280, maxWidth: 520 }}
            />
            <button type="submit" className="btn-ghost" style={{ color: "var(--neon-cyan)" }}>
              + Record a link
            </button>
          </form>

          {referrers.length === 0 ? (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
              Nothing yet. The Backlink Manager checks on every sweep and will name any new site in
              its report to the Director.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "6px 10px 6px 0", fontWeight: 500 }}>Site</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }}>First seen</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }}>Landed on</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }}>Sessions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {referrers.map((r) => (
                    <tr key={r.domain} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 10px 8px 0" }}>
                        {/* The linking page when we know it, which is only ever
                            when it was typed in — GA4 reports the domain and
                            nothing more. */}
                        <a
                          href={r.linkUrl || `https://${r.domain}`}
                          target="_blank"
                          rel="noreferrer nofollow"
                          style={{ color: "var(--neon-cyan)" }}
                        >
                          {r.domain}
                        </a>
                        {r.source === "manual" && (
                          <span className="micro" style={{ color: "var(--muted)", marginLeft: 8 }}>
                            added by hand
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{fmtDate(r.firstSeenAt)}</td>
                      <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{r.landingPage || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{r.sessions}</td>
                      <td style={{ padding: "8px 0", textAlign: "right" }}>
                        <form action={ignoreReferrer.bind(null, siteRef)}>
                          <input type="hidden" name="domain" value={r.domain} />
                          <button type="submit" className="btn-ghost micro" style={{ color: "var(--muted)" }}>
                            Not a link
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="split-main-side" style={{ gap: 24 }}>
          <section>
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Sending on the next cycle{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>
                edit or dismiss now, or approve to send straight away
              </span>
            </h2>
            {queue.length === 0 && (
              <div className="panel" style={{ color: "var(--muted)", fontSize: 14 }}>
                Nothing waiting. New articles are scanned for mentions on the hourly sweep; a draft usually appears within the hour of publishing, and sends itself on a later tick unless dismissed here.
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
