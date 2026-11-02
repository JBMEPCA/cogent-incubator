import Link from "next/link";
import { notFound } from "next/navigation";
import FleetNav from "@/app/components/FleetNav";
import SubTabs, { FLEET_COMMERCIAL_TABS } from "@/app/components/SubTabs";
import BlackBookTitlePills from "@/app/components/BlackBookTitlePills";
import CampaignAssetUpload from "@/app/components/CampaignAssetUpload";
import ConfirmSubmit from "@/app/components/ConfirmSubmit";
import { prisma } from "@/lib/prisma";
import { listSites } from "@/lib/site";
import { shortTitle } from "@/lib/black-book-labels";
import { PRODUCTS, productLabel } from "@/lib/crm";
import {
  CAMPAIGN_STATUSES,
  DELIVERABLE_STATUSES,
  PAYMENT_STATUSES,
  RESULT_SOURCES,
  STATE_CHIP,
  campaignStatus,
  ctr,
  deliverableState,
  deliverableStatusLabel,
  fmtBytes,
  money,
  paymentLate,
  paymentStatusLabel,
  totals,
  ukDay,
} from "@/lib/campaigns";
import {
  addAssetLink,
  addDeliverable,
  addPayment,
  addResult,
  deleteAsset,
  deleteCampaign,
  deleteDeliverable,
  deletePayment,
  deleteResult,
  schedulePayments,
  updateCampaign,
  updateDeliverable,
  updatePayment,
} from "@/lib/campaign-actions";

export const dynamic = "force-dynamic";

const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }) : "—";
const dateVal = (d) => (d ? ukDay(d) : "");
const n = (v) => (v == null ? "—" : v.toLocaleString("en-GB"));
const pounds = (pence) => (pence ? (pence / 100).toFixed(2) : "");

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id }, select: { name: true } });
  return { title: c ? `${c.name} · Campaigns` : "Campaigns" };
}

