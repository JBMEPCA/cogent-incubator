import Link from "next/link";
import Header from "@/app/components/Header";
import SubTabs, { CRM_TABS } from "@/app/components/SubTabs";
import { prisma } from "@/lib/prisma";
import { addLead, markContacted } from "@/lib/actions";
import { STAGES, PRODUCTS, OPEN_STAGES, stageInfo, productLabel, fmtMoney } from "@/lib/crm";

export const dynamic = "force-dynamic";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function CrmPage() {
  const leads = await prisma.lead.findMany({ orderBy: { updatedAt: "desc" } });

  const now = new Date();
  const stageOrder = Object.fromEntries(STAGES.map((s, i) => [s.value, i]));
  const sorted = [...leads].sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage]);

  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const won = leads.filter((l) => l.stage === "won");
  const pipelineValue = open.reduce((s, l) => s + (l.offerValue || 0), 0);
  const wonMonthly = won.reduce((s, l) => s + (l.perMonth ? l.offerValue || 0 : 0), 0);
  const wonOneOff = won.reduce((s, l) => s + (!l.perMonth ? l.offerValue || 0 : 0), 0);
  const followUpsDue = open.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp) <= now);

  const stats = [
    { label: "Open leads", value: open.length },
    { label: "Follow-ups due", value: followUpsDue.length, alert: followUpsDue.length > 0 },
    { label: "Pipeline value", value: `£${pipelineValue.toLocaleString("en-GB")}` },
    {
      label: "Won",
      value: `£${wonMonthly.toLocaleString("en-GB")}/mo${wonOneOff ? ` + £${wonOneOff.toLocaleString("en-GB")}` : ""}`,
    },
  ];

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={CRM_TABS} active="/crm" />
        {/* Summary */}
        <div
          className="stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {stats.map((s) => (
            <div key={s.label} className="panel stat-tile">
              <div className="stat-label">{s.label}</div>
              <div
                className="stat-value"
                style={{ color: s.alert ? "var(--neon-amber)" : "var(--text)" }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Add lead */}
        <section className="panel" style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Add lead</h2>
          <form
            action={addLead}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <input name="company" placeholder="Company *" required style={{ flex: "1 1 160px" }} />
            <input name="contactName" placeholder="Contact name" style={{ flex: "1 1 130px" }} />
            <input name="email" type="email" placeholder="Email" style={{ flex: "1 1 170px" }} />
            <select name="product" defaultValue="">
              <option value="">Product…</option>
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              name="offerValue"
              type="number"
              step="1"
              min="0"
              placeholder="£ value"
              style={{ width: 90 }}
            />
            <select name="stage" defaultValue="prospect">
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Follow up
              <br />
              <input name="nextFollowUp" type="date" style={{ marginTop: 4 }} />
            </label>
            <button type="submit" className="btn">
              Add
            </button>
          </form>
        </section>

        {/* Leads table */}
        <section className="panel" style={{ overflowX: "auto" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
            Leads <span style={{ color: "var(--muted)", fontWeight: 400 }}>({leads.length})</span>
          </h2>
          {leads.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              No leads yet — add your first one above.
            </p>
          )}
          {leads.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                  <th style={{ padding: "6px 8px" }}>Company</th>
                  <th style={{ padding: "6px 8px" }}>Contact</th>
                  <th style={{ padding: "6px 8px" }}>Stage</th>
                  <th style={{ padding: "6px 8px" }}>Product</th>
                  <th style={{ padding: "6px 8px" }}>Value</th>
                  <th style={{ padding: "6px 8px" }}>Last contact</th>
                  <th style={{ padding: "6px 8px" }}>Follow up</th>
                  <th style={{ padding: "6px 8px" }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => {
                  const info = stageInfo(l.stage);
                  const overdue =
                    l.nextFollowUp &&
                    new Date(l.nextFollowUp) <= now &&
                    OPEN_STAGES.includes(l.stage);
                  return (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px" }}>
                        <Link
                          href={`/crm/${l.id}`}
                          style={{ fontWeight: 600, color: "var(--neon-cyan)" }}
                        >
                          {l.company}
                        </Link>
                      </td>
                      <td style={{ padding: "8px", color: "var(--muted)" }}>
                        {l.contactName || "—"}
                        {l.email && (
                          <div style={{ fontSize: 12 }}>
                            <a href={`mailto:${l.email}`} style={{ color: "var(--muted)" }}>
                              {l.email}
                            </a>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <span
                          className="chip"
                          style={{ background: info.bg, color: info.color }}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px" }}>{productLabel(l.product)}</td>
                      <td style={{ padding: "8px" }}>{fmtMoney(l.offerValue, l.perMonth)}</td>
                      <td style={{ padding: "8px", color: "var(--muted)" }}>
                        {l.lastContacted ? fmtDate(l.lastContacted) : "never"}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          color: overdue ? "var(--neon-red)" : "var(--muted)",
                          fontWeight: overdue ? 700 : 400,
                        }}
                      >
                        {l.nextFollowUp ? fmtDate(l.nextFollowUp) : "—"}
                      </td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        <form action={markContacted} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={l.id} />
                          <button
                            type="submit"
                            className="btn-ghost"
                            title="Log contact today"
                            style={{ fontSize: 12 }}
                          >
                            ✓ contacted
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
