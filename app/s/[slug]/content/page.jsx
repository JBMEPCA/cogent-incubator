import Link from "next/link";
import Header from "@/app/components/Header";
import SubTabs, { CONTENT_TABS } from "@/app/components/SubTabs";
import ScheduleCalendar from "@/app/components/ScheduleCalendar";
import { upcomingSlots, slotsFor } from "@/lib/schedule";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import {
  addPrBrand,
  togglePrSubscribed,
  deletePrBrand,
  shortlistFeedItem,
  dismissFeedItem,
  addArticleIdea,
  advanceArticle,
  deleteArticle,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const PR_CATEGORIES = [
  "AI & productivity",
  "Automation & workflow",
  "CRM & sales",
  "Finance & banking",
  "HR & people",
  "Cybersecurity",
  "Web, hosting & ecommerce",
  "Connectivity & hardware",
  "UK business & policy",
  "Other",
];


export default async function ContentPage({searchParams, params}) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const query = await searchParams;
  const tab = ["pr", "schedule"].includes(query?.tab) ? query.tab : "engine";
  const cat = query?.cat || "";
  const q = query?.q?.trim() || "";

  let brands = [];
  let categories = [];
  let totalCount = 0;
  let subscribedCount = 0;
  let wire = [];
  let articles = [];
  let engineStats = null;
  if (tab === "engine") {
    const [newItems, feedsOk, totalItems, arts] = await Promise.all([
      db.feedItem.findMany({
        where: { status: "new" },
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { discoveredAt: "desc" }],
        take: 40,
        include: { brand: { select: { name: true, category: true } } },
      }),
      db.prBrand.count({ where: { feedStatus: "ok" } }),
      db.feedItem.count(),
      db.article.findMany({ orderBy: { updatedAt: "desc" }, take: 60 }),
    ]);
    wire = newItems;
    articles = arts;
    engineStats = {
      feedsOk,
      totalItems,
      newItems: await db.feedItem.count({ where: { status: "new" } }),
      scannedBrands: await db.prBrand.count({ where: { lastScannedAt: { not: null } } }),
    };
  }
  let calendarDays = [];
  let scheduleStats = null;
  if (tab === "schedule") {
    const scheduled = await db.article.findMany({
      where: { scheduledFor: { not: null } },
      select: { id: true, title: true, type: true, scheduledFor: true, qaPassed: true, status: true },
    });
    const byIso = new Map(scheduled.map((a) => [a.scheduledFor.toISOString(), a]));
    const slots = upcomingSlots(site, 7);
    const grouped = new Map();
    for (const s of slots) {
      if (!grouped.has(s.dayKey)) grouped.set(s.dayKey, []);
      grouped.get(s.dayKey).push({ ...s, article: byIso.get(s.at.toISOString()) || null });
    }
    const todayKey = new Date().toDateString();
    calendarDays = [...grouped.entries()].map(([key, daySlots]) => ({
      key,
      date: daySlots[0].at,
      isToday: key === todayKey,
      slots: daySlots,
    }));
    scheduleStats = {
      slots: slots.length,
      filled: slots.filter((s) => byIso.has(s.at.toISOString())).length,
      drafting: await db.article.count({ where: { status: "drafting" } }),
      readyPool: await db.article.count({
        where: { qaPassed: true, scheduledFor: null, status: { in: ["review", "approved"] } },
      }),
      needsFix: await db.article.count({
        where: { qaPassed: false, body: { not: null }, status: { not: "published" } },
      }),
    };
  }
  if (tab === "pr") {
    const where = {
      ...(cat ? { category: cat } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    };
    [brands, totalCount, subscribedCount] = await Promise.all([
      db.prBrand.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.prBrand.count(),
      db.prBrand.count({ where: { subscribed: true } }),
    ]);
    const catRows = await db.prBrand.groupBy({ by: ["category"], _count: true });
    categories = catRows
      .filter((c) => c.category)
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={CONTENT_TABS} active={tab === "engine" ? "/content" : `/content?tab=${tab}`} />

        {tab === "schedule" && (
          <>
            <div
              className="stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
                marginBottom: 22,
              }}
            >
              {[
                { label: "Slots this week", value: scheduleStats.slots },
                { label: "Scheduled", value: scheduleStats.filled, glow: true },
                { label: "Writing now", value: scheduleStats.drafting },
                { label: "Ready pool", value: scheduleStats.readyPool },
                { label: "Held by QA", value: scheduleStats.needsFix, warn: scheduleStats.needsFix > 0 },
              ].map((s) => (
                <div key={s.label} className="panel stat-tile">
                  <div className="stat-label">{s.label}</div>
                  <div
                    className="stat-value"
                    style={{
                      color: s.warn
                        ? "var(--neon-amber)"
                        : s.glow
                          ? "var(--neon-cyan)"
                          : "var(--text)",
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <section className="panel panel-glow" style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>Publishing calendar</h2>
                <span className="micro">
                  {slotsFor(site).length} {slotsFor(site).length === 1 ? "article" : "articles"} a day · news mornings,
                  guides afternoons, case studies midweek and weekends
                </span>
              </div>
              <p className="micro" style={{ margin: "0 0 14px" }}>
                The Director commissions and the Editor writes, during working hours. Nothing publishes until it has passed
                editorial QA and its image has been visually verified.
              </p>
              <ScheduleCalendar days={calendarDays} slots={slotsFor(site)} />
            </section>
          </>
        )}

        {tab === "engine" && (
          <>
            {/* Engine stats */}
            <div
              className="stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
                marginBottom: 22,
              }}
            >
              {[
                { label: "Sources with live feeds", value: engineStats.feedsOk },
                { label: "Sources scanned", value: engineStats.scannedBrands },
                { label: "Stories ingested", value: engineStats.totalItems },
                { label: "New on the wire", value: engineStats.newItems, glow: true },
              ].map((s) => (
                <div key={s.label} className="panel stat-tile">
                  <div className="stat-label">{s.label}</div>
                  <div
                    className="stat-value"
                    style={s.glow ? { color: "var(--neon-cyan)" } : undefined}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: 24,
                alignItems: "start",
              }}
            >
              {/* The wire */}
              <section className="panel">
                <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>The Wire</h2>
                <p className="micro" style={{ margin: "0 0 14px" }}>
                  Latest stories from your PR sources — shortlist to queue a rewrite
                </p>
                {wire.length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>
                    Nothing new — the hourly scan is working through the source list.
                  </p>
                )}
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {wire.map((item) => (
                    <li
                      key={item.id}
                      style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
                    >
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}
                      >
                        {item.title} ↗
                      </a>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginTop: 4,
                        }}
                      >
                        <span className="micro" style={{ color: "var(--neon-cyan)" }}>
                          {item.brand.name}
                        </span>
                        {item.publishedAt && (
                          <span className="micro">
                            {new Date(item.publishedAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          <form action={shortlistFeedItem.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={item.id} />
                            <button
                              type="submit"
                              className="btn-ghost"
                              style={{ color: "var(--neon-green)", fontSize: 12 }}
                              title="Queue a rewrite of this story"
                            >
                              + shortlist
                            </button>
                          </form>
                          <form action={dismissFeedItem.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="btn-ghost" title="Dismiss">
                              ✕
                            </button>
                          </form>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Article pipeline */}
              <section className="panel">
                <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Article pipeline</h2>
                <form
                  action={addArticleIdea.bind(null, siteRef)}
                  style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
                >
                  <input
                    name="title"
                    placeholder="Add SEO article idea…"
                    required
                    style={{ flex: "1 1 180px" }}
                  />
                  <input name="keywords" placeholder="Target keywords" style={{ flex: "1 1 120px" }} />
                  <button type="submit" className="btn">
                    Add
                  </button>
                </form>
                {articles.length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>
                    No articles yet — shortlist wire stories or add SEO ideas.
                  </p>
                )}
                {["idea", "drafting", "review", "approved", "published"].map((stage) => {
                  const inStage = articles.filter((a) => a.status === stage);
                  if (inStage.length === 0) return null;
                  return (
                    <div key={stage} style={{ marginBottom: 14 }}>
                      <h3 className="micro" style={{ margin: "0 0 6px" }}>
                        {stage === "drafting" ? "drafting, with the Editor" : stage} ({inStage.length})
                      </h3>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {inStage.map((a) => (
                          <li
                            key={a.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 0",
                              borderBottom: "1px solid var(--line)",
                              fontSize: 13,
                            }}
                          >
                            <span
                              className={`chip ${a.type === "pr_rewrite" ? "chip-brand" : "chip-content"}`}
                            >
                              {a.type === "pr_rewrite" ? "PR" : "SEO"}
                            </span>
                            {a.seoScore != null && (
                              <span
                                className="score-chip"
                                style={
                                  a.seoScore >= 75
                                    ? { background: "rgba(5,150,105,0.16)", color: "#6ee7b7" }
                                    : a.seoScore >= 50
                                      ? { background: "rgba(8,145,178,0.16)", color: "#67e8f9" }
                                      : { background: "rgba(217,119,6,0.14)", color: "#fcd34d" }
                                }
                                title={a.scoreRationale || "SEO benefit score"}
                              >
                                {a.seoScore}
                              </span>
                            )}
                            <span style={{ flex: 1 }}>
                              <Link href={`/content/article/${a.id}`} style={{ color: "var(--text)" }}>
                                {a.title}
                              </Link>
                              {a.keywords && (
                                <span className="micro" style={{ marginLeft: 8 }}>
                                  {a.keywords}
                                </span>
                              )}
                            </span>
                            {stage !== "published" && (
                              <form action={advanceArticle.bind(null, siteRef)}>
                                <input type="hidden" name="id" value={a.id} />
                                <button
                                  type="submit"
                                  className="btn-ghost"
                                  style={{ color: "var(--neon-cyan)", fontSize: 12 }}
                                  title="Advance to next stage"
                                >
                                  advance →
                                </button>
                              </form>
                            )}
                            <form action={deleteArticle.bind(null, siteRef)}>
                              <input type="hidden" name="id" value={a.id} />
                              <button type="submit" className="btn-ghost" title="Delete">
                                ✕
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>
            </div>
          </>
        )}

        {tab === "pr" && (
          <>
            <section className="panel" style={{ marginBottom: 22 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 12,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 16 }}>Add PR source</h2>
                <span className="micro num">
                  {subscribedCount}/{totalCount} subscribed
                </span>
              </div>
              <form
                action={addPrBrand.bind(null, siteRef)}
                style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
              >
                <input name="name" placeholder="Brand *" required style={{ flex: "1 1 140px" }} />
                <select name="category" defaultValue="Other">
                  {PR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input name="newsHubUrl" placeholder="News hub URL" style={{ flex: "1 1 180px" }} />
                <input
                  name="newsletterUrl"
                  placeholder="Email signup URL"
                  style={{ flex: "1 1 180px" }}
                />
                <input name="notes" placeholder="Notes" style={{ flex: "1 1 120px" }} />
                <button type="submit" className="btn">
                  Add
                </button>
              </form>
            </section>

            <section className="panel" style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 16 }}>
                  PR content sources{" "}
                  <span className="num" style={{ color: "var(--muted)", fontWeight: 400 }}>
                    ({brands.length}
                    {brands.length !== totalCount ? ` of ${totalCount}` : ""})
                  </span>
                </h2>
                <form
                  method="get"
                  action="/content"
                  style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}
                >
                  <input type="hidden" name="tab" value="pr" />
                  <select name="cat" defaultValue={cat}>
                    <option value="">All categories ({totalCount})</option>
                    {categories.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.category} ({c._count})
                      </option>
                    ))}
                  </select>
                  <input name="q" placeholder="Search brand…" defaultValue={q} style={{ width: 150 }} />
                  <button type="submit" className="btn" style={{ padding: "8px 14px" }}>
                    Filter
                  </button>
                  {(cat || q) && (
                    <Link
                      href="/content?tab=pr"
                      className="nav-link"
                      style={{ alignSelf: "center", fontSize: 13 }}
                    >
                      Clear
                    </Link>
                  )}
                </form>
              </div>
              {brands.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 14 }}>No sources yet.</p>
              )}
              {brands.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th className="micro" style={{ padding: "6px 8px" }}>Brand</th>
                      <th className="micro" style={{ padding: "6px 8px" }}>Category</th>
                      <th className="micro" style={{ padding: "6px 8px" }}>News hub</th>
                      <th className="micro" style={{ padding: "6px 8px" }}>Email signup</th>
                      <th className="micro" style={{ padding: "6px 8px" }}>Subscribed</th>
                      <th className="micro" style={{ padding: "6px 8px" }}>Notes</th>
                      <th style={{ padding: "6px 8px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => (
                      <tr key={b.id} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>
                          {b.website ? (
                            <a
                              href={b.website}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--text)" }}
                            >
                              {b.name}
                            </a>
                          ) : (
                            b.name
                          )}
                        </td>
                        <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                          {b.category || "—"}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {b.newsHubUrl ? (
                            <a
                              href={b.newsHubUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--neon-cyan)", fontSize: 13 }}
                            >
                              News hub ↗
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {b.newsletterUrl ? (
                            <a
                              href={b.newsletterUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--neon-green)", fontSize: 13 }}
                            >
                              Sign up ↗
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <form action={togglePrSubscribed.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={b.id} />
                            <button
                              type="submit"
                              className="btn-ghost"
                              title="Toggle subscribed"
                              style={{
                                color: b.subscribed ? "var(--neon-green)" : "var(--muted)",
                              }}
                            >
                              {b.subscribed ? "✓ yes" : "○ no"}
                            </button>
                          </form>
                        </td>
                        <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                          {b.notes || ""}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <form action={deletePrBrand.bind(null, siteRef)}>
                            <input type="hidden" name="id" value={b.id} />
                            <button type="submit" className="btn-ghost" title="Delete">
                              ✕
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
