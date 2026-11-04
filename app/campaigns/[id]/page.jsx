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
import PlacementGrid from "@/app/components/PlacementGrid";
import OrderLine from "@/app/components/OrderLine";
import Placements from "./Placements";
import MasterSave from "./MasterSave";
import NewOrderLines from "./NewOrderLines";
import { SAVE_FORM } from "./save-form";
import { POSITIONS, orderBook, positionInfo, slotLabel, unitWord } from "@/lib/ad-positions";
import { bookingsMap, outstanding } from "@/lib/ads";

import {
  CAMPAIGN_STATUSES,
  PAYMENT_STATUSES,
  campaignStatus,
  ctr,
  deliverableStatusLabel,
  fmtBytes,
  money,
  paymentLate,
  paymentStatusLabel,
  totals,
  ukDay,
} from "@/lib/campaigns";
import { addAssetLink, addPayment, assignAsset, deleteAsset, deleteCampaign, deleteDeliverable, deletePayment, fillTargetUrls, schedulePayments } from "@/lib/campaign-actions";

export const dynamic = "force-dynamic";

const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }) : "—";
const dateVal = (d) => (d ? ukDay(d) : "");
const n = (v) => (v == null ? "—" : v.toLocaleString("en-GB"));
const pounds = (pence) => (pence ? (pence / 100).toFixed(2) : "");
// Never the bytes: those are served one at a time by /api/campaign-assets.
const ASSET_FIELDS = {
  id: true,
  name: true,
  url: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  uploadedBy: true,
  createdAt: true,
  deliverableId: true,
  active: true,
  webMime: true,
  webSize: true,
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id }, select: { name: true } });
  return { title: c ? `${c.name} · Campaigns` : "Campaigns" };
}

