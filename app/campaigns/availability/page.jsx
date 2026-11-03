import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import SubTabs, { FLEET_COMMERCIAL_TABS } from "@/app/components/SubTabs";
import { prisma } from "@/lib/prisma";
import { POSITIONS } from "@/lib/ad-positions";
import { bookingsMap } from "@/lib/ads";
import { shortTitle } from "@/lib/black-book-labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Availability" };

// Who holds which position on which title, month by month: the page to have
// open when a client asks "what have you got in March?". Website positions are
// exclusive, so a booked cell is unavailable; email positions can carry more
// than one advertiser a month and show how many are booked.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function AvailabilityPage({ searchParams }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const year = Number(sp.year) >= 2026 && Number(sp.year) <= 2035 ? Number(sp.year) : new Date().getUTCMonth() >= 9 ? thisYear + 1 : thisYear;
  const [sites, booked] = await Promise.all([
    prisma.site.findMany({ where: { status: { in: ["live", "cold_start"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    bookingsMap({ from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) }),
  ]);
  const only = sites.find((s) => shortTitle(s.name).label.toLowerCase() === String(sp.title || "").toLowerCase());
  const shown = only ? [only] : sites;

  let free = 0;
  let total = 0;
  for (const s of sites)
    for (const p of POSITIONS.filter((x) => x.served))
      for (let m = 1; m <= 12; m++) {
        total++;
        if (!booked.get(`${s.id}|${p.key}|${year}-${String(m).padStart(2, "0")}`)) free++;
      }

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Availability</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>
      <SubTabs items={FLEET_COMMERCIAL_TABS} active="/campaigns/availability" />

      <div style={{ maxWidth: 1360, margin: "0 auto", display: "grid", gap: 20 }}>
        <section className="panel panel-glow stagger">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>What is free to sell in {year}</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 680 }}>
                {`Website positions are sold to one advertiser at a time. ${free.toLocaleString("en-GB")} of ${total.toLocaleString(
                  "en-GB"
                )} title-months are still free across the fleet. Book from a campaign's month grid.`}
              </p>
            </div>
            <div className="pg-year">
              <Link className="btn-ghost" href={`?year=${year - 1}${only ? `&title=${sp.title}` : ""}`} aria-label="Previous year">
                ‹
              </Link>
              <b>{year}</b>
              <Link className="btn-ghost" href={`?year=${year + 1}${only ? `&title=${sp.title}` : ""}`} aria-label="Next year">
                ›
              </Link>
            </div>
          </div>
          <nav className="adv-types" style={{ marginTop: 14 }} aria-label="Titles">
            <Link href={`?year=${year}`} className={`adv-type${only ? "" : " is-active"}`}>
              All titles
            </Link>
            {sites.map((s) => {
              const t = shortTitle(s.name);
              return (
                <Link key={s.id} href={`?year=${year}&title=${t.label.toLowerCase()}`} className={`adv-type${only?.id === s.id ? " is-active" : ""}`}>
                  {t.emoji} {t.label}
                </Link>
              );
            })}
          </nav>
        </section>

        {shown.map((s) => (
          <section key={s.id} className="panel stagger">
            <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>
              {shortTitle(s.name).emoji} {s.name}
            </h2>
            <div className="pg-scroll">
              <table className="av-table">
                <thead>
                  <tr>
                    <th scope="col">Position</th>
                    {MONTHS.map((m) => (
                      <th key={m} scope="col">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {POSITIONS.map((p) => (
                    <tr key={p.key}>
                      <th scope="row">
                        {p.label}
                        <span className="micro">{p.size ? `${p.size[0]}×${p.size[1]}` : p.email ? "email" : "content"}</span>
                      </th>
                      {MONTHS.map((_, i) => {
                        const holders = booked.get(`${s.id}|${p.key}|${year}-${String(i + 1).padStart(2, "0")}`) || [];
                        if (!holders.length)
                          return (
                            <td key={i} className="av-free">
                              <span className="sr-only">Free</span>
                            </td>
                          );
                        const names = [...new Set(holders.map((h) => h.advertiser))];
                        return (
                          <td key={i} className="av-booked" title={holders.map((h) => `${h.advertiser}: ${h.campaign}`).join("\n")}>
                            <Link href={`/campaigns/${holders[0].campaignId}`}>{names.length > 1 ? `${names.length} booked` : names[0].split(" ")[0]}</Link>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
