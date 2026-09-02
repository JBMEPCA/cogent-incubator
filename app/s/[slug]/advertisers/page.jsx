import Header from "@/app/components/Header";
import SubTabs, { CRM_TABS } from "@/app/components/SubTabs";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { addProspect, deleteProspect, promoteProspect } from "@/lib/actions";
import { PRODUCTS, productLabel } from "@/lib/crm";

export const dynamic = "force-dynamic";

const AD_CATEGORIES = [
  "AI productivity & writing",
  "Workflow & automation",
  "CRM & sales tech",
  "Finance & accounting",
  "Banking & payments",
  "HR & people tech",
  "Cybersecurity",
  "Web, hosting & ecommerce",
  "Connectivity & hardware",
  "Insurance & services",
  "Other",
];

export default async function AdvertisersPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const prospects = await db.advertiserProspect.findMany({
    orderBy: [{ category: "asc" }, { company: "asc" }],
  });
  const promoted = prospects.filter((p) => p.promotedLeadId).length;
  const categories = [...new Set(prospects.map((p) => p.category))];

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
        <SubTabs items={CRM_TABS} active="/advertisers" />
        <div
          className="stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <div className="panel stat-tile">
            <div className="stat-label">Prospects identified</div>
            <div className="stat-value">{prospects.length}</div>
          </div>
          <div className="panel stat-tile">
            <div className="stat-label">Categories</div>
            <div className="stat-value">{categories.length}</div>
          </div>
          <div className="panel stat-tile">
            <div className="stat-label">Promoted to CRM</div>
            <div className="stat-value" style={{ color: "var(--neon-green)" }}>
              {promoted}
            </div>
          </div>
        </div>

        <section className="panel" style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Add prospect</h2>
          <form
            action={addProspect.bind(null, siteRef)}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <input name="company" placeholder="Company *" required style={{ flex: "1 1 150px" }} />
            <input name="website" placeholder="Website" style={{ flex: "1 1 160px" }} />
            <select name="category" defaultValue="Other">
              {AD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="suggestedProduct" defaultValue="">
              <option value="">Product fit…</option>
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input name="rationale" placeholder="Why them?" style={{ flex: "2 1 200px" }} />
            <button type="submit" className="btn">
              Add
            </button>
          </form>
        </section>

        {categories.map((cat) => (
          <section key={cat} className="panel" style={{ marginBottom: 18, overflowX: "auto" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>
              {cat}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13 }}>
                ({prospects.filter((p) => p.category === cat).length})
              </span>
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                {prospects
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {p.website ? (
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--neon-cyan)" }}
                          >
                            {p.company} ↗
                          </a>
                        ) : (
                          p.company
                        )}
                      </td>
                      <td style={{ padding: "8px", color: "var(--muted)", fontSize: 13 }}>
                        {p.rationale || ""}
                      </td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {p.suggestedProduct && (
                          <span className="chip chip-general">{productLabel(p.suggestedProduct)}</span>
                        )}
                      </td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap", textAlign: "right" }}>
                        {p.promotedLeadId ? (
                          <span className="micro" style={{ color: "var(--neon-green)" }}>
                            ✓ in CRM
                          </span>
                        ) : (
                          <form action={promoteProspect.bind(null, siteRef)} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              className="btn-ghost"
                              style={{ color: "var(--neon-cyan)", fontSize: 12 }}
                              title="Create a CRM lead from this prospect"
                            >
                              → CRM
                            </button>
                          </form>
                        )}
                        <form action={deleteProspect.bind(null, siteRef)} style={{ display: "inline", marginLeft: 6 }}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="btn-ghost" title="Delete">
                            ✕
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
        {prospects.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No prospects yet.</p>
        )}
      </main>
    </>
  );
}