export default async function CampaignPage({ params }) {
  const { id } = await params;
  const [c, sites, statRows, booked] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        advertiser: { select: { company: true, domain: true, website: true } },
        deliverables: {
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
          include: { assets: { select: ASSET_FIELDS, orderBy: { createdAt: "asc" } } },
        },
        payments: { orderBy: { dueDate: "asc" } },
        results: { orderBy: { periodEnd: "desc" }, include: { deliverable: { select: { title: true } } } },
        // Never the bytes: those are served one at a time by /api/campaign-assets.
        assets: { orderBy: { createdAt: "desc" }, select: ASSET_FIELDS },
      },
    }),
    listSites(),
    prisma.adStat.groupBy({
      by: ["deliverableId"],
      where: { deliverable: { campaignId: id } },
      _sum: { served: true, views: true, clicks: true },
    }),
    bookingsMap({ from: new Date() }),
  ]);
  if (!c) notFound();

  const now = new Date();
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const campaignSites = c.siteIds.length ? sites.filter((s) => c.siteIds.includes(s.id)) : sites;
  const st = campaignStatus(c.status);
  const deliverableTitle = new Map(c.deliverables.map((d) => [d.id, d.title]));

  const paid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountPence, 0);
  const scheduled = c.payments.reduce((s, p) => s + p.amountPence, 0);
  // Typed-in results plus what the sites and Mailchimp counted (AdStat).
  const statsById = new Map(statRows.map((r) => [r.deliverableId, { served: r._sum.served || 0, views: r._sum.views || 0, clicks: r._sum.clicks || 0 }]));
  const counted = [...statsById.values()].reduce((a, s) => ({ views: a.views + s.views, clicks: a.clicks + s.clicks }), { views: 0, clicks: 0 });
  const typed = totals(c.results);
  const t = { ...typed, impressions: typed.impressions + counted.views, clicks: typed.clicks + counted.clicks };

  // The booking grid's view of who holds what, from this month on.
  const taken = {};
  for (const [k, holders] of booked) {
    taken[k] = holders.map((h) => ({ advertiser: h.advertiser, mine: h.campaignId === c.id }));
  }
  const placed = c.deliverables.filter((d) => d.position);
  // Order lines: what was bought, before it is in a month. Anything without a
  // position that predates them (typed in by hand) is shown the same way.
  const book = orderBook(c.deliverables);
  const posOrder = new Map(POSITIONS.map((p, i) => [p.key, i]));
  const orders = c.deliverables
    .filter((d) => !d.position)
    .sort(
      (a, b) =>
        (siteById.get(a.siteId)?.name || "~").localeCompare(siteById.get(b.siteId)?.name || "~") ||
        (posOrder.get(a.slot) ?? 99) - (posOrder.get(b.slot) ?? 99)
    );
  const defaultYear = placed[0]?.dueDate
    ? Number(ukDay(placed.reduce((a, d) => (d.dueDate && d.dueDate < a ? d.dueDate : a), placed[0].dueDate)).slice(0, 4))
    : c.startDate
      ? Number(ukDay(c.startDate).slice(0, 4))
      : now.getUTCFullYear();

  // The grid's rows: per title, each position bought there (or already
  // booked there without an order line), in the order positions are sold.
  const rowsBySite = {};
  for (const [k, v] of book) {
    const [sid, key] = k.split("|");
    const p = positionInfo(key);
    if (!sid || !p) continue;
    (rowsBySite[sid] ||= []).push({ key, label: p.label, size: p.size, served: Boolean(p.served), email: Boolean(p.email), ...v });
  }
  Object.values(rowsBySite).forEach((r) => r.sort((a, b) => posOrder.get(a.key) - posOrder.get(b.key)));
  const gridSites = sites.filter((s) => rowsBySite[s.id]).sort((a, b) => a.name.localeCompare(b.name));
  const toPlace = [...book.entries()]
    .filter(([, v]) => v.ordered != null && v.ordered > v.booked)
    .map(([k, v]) => {
      const [sid, key] = k.split("|");
      return { sid, key, left: v.ordered - v.booked };
    });

  const todo = [
    ...toPlace.map((x) => ({
      what: `${x.left} ${slotLabel(x.key).toLowerCase()} ${unitWord(x.key, x.left)} not in a month yet`,
      deliverable: { title: siteById.get(x.sid)?.name || "No title" },
      due: null,
      late: false,
    })),
    ...outstanding(c, now),
  ];

  const summary = [
    { label: "Value", value: money(c.valuePence) },
    { label: "Paid", value: money(paid) },
    { label: "Outstanding", value: money(Math.max(0, c.valuePence - paid)) },
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
          <div className="bb-actions" style={{ marginTop: 14 }}>
            <Link href={`/campaigns/${c.id}/report`} className="btn">
              Client report →
            </Link>
            <Link href="/campaigns/availability" className="btn-ghost">
              Availability
            </Link>
          </div>
        </section>

        {/* ---------------- what is still owed by the client */}
        {todo.length > 0 && (
          <section className="panel stagger adv-body">
            <h2 style={{ margin: 0, fontSize: 16 }}>Outstanding from the client</h2>
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
              Worked out from the placements: missing or off-spec artwork, click-through URLs and email content. Due dates are the material-due date,
              or five days before it runs.
            </p>
            <table className="adv-table">
              <tbody>
                {todo.map((x, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className={`chip ${x.late ? "chip-monetise" : "chip-general"}`}>{x.due ? `${x.late ? "Late, was due" : "Due"} ${fmtDay(`${x.due}T12:00:00Z`)}` : "No date"}</span>
                    </td>
                    <td>
                      <strong>{x.what}</strong>
                      <span className="micro" style={{ color: "var(--muted)", display: "block" }}>
                        {x.deliverable.title}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ---------------- what they bought */}
        <section className="panel stagger adv-body">
          <h2 style={{ margin: 0, fontSize: 16 }}>What they bought</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
            One line per placement and title, with how many. Leave Starts empty until it has a slot and put it in months below; set it and the line
            is booked from that month. The spec comes from the placement.
          </p>
          {orders.map((d) => {
            const sn = d.siteId ? siteById.get(d.siteId)?.name : null;
            const name = d.title.replace(/^\d+ × /, "").replace(sn ? `, ${sn}` : /$^/, "");
            return (
              <OrderLine
                key={d.id}
                prefix={`o:${d.id}:`}
                form={SAVE_FORM}
                sites={campaignSites}
                d={{
                  slot: d.slot || (d.quantity == null ? "other" : ""),
                  siteId: d.siteId || "",
                  quantity: d.quantity ?? 1,
                  assetsDue: dateVal(d.assetsDue),
                  dueDate: dateVal(d.dueDate),
                  name,
                }}
                booked={d.slot && d.slot !== "other" ? book.get(`${d.siteId || ""}|${d.slot}`) : undefined}
                actions={
                  <span key="acts" style={{ marginLeft: "auto", display: "inline-flex", gap: 10, alignItems: "center" }}>
                    {d.quantity == null && <span key="was" style={{ color: "var(--muted)" }}>Was “{d.title}” ({deliverableStatusLabel(d.status)})</span>}
                    <ConfirmSubmit key="del" action={deleteDeliverable.bind(null, d.id)} question={`Delete "${d.title}"? Months already booked for it stay booked.`} label="Delete" className="btn-ghost ol-x" />
                  </span>
                }
              />
            );
          })}
          <NewOrderLines sites={campaignSites} each={campaignSites.length > 1} />
        </section>

        {/* ---------------- on the sites */}
        <section className="panel stagger adv-body">
          <h2 style={{ margin: 0, fontSize: 16 }}>On the sites and in the inbox</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
            Put what they bought into months, then give each placement its link and artwork on its line. Banners are served by each title&apos;s ad
            plugin straight from here and go live on their start date; taking one down or swapping artwork reaches the site in seconds.
          </p>
          <PlacementGrid campaignId={c.id} sites={gridSites} rowsBySite={rowsBySite} taken={taken} defaultYear={defaultYear} />
          {placed.some((d) => !d.targetUrl) && placed.some((d) => d.targetUrl) && (
            <form action={fillTargetUrls.bind(null, c.id)} className="adv-inline">
              <span className="micro">Use</span>
              <input name="targetUrl" type="url" defaultValue={placed.find((d) => d.targetUrl)?.targetUrl || ""} style={{ flex: "2 1 280px" }} aria-label="Click-through URL" />
              <span className="micro">for every placement without a link</span>
              <button type="submit" className="btn-ghost">
                Apply
              </button>
            </form>
          )}
          <Placements campaignId={c.id} deliverables={c.deliverables} sitesById={siteById} statsById={statsById} now={now} />
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
                      <div className="adv-inline" style={{ margin: 0 }}>
                        <input form={SAVE_FORM} name={`pay:${p.id}:amount`} inputMode="decimal" defaultValue={pounds(p.amountPence)} aria-label="Amount £" style={{ width: 100 }} />
                        <input form={SAVE_FORM} name={`pay:${p.id}:dueDate`} type="date" defaultValue={dateVal(p.dueDate)} aria-label="Due" title="Due" />
                        <select form={SAVE_FORM} name={`pay:${p.id}:status`} defaultValue={p.status} aria-label="Status">
                          {PAYMENT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <input form={SAVE_FORM} name={`pay:${p.id}:paidAt`} type="date" defaultValue={dateVal(p.paidAt)} aria-label="Paid on" title="Paid on" />
                        <input form={SAVE_FORM} name={`pay:${p.id}:invoiceRef`} defaultValue={p.invoiceRef || ""} placeholder="Invoice no." style={{ width: 110 }} />
                      </div>
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
                      {!a.url && a.width && placed.length > 0 && (
                        // Moving a file remakes its served copy for the new slot.
                        <form action={assignAsset.bind(null, a.id)} className="camp-assign">
                          <select name="deliverableId" defaultValue={a.deliverableId || ""} aria-label="Placement">
                            <option value="">Not placed</option>
                            {placed.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.title}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn-ghost">
                            Place
                          </button>
                        </form>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>Nothing uploaded yet.</p>
          )}
          <CampaignAssetUpload
            campaignId={c.id}
            deliverables={c.deliverables.map((d) => ({ id: d.id, title: d.title, slot: positionInfo(d.position)?.size || null }))}
          />
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
          {/* Saved with the page's one Save, like every other field. */}
          <div className="bb-form">
            <label className="field">
              <span className="micro">Name</span>
              <input form={SAVE_FORM} name="c:name" required defaultValue={c.name} />
            </label>
            <label className="field">
              <span className="micro">Status</span>
              <select form={SAVE_FORM} name="c:status" defaultValue={c.status}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="micro">Value, £ ex VAT</span>
              <input form={SAVE_FORM} name="c:value" inputMode="decimal" defaultValue={pounds(c.valuePence)} />
            </label>
            <label className="field">
              <span className="micro">Starts</span>
              <input form={SAVE_FORM} name="c:startDate" type="date" defaultValue={dateVal(c.startDate)} />
            </label>
            <label className="field">
              <span className="micro">Ends</span>
              <input form={SAVE_FORM} name="c:endDate" type="date" defaultValue={dateVal(c.endDate)} />
            </label>
            <label className="field">
              <span className="micro">Booked by</span>
              <input form={SAVE_FORM} name="c:bookedBy" defaultValue={c.bookedBy || ""} />
            </label>
            <label className="field">
              <span className="micro">Client contact</span>
              <input form={SAVE_FORM} name="c:clientContact" defaultValue={c.clientContact || ""} />
            </label>
            <label className="field field-wide">
              <span className="micro">What was sold</span>
              <textarea form={SAVE_FORM} name="c:specMd" rows={4} defaultValue={c.specMd || ""} />
            </label>
            <label className="field field-wide">
              <span className="micro">Notes</span>
              <textarea form={SAVE_FORM} name="c:notes" rows={2} defaultValue={c.notes || ""} />
            </label>
            <BlackBookTitlePills sites={sites} selected={c.siteIds} form={SAVE_FORM} prefix="c:" />
          </div>
          <div style={{ marginTop: 12 }}>
            <ConfirmSubmit
              action={deleteCampaign.bind(null, c.id)}
              question={`Delete ${c.name} with its placements, payments and files? Cancelling it keeps the record.`}
              label="Delete campaign"
            />
          </div>
        </details>
      </div>
      <MasterSave campaignId={c.id} />
    </main>
  );
}

function monthsBetween(a, b) {
  const [ya, ma] = ukDay(a).split("-").map(Number);
  const [yb, mb] = ukDay(b).split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
}
