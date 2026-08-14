import Header from "@/app/components/Header";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import {
  addLinkedInPost,
  advanceLinkedInPost,
  deleteLinkedInPost,
  postLinkedInNow,
  retryLinkedInPost,
  disconnectLinkedIn,
} from "@/lib/actions";
import SubTabs, { CONTENT_TABS } from "@/app/components/SubTabs";
import {
  getConnection,
  isLinkedInConfigured,
  redirectUri,
  MAX_ATTEMPTS,
  POST_START_HOUR,
  POST_END_HOUR,
} from "@/lib/linkedin";

export const dynamic = "force-dynamic";

const STATUS_LABELS = { draft: "Draft", approved: "Approved — scheduled to post", posted: "Posted" };

const when = (d) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));

export default async function LinkedInPage({searchParams, params}) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const query = await searchParams;
  const [posts, connection] = await Promise.all([
    db.linkedInPost.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    getConnection(site),
  ]);
  const configured = isLinkedInConfigured(creds.linkedin);
  const live = Boolean(connection && !connection.expired);

  // Show which article each post came from: the LinkedIn Manager drafts from
  // whatever is performing, so provenance is the useful context when approving.
  const sourceIds = [...new Set(posts.map((p) => p.articleId).filter(Boolean))];
  const sources = sourceIds.length
    ? Object.fromEntries(
        (await db.article.findMany({ where: { id: { in: sourceIds } }, select: { id: true, title: true } })).map((a) => [a.id, a.title])
      )
    : {};
  const counts = {
    draft: posts.filter((p) => p.status === "draft").length,
    approved: posts.filter((p) => p.status === "approved").length,
    posted: posts.filter((p) => p.status === "posted").length,
  };

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={CONTENT_TABS} active="/linkedin" />
        {query?.connected && (
          <div className="panel" style={{ marginBottom: 16, borderColor: "var(--neon-cyan)" }}>
            Connected to LinkedIn as {params.connected}. Approved posts will now publish on their own.
          </div>
        )}
        {query?.error && (
          <div className="panel" style={{ marginBottom: 16, borderColor: "#dc2626" }}>
            LinkedIn connection failed: {params.error}
          </div>
        )}

        <div
          className="stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="panel stat-tile">
              <div className="stat-label">{k}</div>
              <div className="stat-value">{v}</div>
            </div>
          ))}
        </div>

        <section className="panel" style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Account</h2>
          {!configured ? (
            <p className="micro" style={{ margin: 0 }}>
              Not set up yet. Create an app at developer.linkedin.com, add the “Sign In with LinkedIn using OpenID
              Connect” and “Share on LinkedIn” products, register <code>{redirectUri()}</code> as the redirect URL, then
              put LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in the environment.
            </p>
          ) : !connection ? (
            <>
              <p className="micro" style={{ margin: "0 0 12px" }}>
                Not connected. Until you connect, approving a post just marks it ready and you post it yourself.
              </p>
              <a href={`/api/linkedin/connect?site=${site.slug}`} className="btn">
                Connect LinkedIn
              </a>
            </>
          ) : (
            <>
              <p className="micro" style={{ margin: "0 0 12px" }}>
                Connected as <strong>{connection.name}</strong>.{" "}
                {connection.expired ? (
                  <span style={{ color: "#dc2626" }}>The token has expired, so nothing is publishing. Reconnect below.</span>
                ) : connection.daysLeft <= 7 ? (
                  <span style={{ color: "#d97706" }}>
                    Token expires in {connection.daysLeft} day{connection.daysLeft === 1 ? "" : "s"}
                    {connection.canRefresh ? " and will try to renew itself." : ". Reconnect to keep posting."}
                  </span>
                ) : (
                  <>Token good for another {connection.daysLeft} days.</>
                )}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <a href={`/api/linkedin/connect?site=${site.slug}`} className="btn-ghost" style={{ fontSize: 12 }}>
                  Reconnect
                </a>
                <form action={disconnectLinkedIn.bind(null, siteRef)}>
                  <button type="submit" className="btn-ghost" style={{ fontSize: 12 }}>
                    Disconnect
                  </button>
                </form>
              </div>
            </>
          )}
        </section>

        <section className="panel" style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Post queue</h2>
          <p className="micro" style={{ margin: "0 0 14px" }}>
            The LinkedIn Manager drafts two a day from whichever articles are performing, and never posts.{" "}
            {live
              ? `Approving one books it a slot between ${POST_START_HOUR}:00 and ${POST_END_HOUR}:00 UK, at least three hours after the last, and it publishes itself.`
              : "Approve here, then publish on LinkedIn yourself."}
          </p>
          <form action={addLinkedInPost.bind(null, siteRef)}>
            <textarea
              name="text"
              rows={4}
              required
              placeholder="Draft a LinkedIn post…"
              style={{ width: "100%", marginBottom: 10 }}
            />
            <button type="submit" className="btn">
              Add draft
            </button>
          </form>
        </section>

        {["approved", "draft", "posted"].map((stage) => {
          const inStage = posts.filter((p) => p.status === stage);
          if (inStage.length === 0) return null;
          return (
            <section key={stage} className="panel" style={{ marginBottom: 18 }}>
              <h3 className="micro" style={{ margin: "0 0 10px" }}>
                {STATUS_LABELS[stage]} ({inStage.length})
              </h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {inStage.map((p) => {
                  const parked = p.attempts >= MAX_ATTEMPTS;
                  return (
                    <li
                      key={p.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 14,
                      }}
                    >
                      {/* The real composed card, not a stand-in: same code path
                          the publisher uses, so what you approve is what posts. */}
                      <img
                        src={`/api/linkedin/card/${p.id}?w=320`}
                        alt=""
                        width={160}
                        height={84}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: 160,
                          height: 84,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid var(--line)",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        {p.articleId && sources[p.articleId] && (
                          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 5 }}>
                            drafted from “{sources[p.articleId].slice(0, 64)}”
                          </div>
                        )}
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.text}</p>
                        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6 }}>
                          {p.text.trim().split(/\s+/).length} words ·{" "}
                          {(p.text.match(/#[A-Za-z][A-Za-z0-9]*/g) || []).length} hashtags
                          {stage === "approved" && p.scheduledFor && ` · posts ${when(p.scheduledFor)}`}
                          {stage === "posted" && p.postedAt && ` · posted ${when(p.postedAt)}`}
                        </div>
                        {p.linkedinUrn && (
                          <a
                            href={`https://www.linkedin.com/feed/update/${p.linkedinUrn}/`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 11, color: "var(--neon-cyan)" }}
                          >
                            view on LinkedIn
                          </a>
                        )}
                        {p.publishError && (
                          <div style={{ fontSize: 11, color: parked ? "#dc2626" : "#d97706", marginTop: 6 }}>
                            {parked
                              ? `Gave up after ${MAX_ATTEMPTS} attempts: `
                              : `Attempt ${p.attempts} failed, will retry: `}
                            {p.publishError}
                          </div>
                        )}
                      </div>

                      {parked && (
                        <form action={retryLinkedInPost.bind(null, siteRef)}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="btn-ghost" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                            try again
                          </button>
                        </form>
                      )}
                      {live && stage !== "posted" && (
                        <form action={postLinkedInNow.bind(null, siteRef)}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="btn-ghost"
                            style={{ color: "#0a66c2", fontSize: 12, whiteSpace: "nowrap" }}
                          >
                            post now
                          </button>
                        </form>
                      )}
                      {stage !== "posted" && (
                        <form action={advanceLinkedInPost.bind(null, siteRef)}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="btn-ghost"
                            style={{ color: "var(--neon-cyan)", fontSize: 12, whiteSpace: "nowrap" }}
                          >
                            {stage === "draft" ? "approve" : "mark posted"}
                          </button>
                        </form>
                      )}
                      <form action={deleteLinkedInPost.bind(null, siteRef)}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="btn-ghost" title="Delete">
                          ✕
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </>
  );
}
