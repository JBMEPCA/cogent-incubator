import Header from "@/app/components/Header";
import SubTabs, { ANALYTICS_TABS } from "@/app/components/SubTabs";
import LinkMap from "@/app/components/LinkMap";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { approveSeoSuggestion, dismissSeoSuggestion, retrySeoSuggestion } from "@/lib/actions";
import { isSeoAgentConfigured } from "@/lib/seo-agent";
import { fetchPosts, isWordPressConfigured } from "@/lib/wordpress";

// Build the site's link graph from live post content.
async function buildLinkGraph(wp) {
  if (!isWordPressConfigured(wp)) return { nodes: [], edges: [] };
  try {
    const posts = await fetchPosts(wp, 50);
    const byUrl = new Map(posts.map((p) => [p.link.replace(/\/$/, ""), p]));
    const nodes = [];
    const edges = [];
    const external = new Map();
    for (const p of posts) {
      nodes.push({
        id: `p${p.id}`,
        kind: "post",
        label: (p.title?.rendered || "").replace(/&#8217;/g, "'").replace(/&amp;/g, "&").replace(/&#82[01]\d;/g, '"'),
        url: p.link,
        degree: 0,
        seed: p.id,
      });
      const hrefs = (p.content?.rendered || "").match(/href="(https?:\/\/[^"]+)"/g) || [];
      // The title's own host, from the credential this graph is being built
      // with. This was hardcoded to smartsme.co.uk, so on every other title
      // the map drew the site's own articles as external domains and showed
      // zero internal links - four titles' link maps were decorative.
      const ownHost = String(wp.url || "")
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/^www\./, "")
        .toLowerCase();
      for (const h of hrefs) {
        const url = h.slice(6, -1).replace(/\/$/, "");
        if (ownHost && url.toLowerCase().includes(ownHost)) {
          const target = byUrl.get(url);
          if (target && target.id !== p.id) edges.push({ from: `p${p.id}`, to: `p${target.id}` });
        } else {
          try {
            const domain = new URL(url).hostname.replace(/^www\./, "");
            if (["gravatar.com", "wp.com", "w.org"].some((d) => domain.includes(d))) continue;
            if (!external.has(domain)) external.set(domain, { id: `x-${domain}`, kind: "ext", label: domain, url: `https://${domain}`, degree: 0, seed: domain.length * 7 });
            edges.push({ from: `p${p.id}`, to: `x-${domain}` });
          } catch {}
        }
      }
    }
    nodes.push(...external.values());
    const deg = {};
    for (const e of edges) {
      deg[e.from] = (deg[e.from] || 0) + 1;
      deg[e.to] = (deg[e.to] || 0) + 1;
    }
    for (const n of nodes) n.degree = deg[n.id] || 0;
    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  internal_link: { label: "Internal link", chip: "chip-brand" },
  // Written in code from the PrBrand table rather than proposed by the model,
  // so these are the ones that can be approved without reading them closely.
  brand_link: { label: "Brand link", chip: "chip-brand" },
  title_update: { label: "Title", chip: "chip-content" },
  content_edit: { label: "Content edit", chip: "chip-audience" },
  advice: { label: "Advice", chip: "chip-general" },
};

function impactColor(impact) {
  if (impact >= 75) return { color: "var(--neon-green)", glow: "rgba(52,245,197,0.45)", bg: "rgba(5,150,105,0.15)" };
  if (impact >= 45) return { color: "var(--neon-cyan)", glow: "rgba(34,211,238,0.45)", bg: "rgba(8,145,178,0.15)" };
  return { color: "var(--neon-amber)", glow: "rgba(251,191,36,0.4)", bg: "rgba(217,119,6,0.14)" };
}

function scoreColor(score) {
  if (score == null) return { color: "var(--muted)", bg: "rgba(100,116,139,0.16)" };
  if (score >= 75) return { color: "#6ee7b7", bg: "rgba(5,150,105,0.16)" };
  if (score >= 50) return { color: "#67e8f9", bg: "rgba(8,145,178,0.16)" };
  return { color: "#fcd34d", bg: "rgba(217,119,6,0.14)" };
}