export default async function CampaignPage({ params }) {
  const { id } = await params;
  const [c, sites] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        advertiser: { select: { company: true, domain: true, website: true } },
        deliverables: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
        payments: { orderBy: { dueDate: "asc" } },
        results: { orderBy: { periodEnd: "desc" }, include: { deliverable: { select: { title: true } } } },
        // Never the bytes: those are served one at a time by /api/campaign-assets.
        assets: {
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, url: true, mimeType: true, size: true, width: true, height: true, uploadedBy: true, createdAt: true, deliverableId: true },
        },
      },
    }),
    listSites(),
  ]);
  if (!c) notFound();

  const now = new Date();
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const campaignSites = c.siteIds.length ? sites.filter((s) => c.siteIds.includes(s.id)) : sites;
  const st = campaignStatus(c.status);
  const titleName = (sid) => (sid && siteById.get(sid) ? shortTitle(siteById.get(sid).name) : null);
  const deliverableTitle = new Map(c.deliverables.map((d) => [d.id, d.title]));

  const live = c.deliverables.filter((d) => d.status !== "cancelled");
  const done = live.filter((d) => d.status === "live" || d.status === "delivered").length;
  const paid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountPence, 0);
  const scheduled = c.payments.reduce((s, p) => s + p.amountPence, 0);
  const t = totals(c.results);

  // A plain summary to paste into an email to the client. House style: no em dashes.
  const report = [
    `${c.advertiser.company}: ${c.name}`,
    `${fmtDay(c.startDate)} to ${fmtDay(c.endDate)}`,
    "",
    ...live.map((d) => {
      const tn = titleName(d.siteId);
      const out = d.deliveredAt ? `${d.title}, ${d.status === "live" ? "live" : "delivered"} ${fmtDay(d.deliveredAt)}` : `${d.title}, ${deliverableStatusLabel(d.status).toLowerCase()}`;
      return `- ${tn ? `${tn.label}: ` : ""}${out}${d.liveUrl ? ` (${d.liveUrl})` : ""}`;
    }),
    "",
    t.impressions ? `Impressions: ${t.impressions.toLocaleString("en-GB")}` : null,
    t.clicks ? `Clicks: ${t.clicks.toLocaleString("en-GB")}${t.impressions ? ` (CTR ${ctr(t.clicks, t.impressions)})` : ""}` : null,
    t.recipients ? `Sent to: ${t.recipients.toLocaleString("en-GB")}` : null,
    t.opens ? `Opens: ${t.opens.toLocaleString("en-GB")}${t.recipients ? ` (${((t.opens / t.recipients) * 100).toFixed(1)}%)` : ""}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const summary = [
    { label: "Value", value: money(c.valuePence) },
    { label: "Paid", value: money(paid) },
    { label: "Outstanding", value: money(Math.max(0, c.valuePence - paid)) },
    { label: "Delivered", value: live.length ? `${done} of ${live.length}` : "—" },
    { label: "Impressions", value: n(t.impressions || null) },
    { label: "Clicks", value: n(t.clicks || null) },
    { label: "CTR", value: ctr(t.clicks, t.impressions) || "—" },
  ];

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">
            <Link href="/campaigns" style={{ color: "var(--muted)" }}>
              ← Campaigns
            </Link>
          </span>
          <h1>
            {c.advertiser.company} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {c.name}</span>
          </h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>
      <SubTabs items={FLEET_COMMERCIAL_TABS} active="/campaigns" />

      <div style={{ maxWidth: 1360, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 22 }}>
        <section className="panel panel-glow stagger">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <span className={`chip ${st.chip}`}>{st.label}</span>
            <span className="micro" style={{ color: "var(--muted)" }}>
              {fmtDay(c.startDate)} to {fmtDay(c.endDate)}
              {c.bookedBy ? ` · booked by ${c.bookedBy}` : ""}
              {c.clientContact ? ` · client: ${c.clientContact}` : ""}
            </span>
            <span className="adv-pills">
              {c.siteIds.length === 0 ? (
                <span className="adv-pill">🌍 All titles</span>
              ) : (
                campaignSites.map((s) => (
                  <span key={s.id} className="adv-pill" title={s.name}>
                    {shortTitle(s.name).emoji} {shortTitle(s.name).label}
                  </span>
                ))
              )}
            </span>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {summary.map((s) => (
              <div key={s.label}>
                <div className="stat-value" style={{ fontSize: 22 }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          {c.specMd && <p className="bb-notes" style={{ whiteSpace: "pre-wrap", marginTop: 14 }}>{c.specMd}</p>}
        </section>

        {/* ---------------- deliverables */}
        <section className="panel stagger adv-body">
          <h2 style={{ margin: 0, fontSize: 16 }}>What we owe the client</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
            One row per placement, send or piece. Material due is the client&apos;s deadline; Due is ours.
          </p>
          {c.deliverables.length > 0 && (
            <div className="adv-list">
              <div className="camp-del adv-sum-head micro" aria-hidden="true">
                <span>Deliverable</span>
                <span>Title</span>
                <span>Material due</span>
                <span>Due</span>
                <span>Status</span>
              </div>
              {c.deliverables.map((d) => {
                const ds = deliverableState(d, now);
                const tn = titleName(d.siteId);
                return (
                  <details key={d.id} className="adv-row">
                    <summary className="camp-del">
                      <span className="adv-brand">
                        <strong>{d.title}</strong>
                        <span className="micro" style={{ color: "var(--muted)" }}>
                          {[d.product && productLabel(d.product), d.spec].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="micro">{tn ? `${tn.emoji} ${tn.label}` : "—"}</span>
                      <span className="micro">{fmtDay(d.assetsDue)}</span>
                      <span className="micro">
                        {fmtDay(d.dueDate)}
                        {d.runUntil && <span style={{ display: "block", color: "var(--muted)" }}>runs to {fmtDay(d.runUntil)}</span>}
                      </span>
                      <span>
                        <span className={`chip ${STATE_CHIP[ds.level]}`}>{ds.label}</span>
                      </span>
                    </summary>
                    <div className="adv-body">
                      {d.liveUrl && (
                        <a href={d.liveUrl} target="_blank" rel="noreferrer" className="micro" style={{ color: "var(--neon-cyan)" }}>
                          {d.liveUrl} ↗
                        </a>
                      )}
                      <form action={updateDeliverable.bind(null, d.id)} className="bb-form">
                        <DeliverableFields d={d} sites={campaignSites} />
                        <label className="field">
                          <span className="micro">Status</span>
                          <select name="status" defaultValue={d.status}>
                            {DELIVERABLE_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field field-wide">
                          <span className="micro">Live link, proof or report URL</span>
                          <input name="liveUrl" type="url" defaultValue={d.liveUrl || ""} placeholder="https://" />
                        </label>
                        <div className="field-wide bb-actions">
                          <button type="submit" className="btn">Save</button>
                          {d.deliveredAt && <span className="micro" style={{ color: "var(--muted)" }}>Went out {fmtDay(d.deliveredAt)}</span>}
                        </div>
                      </form>
                      <div>
                        <ConfirmSubmit action={deleteDeliverable.bind(null, d.id)} question={`Delete "${d.title}"?`} label="Delete deliverable" />
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          <details className="adv-panel">
            <summary>
              <h2 style={{ fontSize: 14 }}>Add a deliverable</h2>
            </summary>
            <form action={addDeliverable.bind(null, c.id)} className="bb-form">
              <DeliverableFields sites={campaignSites} />
              <div className="field-wide bb-actions">
                <button type="submit" className="btn">Add</button>
              </div>
            </form>
          </details>
        </section>

        {/* ---------------- results */}
        <section className="panel stagger adv-body">
          <h2 style={{ margin: 0, fontSize: 16 }}>Results</h2>
          {c.results.length > 0 ? (
            <table className="adv-table">
              <thead className="micro" style={{ color: "var(--muted)", textAlign: "left" }}>
                <tr>
                  <th>Period</th>
                  <th>For</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Sent</th>
                  <th>Opens</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.results.map((r) => (
                  <tr key={r.id}>
                    <td className="micro">
                      {r.periodStart ? `${fmtDay(r.periodStart)} to ` : "To "}
                      {fmtDay(r.periodEnd)}
                    </td>
                    <td className="micro">{r.deliverable?.title || "Whole campaign"}</td>
                    <td>{n(r.impressions)}</td>
                    <td>{n(r.clicks)}</td>
                    <td className="micro">{ctr(r.clicks, r.impressions)}</td>
                    <td>{n(r.recipients)}</td>
                    <td>{n(r.opens)}</td>
                    <td className="micro" title={r.notes || undefined}>
                      {RESULT_SOURCES.find((s) => s.value === r.source)?.label || r.source}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <ConfirmSubmit action={deleteResult.bind(null, r.id)} question="Delete these numbers?" label="✕" />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}><strong>Total</strong></td>
                  <td><strong>{n(t.impressions || null)}</strong></td>
                  <td><strong>{n(t.clicks || null)}</strong></td>
                  <td className="micro">{ctr(t.clicks, t.impressions)}</td>
                  <td><strong>{n(t.recipients || null)}</strong></td>
                  <td><strong>{n(t.opens || null)}</strong></td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>No numbers yet. Add them as each period closes.</p>
          )}
          <form action={addResult.bind(null, c.id)} className="adv-inline">
            <input name="periodStart" type="date" aria-label="From" title="From" />
            <input name="periodEnd" type="date" required aria-label="To" title="To" defaultValue={ukDay(now)} />
            {c.deliverables.length > 0 && (
              <select name="deliverableId" defaultValue="" aria-label="For deliverable">
                <option value="">Whole campaign</option>
                {c.deliverables.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            )}
            <input name="impressions" inputMode="numeric" placeholder="Impressions" style={{ width: 110 }} />
            <input name="clicks" inputMode="numeric" placeholder="Clicks" style={{ width: 80 }} />
            <input name="recipients" inputMode="numeric" placeholder="Sent to" style={{ width: 90 }} />
            <input name="opens" inputMode="numeric" placeholder="Opens" style={{ width: 80 }} />
            <select name="source" defaultValue="manual" aria-label="Source">
              {RESULT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input name="notes" placeholder="Note" style={{ flex: "1 1 140px" }} />
            <button type="submit" className="btn-ghost">Add numbers</button>
          </form>
          <details className="adv-panel">
            <summary>
              <h2 style={{ fontSize: 14 }}>Report for the client</h2>
            </summary>
            {/* Keyed on the text: defaultValue is only read on mount, so without
                this the box kept the report from before the latest numbers. */}
            <textarea key={report} readOnly rows={Math.min(18, report.split("\n").length + 1)} defaultValue={report} style={{ width: "100%", fontFamily: "inherit" }} />
          </details>
        </section>

        {/* ---------------- payments */}
        <section className="panel stagger adv-body">
          <h2 style={{ margin: 0, fontSize: 16 }}>Payments</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
            When the money reaches the Cogent account. Scheduled {money(scheduled)} of {money(c.valuePence)}
            {scheduled !== c.valuePence && c.valuePence > 0 ? `, so ${money(Math.abs(c.valuePence - scheduled))} ${scheduled < c.valuePence ? "still to schedule" : "more than the value"}` : ""}.
          </p>
          {c.payments.length > 0 && (
            <table className="adv-table">
              <tbody>
                {c.payments.map((p) => (
                  <tr key={p.id}>
                    <td colSpan={2}>
                      <form action={updatePayment.bind(null, p.id)} className="adv-inline" style={{ margin: 0 }}>
                        <input name="amount" inputMode="decimal" defaultValue={pounds(p.amountPence)} aria-label="Amount £" style={{ width: 100 }} />
                        <input name="dueDate" type="date" defaultValue={dateVal(p.dueDate)} aria-label="Due" title="Due" />
                        <select name="status" defaultValue={p.status} aria-label="Status">
                          {PAYMENT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <input name="paidAt" type="date" defaultValue={dateVal(p.paidAt)} aria-label="Paid on" title="Paid on" />
                        <input name="invoiceRef" defaultValue={p.invoiceRef || ""} placeholder="Invoice no." style={{ width: 110 }} />
                        <button type="submit" className="btn-ghost">Save</button>
                      </form>
                    </td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <span className={`chip ${p.status === "paid" ? "chip-audience" : paymentLate(p, now) ? "chip-monetise" : "chip-general"}`} style={{ marginRight: 8 }}>
                        {paymentLate(p, now) ? "Late" : paymentStatusLabel(p.status)}
                      </span>
                      <ConfirmSubmit action={deletePayment.bind(null, p.id)} question={`Delete the ${money(p.amountPence)} payment due ${fmtDay(p.dueDate)}?`} label="✕" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={schedulePayments.bind(null, c.id)} className="adv-inline">
            <span className="micro">Split</span>
            <input name="total" inputMode="decimal" defaultValue={pounds(Math.max(0, c.valuePence - scheduled))} aria-label="Total £" style={{ width: 110 }} />
            <span className="micro">into</span>
            <input name="months" inputMode="numeric" defaultValue={c.startDate && c.endDate ? Math.max(1, monthsBetween(c.startDate, c.endDate)) : 12} aria-label="Months" style={{ width: 60 }} />
            <span className="micro">monthly payments, first due</span>
            <input name="firstDue" type="date" defaultValue={dateVal(c.startDate || now)} aria-label="First due" />
            <button type="submit" className="btn-ghost">Schedule</button>
          </form>
          <form action={addPayment.bind(null, c.id)} className="adv-inline">
            <span className="micro">Or one payment of £</span>
            <input name="amount" inputMode="decimal" required aria-label="Amount £" style={{ width: 100 }} />
            <input name="dueDate" type="date" required aria-label="Due" title="Due" />
            <input name="invoiceRef" placeholder="Invoice no." style={{ width: 110 }} />
            <button type="submit" className="btn-ghost">Add payment</button>
          </form>
        </section>

        {/* ---------------- assets */}
        <section className="panel stagger adv-body">
          <h2 style={{ margin: 0, fontSize: 16 }}>Material from the client</h2>
          {c.assets.length > 0 ? (
            <div className="camp-assets">
              {c.assets.map((a) => {
                const href = a.url || `/api/campaign-assets/${a.id}`;
                const img = !a.url && /^image\//.test(a.mimeType || "");
                return (
                  <figure key={a.id} className="camp-asset">
                    <a href={href} target="_blank" rel="noreferrer" className="camp-asset-view">
                      {img ? (
                        // Served from our own route behind sign-in, so next/image's optimiser cannot fetch it.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={href} alt={a.name} loading="lazy" />
                      ) : (
                        <span className="micro">{a.url ? "Link ↗" : (a.mimeType || "file").split("/").pop().toUpperCase()}</span>
                      )}
                    </a>
                    <figcaption className="micro">
                      <strong style={{ overflowWrap: "anywhere" }}>{a.name}</strong>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {[a.width && a.height ? `${a.width}×${a.height}` : null, fmtBytes(a.size), a.deliverableId ? deliverableTitle.get(a.deliverableId) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span style={{ color: "var(--muted)", display: "block" }}>
                        {fmtDay(a.createdAt)}
                        {a.uploadedBy ? ` · ${a.uploadedBy}` : ""}
                      </span>
                      <span className="camp-asset-acts">
                        {!a.url && (
                          <a href={`${href}?download=1`} style={{ color: "var(--neon-cyan)" }}>
                            Download
                          </a>
                        )}
                        <ConfirmSubmit action={deleteAsset.bind(null, a.id)} question={`Delete ${a.name}?`} label="Delete" />
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>Nothing uploaded yet.</p>
          )}
          <CampaignAssetUpload campaignId={c.id} deliverables={c.deliverables.map((d) => ({ id: d.id, title: d.title }))} />
          <form action={addAssetLink.bind(null, c.id)} className="adv-inline">
            <input name="url" type="url" required placeholder="https:// link to a Drive folder, WeTransfer or video" style={{ flex: "2 1 260px" }} />
            <input name="name" placeholder="What it is" style={{ flex: "1 1 160px" }} />
            {c.deliverables.length > 0 && (
              <select name="deliverableId" defaultValue="" aria-label="For deliverable">
                <option value="">Whole campaign</option>
                {c.deliverables.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            )}
            <button type="submit" className="btn-ghost">Add link</button>
          </form>
        </section>

        {/* ---------------- details */}
        <details className="panel stagger adv-panel">
          <summary>
            <h2>Campaign details</h2>
          </summary>
          <form action={updateCampaign.bind(null, c.id)} className="bb-form">
            <label className="field">
              <span className="micro">Name</span>
              <input name="name" required defaultValue={c.name} />
            </label>
            <label className="field">
              <span className="micro">Status</span>
              <select name="status" defaultValue={c.status}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="micro">Value, £ ex VAT</span>
              <input name="value" inputMode="decimal" defaultValue={pounds(c.valuePence)} />
            </label>
            <label className="field">
              <span className="micro">Starts</span>
              <input name="startDate" type="date" defaultValue={dateVal(c.startDate)} />
            </label>
            <label className="field">
              <span className="micro">Ends</span>
              <input name="endDate" type="date" defaultValue={dateVal(c.endDate)} />
            </label>
            <label className="field">
              <span className="micro">Booked by</span>
              <input name="bookedBy" defaultValue={c.bookedBy || ""} />
            </label>
            <label className="field">
              <span className="micro">Client contact</span>
              <input name="clientContact" defaultValue={c.clientContact || ""} />
            </label>
            <label className="field field-wide">
              <span className="micro">What was sold</span>
              <textarea name="specMd" rows={4} defaultValue={c.specMd || ""} />
            </label>
            <label className="field field-wide">
              <span className="micro">Notes</span>
              <textarea name="notes" rows={2} defaultValue={c.notes || ""} />
            </label>
            <BlackBookTitlePills sites={sites} selected={c.siteIds} />
            <div className="field-wide bb-actions">
              <button type="submit" className="btn">Save details</button>
            </div>
          </form>
          {/* Outside the details form: a form inside a form is invalid HTML. */}
          <div style={{ marginTop: 12 }}>
            <ConfirmSubmit
              action={deleteCampaign.bind(null, c.id)}
              question={`Delete ${c.name} with its deliverables, payments, results and files? Cancelling it keeps the record.`}
              label="Delete campaign"
            />
          </div>
        </details>
      </div>
    </main>
  );
}

function monthsBetween(a, b) {
  const [ya, ma] = ukDay(a).split("-").map(Number);
  const [yb, mb] = ukDay(b).split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
}

// The fields a deliverable is added and edited with.
function DeliverableFields({ d, sites }) {
  return (
    <>
      <label className="field">
        <span className="micro">What</span>
        <input name="title" required={!d} defaultValue={d?.title || ""} placeholder="e.g. Homepage MPU, December" />
      </label>
      <label className="field">
        <span className="micro">Product</span>
        <select name="product" defaultValue={d?.product || ""}>
          <option value="">—</option>
          {PRODUCTS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="micro">Title</span>
        <select name="siteId" defaultValue={d?.siteId || ""}>
          <option value="">Several or all</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="micro">Material due from client</span>
        <input name="assetsDue" type="date" defaultValue={dateVal(d?.assetsDue)} />
      </label>
      <label className="field">
        <span className="micro">Due live / delivered</span>
        <input name="dueDate" type="date" defaultValue={dateVal(d?.dueDate)} />
      </label>
      <label className="field">
        <span className="micro">Runs until</span>
        <input name="runUntil" type="date" defaultValue={dateVal(d?.runUntil)} />
      </label>
      <label className="field field-wide">
        <span className="micro">Specification</span>
        <textarea name="spec" rows={2} defaultValue={d?.spec || ""} placeholder="Sizes (300×250, 728×90), file type, word count, link and UTM, placement" />
      </label>
      <label className="field field-wide">
        <span className="micro">Notes</span>
        <input name="notes" defaultValue={d?.notes || ""} />
      </label>
    </>
  );
}
