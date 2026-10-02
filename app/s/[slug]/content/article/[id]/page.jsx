import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import { getSiteContext } from "@/lib/site";
import { saveArticle, advanceArticle, publishArticle, deleteArticle, uploadArticleImage, approveAndPublish } from "@/lib/actions";
import PhotoUploader from "./PhotoUploader";
import ApprovePublishButton from "./ApprovePublishButton";
import { isWordPressConfigured } from "@/lib/wordpress";
import { isDraftingConfigured } from "@/lib/drafting";

export const dynamic = "force-dynamic";

/**
 * The QA report as something a person reads, not the JSON it is stored as.
 * Falls back to the raw text for the older free-text reports.
 */
function QaReport({ raw }) {
  let r = null;
  try {
    r = JSON.parse(raw);
  } catch {
    // Older reports are plain text.
  }
  if (!r || typeof r !== "object") {
    return <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{raw}</p>;
  }
  const issues = [...(r.mechanical || []), ...(r.editorial || [])];
  const verdict = { fix: "Fixable, sent back for repair", kill: "Not publishable", pass: "Passed" }[r.verdict] || r.verdict;
  return (
    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55 }}>
      {(r.score != null || verdict) && (
        <div className="micro" style={{ marginBottom: 4 }}>
          {r.score != null ? `Quality score ${r.score}/100` : ""}
          {r.score != null && verdict ? " · " : ""}
          {verdict}
        </div>
      )}
      {r.override && (
        <p className="micro" style={{ margin: "0 0 6px", color: "var(--neon-cyan)" }}>
          Approved over QA by {r.override.by},{" "}
          {new Date(r.override.at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      {r.summary && <p style={{ margin: "0 0 6px", color: "var(--text)" }}>{r.summary}</p>}
      {issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)" }}>
          {issues.map((i, n) => (
            <li key={n}>{String(i)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function ArticlePage({ params, searchParams }) {
  const { slug, id } = await params;
  // Opened from the Trending Topics tab, so "back" goes there, not to the
  // title's Content Engine it was never reached from.
  const fromTrending = (await searchParams)?.from === "trending";
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const article = await db.article.findUnique({
    where: { id },
    include: { sourceItem: { include: { brand: true } } },
  });
  if (!article) notFound();

  const wpReady = isWordPressConfigured(creds.wordpress);
  const aiReady = isDraftingConfigured();

  return (
    <>
      <Header />
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
        <Link href={fromTrending ? "/trending" : "/content"} style={{ color: "var(--muted)", fontSize: 13 }}>
          {fromTrending ? "← Back to Trending Topics" : "← Back to Content Engine"}
        </Link>

        <section className="panel" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <span className={`chip ${article.type === "pr_rewrite" ? "chip-brand" : "chip-content"}`}>
              {article.type === "pr_rewrite" ? "PR rewrite" : "SEO original"}
            </span>
            <span className="chip chip-general">{article.status}</span>
            {article.sourceItem && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="micro"
                style={{ color: "var(--neon-cyan)" }}
              >
                Source: {article.sourceItem.brand.name} ↗
              </a>
            )}
            {!article.sourceItem && article.sourceUrl && (
              <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="micro" style={{ color: "var(--neon-cyan)" }}>
                Source: {(() => {
                  try {
                    return new URL(article.sourceUrl).hostname.replace(/^www./, "");
                  } catch {
                    return "link";
                  }
                })()} ↗
              </a>
            )}
            {article.wpPostId && (
              <span className="micro" style={{ color: "var(--neon-green)" }}>
                WP post #{article.wpPostId}
              </span>
            )}
          </div>

          {article.seoScore != null && (
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(101,125,255,0.06)",
                border: "1px solid var(--line)",
                marginBottom: 14,
              }}
            >
              <span
                className="impact-badge"
                style={{
                  minWidth: 54,
                  height: 54,
                  fontSize: 20,
                  background: article.seoScore >= 75 ? "rgba(5,150,105,0.16)" : article.seoScore >= 50 ? "rgba(8,145,178,0.16)" : "rgba(217,119,6,0.14)",
                  color: article.seoScore >= 75 ? "var(--neon-green)" : article.seoScore >= 50 ? "var(--neon-cyan)" : "var(--neon-amber)",
                  "--badge-glow": article.seoScore >= 75 ? "rgba(52,245,197,0.4)" : article.seoScore >= 50 ? "rgba(34,211,238,0.4)" : "rgba(251,191,36,0.35)",
                }}
              >
                {article.seoScore}
                <span className="micro" style={{ fontSize: 8 }}>/ 100</span>
              </span>
              <div>
                <div className="micro" style={{ marginBottom: 2 }}>Website benefit score</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{article.scoreRationale}</div>
              </div>
            </div>
          )}

          {article.imageUrl && (
            <div style={{ marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.imageUrl}
                alt={article.imageAlt || article.title}
                style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 12, border: "1px solid var(--line)" }}
              />
              <div className="micro" style={{ marginTop: 6 }}>
                Featured image · alt: “{article.imageAlt}”
                {article.imageCredit ? ` · ${article.imageCredit}` : article.imageSource === "manual" ? " · uploaded by hand" : " · CC0, no credit required"}
              </div>
            </div>
          )}
          {article.status !== "published" && (
            <PhotoUploader articleId={article.id} action={uploadArticleImage.bind(null, siteRef)} currentAlt={article.imageAlt} />
          )}

          {article.body && (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 14px",
                borderRadius: 12,
                marginBottom: 14,
                background: article.qaPassed ? "rgba(5,150,105,0.10)" : "rgba(217,119,6,0.10)",
                border: `1px solid ${article.qaPassed ? "rgba(5,150,105,0.45)" : "rgba(217,119,6,0.45)"}`,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1.2 }}>{article.qaPassed ? "✓" : "!"}</span>
              <div style={{ flex: 1 }}>
                <div
                  className="micro"
                  style={{ color: article.qaPassed ? "var(--neon-green)" : "var(--neon-amber)" }}
                >
                  {article.qaPassed ? "Passed editorial and image QA" : "Held by QA, will not publish"}
                </div>
                {article.qaReport && <QaReport raw={article.qaReport} />}
                {!article.qaPassed && article.status !== "published" && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Fix it in the body below and save, or if it is fine as it is, publish it yourself:
                    </span>
                    <ApprovePublishButton articleId={article.id} action={approveAndPublish.bind(null, siteRef)} hasImage={Boolean(article.imageUrl)} />
                  </div>
                )}
              </div>
              {article.scheduledFor && (
                <span className="micro num" style={{ color: "var(--neon-cyan)" }}>
                  {new Date(article.scheduledFor).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}

          {article.status === "drafting" && !article.body && (
            <p style={{ fontSize: 13, color: "var(--neon-amber)" }}>
              Queued for the drafting agent{aiReady ? " — next cycle picks it up." : " — waiting for the Anthropic API key to be connected."}
            </p>
          )}

          <form action={saveArticle.bind(null, siteRef)}>
            <input type="hidden" name="id" value={article.id} />
            <label className="micro">
              Title
              <input name="title" defaultValue={article.title} required style={{ width: "100%", marginTop: 6, marginBottom: 12, fontSize: 16, fontWeight: 700 }} />
            </label>
            <label className="micro">
              Keywords
              <input name="keywords" defaultValue={article.keywords || ""} style={{ width: "100%", marginTop: 6, marginBottom: 12 }} />
            </label>
            <label className="micro">
              Body (HTML, ready for WordPress)
              <textarea
                name="body"
                rows={22}
                defaultValue={article.body || ""}
                placeholder="The drafting agent writes here…"
                style={{ width: "100%", marginTop: 6, fontFamily: "var(--font-mono), monospace", fontSize: 13, lineHeight: 1.5 }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button type="submit" className="btn">Save</button>
            </div>
          </form>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {article.status !== "published" && (
              <form action={advanceArticle.bind(null, siteRef)}>
                <input type="hidden" name="id" value={article.id} />
                <button type="submit" className="btn-ghost" style={{ color: "var(--neon-cyan)" }}>
                  Advance stage →
                </button>
              </form>
            )}
            {article.status === "approved" && article.body && (
              <form action={publishArticle.bind(null, siteRef)}>
                <input type="hidden" name="id" value={article.id} />
                <button type="submit" className="btn">
                  {wpReady ? "Publish to WordPress" : "Mark published"}
                </button>
              </form>
            )}
            {!wpReady && article.status === "approved" && (
              <span className="micro" style={{ color: "var(--neon-amber)" }}>
                WordPress not connected yet
              </span>
            )}
            <form action={deleteArticle.bind(null, siteRef)} style={{ marginLeft: "auto" }}>
              <input type="hidden" name="id" value={article.id} />
              <button type="submit" className="btn-ghost" style={{ color: "var(--neon-red)" }}>
                Delete
              </button>
            </form>
          </div>
        </section>

        {article.body && (
          <section className="panel" style={{ marginTop: 20 }}>
            <h2 className="micro" style={{ marginBottom: 12 }}>Preview</h2>
            <div
              style={{ fontSize: 15, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: article.body }}
            />
          </section>
        )}
      </main>
    </>
  );
}
