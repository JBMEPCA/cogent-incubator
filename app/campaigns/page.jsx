import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import SubTabs, { FLEET_COMMERCIAL_TABS } from "@/app/components/SubTabs";
import CampaignForm from "@/app/components/CampaignForm";
import CampaignRow from "@/app/components/CampaignRow";
import { prisma } from "@/lib/prisma";
import { listSites } from "@/lib/site";
import { shortTitle } from "@/lib/black-book-labels";
import {
  STATE_CHIP,
  campaignStatus,
  deliverableState,
  money,
  paymentLate,
  revenueByMonth,
  ukMonth,
} from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns" };

const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtMonth = (ym) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "Europe/London", month: "short", year: "numeric" });
const URGENT = { overdue: 0, client_late: 1, soon: 2 };

export default async function CampaignsPage({ searchParams }) {
  const sp = await searchParams;
  const now = new Date();
  const thisMonth = ukMonth(now);

  const [sites, campaigns, preset, counted] = await Promise.all([
    listSites(),
    prisma.campaign.findMany({
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      include: {
        advertiser: { select: { company: true, domain: true } },
        deliverables: { orderBy: { dueDate: "asc" } },
        payments: { orderBy: { dueDate: "asc" } },
      },
    }),
    sp.new ? prisma.advertiser.findUnique({ where: { domain: String(sp.new) }, select: { id: true, company: true, siteIds: true } }) : null,
    // Banner impressions and clicks per placement, as the sites counted them.
    prisma.adStat.groupBy({ by: ["deliverableId"], where: { channel: "site" }, _sum: { views: true, clicks: true } }),
  ]);
  const statsByDeliverable = new Map(counted.map((r) => [r.deliverableId, r._sum]));
  const siteById = new Map(sites.map((s) => [s.id, s]));

  // Twelve months from last month, so the one just closed is still on screen.
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 10, 15));
  const byMonth = new Map((await revenueByMonth(prisma, { from: ukMonth(start), to: ukMonth(end) })).map((r) => [r.month, r]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const k = ukMonth(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 15)));
    return byMonth.get(k) || { month: k, paidPence: 0, expectedPence: 0 };
  });
  const peak = Math.max(1, ...months.map((m) => m.paidPence + m.expectedPence));

  const active = campaigns.filter((c) => c.status !== "cancelled");
  const payments = active.flatMap((c) => c.payments.map((p) => ({ ...p, campaign: c })));
  const stats = [
    { label: "Booked", value: money(active.reduce((s, c) => s + c.valuePence, 0)) },
    { label: "Received", value: money(payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountPence, 0)) },
    {
      label: `Due in ${fmtMonth(thisMonth).split(" ")[0]}`,
      value: money(payments.filter((p) => p.status !== "paid" && ukMonth(p.dueDate) === thisMonth).reduce((s, p) => s + p.amountPence, 0)),
    },
    { label: "Late payments", value: money(payments.filter((p) => paymentLate(p, now)).reduce((s, p) => s + p.amountPence, 0)), warn: true },
  ];

  // Everything that needs someone this week, most urgent first.
  const attention = [
    ...active
      .filter((c) => c.status !== "complete")
      .flatMap((c) =>
        c.deliverables.map((d) => ({ kind: "deliverable", c, d, st: deliverableState(d, now) })).filter((x) => x.st.level in URGENT)
      ),
    ...payments.filter((p) => paymentLate(p, now)).map((p) => ({ kind: "payment", c: p.campaign, p, st: { level: "overdue", label: "Payment late" } })),
  ].sort((a, b) => URGENT[a.st.level] - URGENT[b.st.level] || +new Date(a.d?.dueDate || a.p?.dueDate || 0) - +new Date(b.d?.dueDate || b.p?.dueDate || 0));

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Campaigns</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>
      <SubTabs items={FLEET_COMMERCIAL_TABS} active="/campaigns" />

      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>What advertisers have bought</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 640 }}>
                Every booking, what we owe each client and by when, the numbers to report back, and when the money
                lands. Amounts are ex VAT. Brands come from the{" "}
                <Link href="/advertisers" style={{ color: "var(--neon-cyan)" }}>
                  Advertisers
                </Link>{" "}
                list.
              </p>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24, color: s.warn && s.value !== money(0) ? "var(--neon-amber)" : undefined }}>
                    {s.value}
                  </div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="camp-top">
          <section className="panel stagger">
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Needs attention</h2>
            {attention.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Nothing overdue or due in the next seven days.</p>
            ) : (
              <table className="adv-table">
                <tbody>
                  {attention.map((x) => (
                    <tr key={x.d?.id || x.p.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className={`chip ${STATE_CHIP[x.st.level]}`}>{x.st.label}</span>
                      </td>
                      <td>
                        <Link href={`/campaigns/${x.c.id}`} style={{ color: "var(--text)" }}>
                          <strong>{x.kind === "payment" ? `${money(x.p.amountPence)} instalment` : x.d.title}</strong>
                        </Link>
                        <span className="micro" style={{ color: "var(--muted)", display: "block" }}>
                          {x.c.advertiser.company} · {x.c.name}
                        </span>
                      </td>
                      <td className="micro" style={{ whiteSpace: "nowrap" }}>
                        {x.kind === "payment"
                          ? `Was due ${fmtDay(x.p.dueDate)}`
                          : x.st.level === "client_late" || x.st.label.startsWith("Material")
                            ? `Material due ${fmtDay(x.d.assetsDue)}`
                            : `Due ${fmtDay(x.d.dueDate)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel stagger">
            <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Money in by month</h2>
            <p className="micro" style={{ color: "var(--muted)", margin: "0 0 12px" }}>
              Solid is paid, by the day it landed. Faint is still expected, by its due date.
            </p>
            <div className="camp-months">
              {months.map((m) => (
                <div key={m.month} className={`camp-month${m.month === thisMonth ? " is-now" : ""}`}>
                  <span className="micro">{fmtMonth(m.month)}</span>
                  <span className="camp-bar" aria-hidden="true">
                    <span className="camp-bar-paid" style={{ width: `${(m.paidPence / peak) * 100}%` }} />
                    <span className="camp-bar-due" style={{ width: `${(m.expectedPence / peak) * 100}%` }} />
                  </span>
                  <span className="micro camp-month-n">
                    {m.paidPence + m.expectedPence ? money(m.paidPence + m.expectedPence).replace(/\.00$/, "") : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <details className="panel stagger adv-panel" style={{ marginBottom: 24 }} open={!!preset || campaigns.length === 0}>
          <summary>
            <h2>Book a campaign</h2>
          </summary>
          <CampaignForm sites={sites} preset={preset} />
        </details>

        <section className="panel stagger">
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>
            All campaigns <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13 }}>({campaigns.length})</span>
          </h2>
          {campaigns.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>No campaigns booked yet.</p>
          ) : (
            <div className="adv-list">
              <div className="camp-sum adv-sum-head micro" aria-hidden="true">
                <span>Campaign</span>
                <span>Titles</span>
                <span>Runs</span>
                <span>Impressions · clicks</span>
                <span>Paid</span>
                <span>Status</span>
              </div>
              {campaigns.map((c) => {
                const st = campaignStatus(c.status);
                const live = c.deliverables.filter((d) => d.status !== "cancelled");
                const done = live.filter((d) => d.status === "live" || d.status === "delivered").length;
                const paid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountPence, 0);
                const worst = live.map((d) => deliverableState(d, now)).sort((a, b) => (URGENT[a.level] ?? 9) - (URGENT[b.level] ?? 9))[0];
                const web = c.deliverables.reduce(
                  (t, d) => {
                    const s = statsByDeliverable.get(d.id);
                    return s ? { views: t.views + (s.views || 0), clicks: t.clicks + (s.clicks || 0) } : t;
                  },
                  { views: 0, clicks: 0 }
                );
                const banners = c.deliverables.some((d) => d.position && d.position !== "solus" && d.position !== "newsletter_banner" && d.position !== "sponsored_article");
                return (
                  <CampaignRow key={c.id} campaignId={c.id} label={`${c.advertiser.company}, ${c.name}`}>
                    <span className="adv-brand">
                      <strong>{c.advertiser.company}</strong>
                      <span className="micro" style={{ color: "var(--muted)" }}>{c.name}</span>
                    </span>
                    <span className="adv-pills">
                      {c.siteIds.length === 0 ? (
                        <span className="adv-pill">🌍 All</span>
                      ) : (
                        c.siteIds.map((id) => {
                          const s = siteById.get(id);
                          if (!s) return null;
                          const t = shortTitle(s.name);
                          return (
                            <span key={id} className="adv-pill" title={s.name}>
                              {t.emoji} {t.label}
                            </span>
                          );
                        })
                      )}
                    </span>
                    <span className="micro">
                      {fmtDay(c.startDate)}
                      <span style={{ display: "block", color: "var(--muted)" }}>to {fmtDay(c.endDate)}</span>
                    </span>
                    <span className="micro">
                      {banners ? (
                        <>
                          <b className="camp-num">{web.views.toLocaleString("en-GB")}</b> impr ·{" "}
                          <b className="camp-num">{web.clicks.toLocaleString("en-GB")}</b> clicks
                          <span style={{ display: "block", color: "var(--muted)" }}>
                            {web.views ? `${((web.clicks / web.views) * 100).toFixed(2)}% click-through` : "none counted yet"}
                          </span>
                        </>
                      ) : live.length ? (
                        `${done} of ${live.length} delivered`
                      ) : (
                        "Nothing listed"
                      )}
                      {worst && worst.level in URGENT && (
                        <span className={`chip ${STATE_CHIP[worst.level]}`} style={{ display: "table", marginTop: 4 }}>
                          {worst.label}
                        </span>
                      )}
                    </span>
                    <span className="micro">
                      {money(paid)}
                      <span style={{ display: "block", color: "var(--muted)" }}>of {money(c.valuePence)}</span>
                    </span>
                    <span>
                      <span className={`chip ${st.chip}`}>{st.label}</span>
                    </span>
                  </CampaignRow>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