export default async function SeoPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const [pending, resolved, scoreSetting, auditSetting, scoredArticles, publishedCount, keywords] =
    await Promise.all([
      db.seoSuggestion.findMany({
        where: { status: { in: ["pending", "failed"] } },
        orderBy: { impact: "desc" },
      }),
      db.seoSuggestion.findMany({
        where: { status: { in: ["applied", "dismissed"] } },
        orderBy: { appliedAt: "desc" },
        take: 10,
      }),
      db.engineSetting.findFirst({ where: { key: "seo_site_score" } }),
      db.engineSetting.findFirst({ where: { key: "seo_last_audit" } }),
      db.article.findMany({
        where: { seoScore: { not: null } },
        orderBy: { seoScore: "desc" },
        take: 8,
        select: { id: true, title: true, seoScore: true, status: true },
      }),
      db.article.count({ where: { status: "published" } }),
      // The keyword registry, best-performing first. Ordered by OUR OWN Search
      // Console impressions rather than by Bing demand: Bing measures the whole
      // public, and sorting on it puts consumer terms this title will never
      // want at the top of the table.
      db.keywordTarget.findMany({
        orderBy: [{ gscImpressions: { sort: "desc", nulls: "last" } }, { bingImpressions: "desc" }],
        take: 40,
      }),
    ]);

  // KeywordTarget.articleId is a plain column rather than a relation, because a
  // registry row outliving a deleted article should lose its link, not block
  // the delete. So the titles are looked up in one go here.
  const keywordArticles = keywords.length
    ? await db.article.findMany({
        where: { id: { in: keywords.map((k) => k.articleId).filter(Boolean) } },
        select: { id: true, title: true, status: true },
      })
    : [];
  const articleById = new Map(keywordArticles.map((a) => [a.id, a]));

  const linkGraph = await buildLinkGraph(creds.wordpress);
  const siteScore = scoreSetting ? parseInt(scoreSetting.value, 10) : null;
  const audit = auditSetting ? JSON.parse(auditSetting.value) : null;
  const appliedCount = resolved.filter((s) => s.status === "applied").length;
  const configured = isSeoAgentConfigured(creds.wordpress);
  const CIRC = 502; // 2πr for r=80
  const gaugeOffset = siteScore != null ? CIRC - (CIRC * siteScore) / 100 : CIRC;
  const avgArticleScore = scoredArticles.length
    ? Math.round(scoredArticles.reduce((s, a) => s + a.seoScore, 0) / scoredArticles.length)
    : null;

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
        <SubTabs items={ANALYTICS_TABS} active="/seo" />
        {/* Hero: gauge + radar + stats */}
        <section
          className="panel panel-glow stagger"
          style={{
            display: "flex",
            gap: 36,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div className="gauge-wrap">
            <svg className="gauge-ring" width="190" height="190" viewBox="0 0 190 190">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5a6aff" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <circle className="gauge-track" cx="95" cy="95" r="80" />
              {siteScore != null && (
                <circle
                  className="gauge-fill"
                  cx="95"
                  cy="95"
                  r="80"
                  style={{ "--gauge-offset": gaugeOffset }}
                />
              )}
            </svg>
            <div className="gauge-number">
              <span className="stat-value num" style={{ fontSize: 44 }}>
                {siteScore != null ? siteScore : "—"}
              </span>
              <span className="micro">site SEO health</span>
            </div>
          </div>

          <div className="radar" aria-hidden="true">
            <span className="radar-blip" style={{ left: "62%", top: "30%" }} />
            <span className="radar-blip" style={{ left: "34%", top: "58%", animationDelay: "1.1s" }} />
            <span className="radar-blip" style={{ left: "70%", top: "68%", animationDelay: "2.2s" }} />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>SEO Analyst</h1>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>
              {configured
                ? audit
                  ? `Monitoring ${site.domain || site.name} — last sweep ${new Date(audit.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} across ${audit.posts} posts.`
                  : "Connected and armed — first sweep runs shortly."
                : "Waiting for Anthropic + WordPress connections."}
            </p>
            {audit?.summary && (
              <p style={{ fontSize: 14, margin: "0 0 14px", color: "var(--neon-cyan)" }}>
                ▸ {audit.summary}
              </p>
            )}
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {[
                { label: "Posts live", value: publishedCount },
                { label: "Recommendations", value: pending.length },
                { label: "Applied", value: appliedCount },
                { label: "Avg article score", value: avgArticleScore ?? "—" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Link map */}
        {linkGraph.nodes.length > 0 && (
          <section className="panel panel-glow" style={{ marginBottom: 24, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Link Map</h2>
              <span className="micro num">
                {linkGraph.nodes.filter((n) => n.kind === "post").length} articles ·{" "}
                {linkGraph.edges.filter((e) => e.to.startsWith("p")).length} internal links ·{" "}
                {linkGraph.nodes.filter((n) => n.kind === "ext").length} outbound domains
              </span>
            </div>
            <p className="micro" style={{ margin: "0 0 8px" }}>
              Live from the site. Drag nodes · hover to trace connections · double-click to open · scroll to zoom
            </p>
            <LinkMap data={linkGraph} />
          </section>
        )}

        {/* Keyword targets */}
        <section className="panel panel-glow" style={{ marginBottom: 24, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Keyword Targets</h2>
            <span className="micro num">
              {keywords.length} tracked · {keywords.filter((k) => k.articleId).length} with an article
            </span>
          </div>
          <p className="micro" style={{ margin: "0 0 12px" }}>
            Terms this title is chasing, best first by the impressions it already earns in Google.
            Bing demand is a sanity check on whether anyone searches the term at all: it counts the
            whole public rather than the trade, so it is never the reason to write something.
          </p>

          {keywords.length === 0 ? (
            <p className="micro" style={{ margin: 0, opacity: 0.7 }}>
              Nothing tracked yet. The registry fills as the Researcher runs, one sweep per title.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Keyword", "Impressions", "Position", "Bing demand", "Trend", "Article"].map((h, i) => (
                      <th
                        key={h}
                        className="micro"
                        style={{
                          textAlign: i === 0 || i === 5 ? "left" : "right",
                          padding: "0 0 8px",
                          borderBottom: "1px solid var(--line)",
                          fontWeight: 400,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((k) => {
                    const article = k.articleId ? articleById.get(k.articleId) : null;
                    // Null trend means too little history to judge, which is not
                    // the same as flat and must not render as 1.00.
                    const rising = k.bingTrend != null && k.bingTrend >= 1.15;
                    const falling = k.bingTrend != null && k.bingTrend <= 0.85;
                    const cell = { padding: "7px 0", borderBottom: "1px solid var(--line)", textAlign: "right" };
                    return (
                      <tr key={k.id}>
                        <td style={{ ...cell, textAlign: "left", paddingRight: 12 }}>{k.term}</td>
                        <td className="num" style={cell}>{k.gscImpressions ?? "—"}</td>
                        <td className="num" style={cell}>
                          {k.gscPosition != null ? k.gscPosition.toFixed(1) : "—"}
                        </td>
                        <td className="num" style={cell}>
                          {k.bingCheckedAt ? k.bingImpressions : "—"}
                        </td>
                        <td
                          className="num"
                          style={{
                            ...cell,
                            color: rising ? "var(--neon-green)" : falling ? "var(--neon-cyan)" : undefined,
                          }}
                        >
                          {k.bingTrend != null ? `${k.bingTrend >= 1 ? "+" : ""}${Math.round((k.bingTrend - 1) * 100)}%` : "—"}
                        </td>
                        <td style={{ ...cell, textAlign: "left", paddingLeft: 12 }}>
                          {article ? (
                            <>
                              {article.title}{" "}
                              <span className="micro" style={{ opacity: 0.6 }}>({article.status})</span>
                            </>
                          ) : (
                            <span className="micro" style={{ opacity: 0.55 }}>
                              {k.status === "candidate" ? "not commissioned" : k.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="split-main-side" style={{ gap: 24 }}>
          {/* Suggestions */}
          <section>
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Recommendations{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>
                — you have final say on every one
              </span>
            </h2>
            {pending.length === 0 && (
              <div className="panel" style={{ color: "var(--muted)", fontSize: 14 }}>
                Nothing pending — the agent files new recommendations after each sweep.
              </div>
            )}
            <div className="stagger" style={{ display: "grid", gap: 14 }}>
              {pending.map((s) => {
                const kind = KIND_LABEL[s.kind] || KIND_LABEL.advice;
                const ic = impactColor(s.impact);
                const payload = s.payload ? JSON.parse(s.payload) : null;
                return (
                  <div key={s.id} className="panel" style={{ display: "flex", gap: 16 }}>
                    <div
                      className="impact-badge"
                      style={{ background: ic.bg, color: ic.color, "--badge-glow": ic.glow }}
                    >
                      {s.impact}
                      <span className="micro" style={{ fontSize: 8, color: ic.color }}>
                        impact
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className={`chip ${kind.chip}`}>{kind.label}</span>
                        <strong style={{ fontSize: 15 }}>{s.title}</strong>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 10px" }}>
                        {s.detail}
                      </p>
                      {payload?.newTitle && (
                        <p className="micro" style={{ margin: "0 0 10px", color: "var(--neon-cyan)" }}>
                          → “{payload.newTitle}”
                        </p>
                      )}
                      {s.status === "failed" && (
                        <p className="micro" style={{ color: "var(--neon-red)", margin: "0 0 10px" }}>
                          Failed: {s.error}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        {s.status === "pending" ? (
                          <form action={approveSeoSuggestion.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={s.id} />
                            <button type="submit" className="btn" style={{ padding: "7px 18px" }}>
                              ✓ Approve{s.kind !== "advice" ? " & apply" : ""}
                            </button>
                          </form>
                        ) : (
                          <form action={retrySeoSuggestion.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={s.id} />
                            <button type="submit" className="btn-ghost" style={{ color: "var(--neon-cyan)" }}>
                              ↻ Retry
                            </button>
                          </form>
                        )}
                        <form action={dismissSeoSuggestion.bind(null, siteRef)}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="btn-ghost">Dismiss</button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right: content quality + history */}
          <section className="stagger" style={{ display: "grid", gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Top content by SEO score</h3>
              {scoredArticles.map((a) => {
                const sc = scoreColor(a.seoScore);
                return (
                  <div
                    key={a.id}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}
                  >
                    <span className="micro" style={{ width: 150, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.title}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        className="hbar"
                        style={{
                          width: `${a.seoScore}%`,
                          background: sc.color,
                          boxShadow: `0 0 10px ${sc.color}`,
                          height: 8,
                        }}
                      />
                    </div>
                    <span className="score-chip" style={{ background: sc.bg, color: sc.color }}>
                      {a.seoScore}
                    </span>
                  </div>
                );
              })}
              {scoredArticles.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                  Articles get scored as the engine drafts them.
                </p>
              )}
            </div>

            {resolved.length > 0 && (
              <div className="panel" style={{ padding: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Recent decisions</h3>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {resolved.map((s) => (
                    <li
                      key={s.id}
                      style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13 }}
                    >
                      <span style={{ color: s.status === "applied" ? "var(--neon-green)" : "var(--muted)" }}>
                        {s.status === "applied" ? "✓" : "✕"}
                      </span>
                      <span style={{ flex: 1, color: "var(--muted)" }}>{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
