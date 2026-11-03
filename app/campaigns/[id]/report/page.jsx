import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listSites } from "@/lib/site";
import { positionInfo } from "@/lib/ad-positions";
import { runDays } from "@/lib/ads";
import { ctr } from "@/lib/campaigns";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

// The report the client gets: what ran, where, and what it did. Built from the
// counts the titles' ad plugins and Mailchimp reported (AdStat), plus anything
// typed in on the campaign page. Light and print-ready, because it is sent as
// a PDF: open it, pick a month or the whole run, and print to PDF.
//
// Client-facing copy, so the house rules hold: no em dashes, and the honest
// limits of the counting are stated rather than left out.

const fmtDay = (s) =>
  new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (ym) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const num = (v) => (v || 0).toLocaleString("en-GB");
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "");

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id }, select: { name: true, advertiser: { select: { company: true } } } });
  return { title: c ? `${c.advertiser.company} report · ${c.name}` : "Report" };
}

export default async function ReportPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      advertiser: { select: { company: true } },
      deliverables: {
        where: { status: { not: "cancelled" } },
        orderBy: [{ dueDate: "asc" }],
        include: { assets: { where: { url: null, width: { not: null } }, select: { id: true, name: true, width: true, height: true, active: true } } },
      },
    },
  });
  if (!c) notFound();
  const sites = new Map((await listSites()).map((s) => [s.id, s]));

  const stats = await prisma.adStat.findMany({ where: { deliverable: { campaignId: c.id } }, orderBy: { day: "asc" } });
  const months = [...new Set(stats.map((r) => r.day.toISOString().slice(0, 7)))].sort();
  const month = months.includes(sp.month) ? sp.month : "";
  const rows = month ? stats.filter((r) => r.day.toISOString().startsWith(month)) : stats;
  const byId = new Map(c.deliverables.map((d) => [d.id, d]));

  // Website: per title and position.
  const web = new Map();
  for (const r of rows.filter((r) => r.channel === "site")) {
    const d = byId.get(r.deliverableId);
    if (!d) continue;
    const k = `${d.siteId}|${r.position}`;
    const cur = web.get(k) || { siteId: d.siteId, position: r.position, views: 0, clicks: 0 };
    cur.views += r.views;
    cur.clicks += r.clicks;
    web.set(k, cur);
  }
  const webRows = [...web.values()].sort((a, b) => b.views - a.views);
  const webTotal = webRows.reduce((s, r) => ({ views: s.views + r.views, clicks: s.clicks + r.clicks }), { views: 0, clicks: 0 });

  // Email: per send. A newsletter banner's clicks come from the site's own
  // tracked link (channel email rows with a creative), its sends and opens
  // from Mailchimp (the row without one).
  const sends = new Map();
  for (const r of rows.filter((r) => r.channel === "email")) {
    const d = byId.get(r.deliverableId);
    if (!d) continue;
    const cur = sends.get(d.id) || { d, day: r.day, sent: 0, opens: 0, clicks: 0 };
    if (r.assetKey) cur.clicks += r.clicks;
    else {
      cur.sent += r.served;
      cur.opens += r.views;
      cur.clicks += r.clicks;
      cur.day = r.day;
    }
    sends.set(d.id, cur);
  }
  const sendRows = [...sends.values()].sort((a, b) => a.day - b.day);
  const mail = sendRows.reduce((s, r) => ({ sent: s.sent + r.sent, opens: s.opens + r.opens, clicks: s.clicks + r.clicks }), { sent: 0, opens: 0, clicks: 0 });

  const placed = c.deliverables.filter((d) => d.position && (!month || overlapsMonth(d, month)));
  const creatives = placed.flatMap((d) => d.assets.map((a) => ({ ...a, d })));
  const period = month ? monthLabel(month) : runLabel(c);

  return (
    <main className="rep">
      <div className="rep-tools">
        <Link href={`/campaigns/${c.id}`}>← Back to the campaign</Link>
        <form method="get" className="rep-pick">
          <select name="month" defaultValue={month} aria-label="Period">
            <option value="">Whole campaign</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button type="submit">Show</button>
        </form>
        <PrintButton />
      </div>

      <article className="rep-page">
        <header className="rep-head">
          <span className="rep-eyebrow">Campaign report · Cogent Multimedia</span>
          <h1>{c.advertiser.company}</h1>
          <p className="rep-sub">
            {c.name} · {period}
          </p>
        </header>

        <section className="rep-tiles">
          <div>
            <b>{num(webTotal.views)}</b>
            <span>Banner views</span>
          </div>
          <div>
            <b>{num(webTotal.clicks)}</b>
            <span>Banner clicks</span>
          </div>
          <div>
            <b>{ctr(webTotal.clicks, webTotal.views) || "0.00%"}</b>
            <span>Click-through rate</span>
          </div>
          {mail.sent > 0 && (
            <div>
              <b>{num(mail.opens)}</b>
              <span>Email opens, {pct(mail.opens, mail.sent)} of {num(mail.sent)} delivered</span>
            </div>
          )}
        </section>

        {webRows.length > 0 && (
          <section>
            <h2>On the websites</h2>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Position</th>
                  <th className="num">Views</th>
                  <th className="num">Clicks</th>
                  <th className="num">CTR</th>
                </tr>
              </thead>
              <tbody>
                {webRows.map((r) => (
                  <tr key={`${r.siteId}|${r.position}`}>
                    <td>{sites.get(r.siteId)?.name || ""}</td>
                    <td>{positionInfo(r.position)?.label || r.position}</td>
                    <td className="num">{num(r.views)}</td>
                    <td className="num">{num(r.clicks)}</td>
                    <td className="num">{ctr(r.clicks, r.views)}</td>
                  </tr>
                ))}
                <tr className="rep-total">
                  <td colSpan={2}>Total</td>
                  <td className="num">{num(webTotal.views)}</td>
                  <td className="num">{num(webTotal.clicks)}</td>
                  <td className="num">{ctr(webTotal.clicks, webTotal.views)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {sendRows.length > 0 && (
          <section>
            <h2>By email</h2>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Title</th>
                  <th>Format</th>
                  <th className="num">Delivered</th>
                  <th className="num">Opens</th>
                  <th className="num">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {sendRows.map((r) => (
                  <tr key={r.d.id}>
                    <td>{fmtDay(r.day.toISOString().slice(0, 10))}</td>
                    <td>{sites.get(r.d.siteId)?.name || ""}</td>
                    <td>{positionInfo(r.d.position)?.label}</td>
                    <td className="num">{num(r.sent)}</td>
                    <td className="num">
                      {num(r.opens)} <small>{pct(r.opens, r.sent)}</small>
                    </td>
                    <td className="num">{num(r.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>What ran</h2>
          <table className="rep-table">
            <tbody>
              {placed.map((d) => {
                const run = runDays(d);
                return (
                  <tr key={d.id}>
                    <td>{sites.get(d.siteId)?.name || ""}</td>
                    <td>{positionInfo(d.position)?.label}</td>
                    <td>{run ? (run.start === run.end ? fmtDay(run.start) : `${fmtDay(run.start)} to ${fmtDay(run.end)}`) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {creatives.length > 0 && (
          <section>
            <h2>Creative</h2>
            <div className="rep-creatives">
              {creatives.map((a) => (
                <figure key={a.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/campaign-assets/${a.id}`} alt={a.name} />
                  <figcaption>
                    {positionInfo(a.d.position)?.label}, {sites.get(a.d.siteId)?.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <footer className="rep-foot">
          <p>
            Views are viewable impressions: at least half the banner on screen for at least one second, counted by each website itself rather than by
            a third-party tracker, so readers who decline cookies are included. Readers using an ad blocker, or with JavaScript switched off, do not
            see the banners and are not counted. Email figures are from Mailchimp; opens include those registered by mail privacy features.
          </p>
          <p>Cogent Multimedia Ltd, 5 Jubilee Way, Faversham, Kent</p>
        </footer>
      </article>
    </main>
  );
}

function overlapsMonth(d, ym) {
  const run = runDays(d);
  if (!run) return false;
  return run.start.slice(0, 7) <= ym && run.end.slice(0, 7) >= ym;
}

function runLabel(c) {
  const f = (d) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  if (c.startDate && c.endDate) return `${f(c.startDate)} to ${f(c.endDate)}`;
  return "Whole campaign";
}
