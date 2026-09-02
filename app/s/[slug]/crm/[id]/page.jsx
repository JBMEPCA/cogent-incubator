import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import { getSiteContext } from "@/lib/site";
import { updateLead, deleteLead } from "@/lib/actions";
import { STAGES, PRODUCTS } from "@/lib/crm";

export const dynamic = "force-dynamic";

function dateVal(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

const label = { fontSize: 12, color: "var(--muted)", display: "block" };
const field = { width: "100%", marginTop: 4 };

export default async function LeadPage({ params }) {
  const { slug, id } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) notFound();

  return (
    <>
      <Header />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
        <Link href="/crm" style={{ color: "var(--muted)", fontSize: 13 }}>
          ← Back to CRM
        </Link>
        <section className="panel" style={{ marginTop: 12 }}>
          <h1 style={{ margin: "0 0 18px", fontSize: 19 }}>{lead.company}</h1>
          <form action={updateLead.bind(null, siteRef)}>
            <input type="hidden" name="id" value={lead.id} />
            <div className="split-even" style={{ marginBottom: 14 }}>
              <label style={label}>
                Company *
                <input name="company" required defaultValue={lead.company} style={field} />
              </label>
              <label style={label}>
                Contact name
                <input name="contactName" defaultValue={lead.contactName || ""} style={field} />
              </label>
              <label style={label}>
                Email
                <input name="email" type="email" defaultValue={lead.email || ""} style={field} />
              </label>
              <label style={label}>
                Phone
                <input name="phone" defaultValue={lead.phone || ""} style={field} />
              </label>
              <label style={label}>
                Website
                <input name="website" defaultValue={lead.website || ""} style={field} />
              </label>
              <label style={label}>
                Stage
                <select name="stage" defaultValue={lead.stage} style={field}>
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Product
                <select name="product" defaultValue={lead.product || ""} style={field}>
                  <option value="">—</option>
                  {PRODUCTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Offer value (£)
                <input
                  name="offerValue"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={lead.offerValue ?? ""}
                  style={field}
                />
              </label>
              <label style={label}>
                Last contacted
                <input
                  name="lastContacted"
                  type="date"
                  defaultValue={dateVal(lead.lastContacted)}
                  style={field}
                />
              </label>
              <label style={label}>
                Next follow-up
                <input
                  name="nextFollowUp"
                  type="date"
                  defaultValue={dateVal(lead.nextFollowUp)}
                  style={field}
                />
              </label>
            </div>
            <label style={{ ...label, marginBottom: 14 }}>
              <input type="hidden" name="perMonthPresent" value="1" />
              <input
                type="checkbox"
                name="perMonth"
                defaultChecked={lead.perMonth}
                style={{ width: "auto", marginRight: 6 }}
              />
              Value is per month (untick for one-off)
            </label>
            <label style={{ ...label, marginBottom: 16 }}>
              Notes
              <textarea name="notes" rows={5} defaultValue={lead.notes || ""} style={field} />
            </label>
            <button type="submit" className="btn">
              Save
            </button>
          </form>
          <form
            action={deleteLead.bind(null, siteRef)}
            style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}
          >
            <input type="hidden" name="id" value={lead.id} />
            <button type="submit" className="btn-ghost" style={{ color: "var(--neon-red)" }}>
              Delete lead
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
