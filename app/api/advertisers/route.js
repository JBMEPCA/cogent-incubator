import { prisma } from "@/lib/prisma";
import { optOutsFor } from "@/lib/advertisers";

export const dynamic = "force-dynamic";

/**
 * The advertiser list as a CSV, one row per contact, for a mail merge or a
 * sales push. ?title=<slug> narrows it to brands that suit that title.
 *
 * Behind the sign-in wall, like the Black Book export: proxy.js covers every
 * /api route not in its exclusion list, and this is people's contact data.
 * Brands on the global opt-out list are left out entirely, because the most
 * likely next step for this file is a send.
 */
const cell = (v) => {
  const s = v == null ? "" : String(v);
  // Quote everything, and defuse cells a spreadsheet would run as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("title");
  const sites = await prisma.site.findMany({ select: { id: true, name: true, slug: true } });
  const names = new Map(sites.map((s) => [s.id, s.name]));
  const title = slug ? sites.find((s) => s.slug === slug) : null;

  const advertisers = await prisma.advertiser.findMany({
    where: title ? { OR: [{ siteIds: { has: title.id } }, { siteIds: { isEmpty: true } }] } : {},
    orderBy: { company: "asc" },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      offers: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });
  const optedOut = await optOutsFor(advertisers.map((a) => a.domain));

  const rows = [
    ["Company", "Domain", "Website", "Category", "First name", "Last name", "Job title", "Email", "Phone", "LinkedIn",
      "Relevant to", "Last offer", "Last campaign", "Source"],
  ];
  for (const a of advertisers) {
    if (optedOut.has(a.domain)) continue;
    const brand = [a.company, a.domain, a.website, a.category];
    const tail = [
      a.siteIds.length ? a.siteIds.map((id) => names.get(id) || "Removed title").join("; ") : "All titles",
      day(a.offers[0]?.sentAt),
      a.offers[0]?.campaign,
      a.sourceDetail || a.source,
    ];
    if (!a.contacts.length) rows.push([...brand, "", "", "", "", "", "", ...tail]);
    for (const c of a.contacts) {
      rows.push([...brand, c.firstName, c.lastName, c.jobTitle, c.email, c.phone, c.linkedinUrl, ...tail]);
    }
  }
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const name = `advertisers${title ? `-${title.slug}` : ""}-${day(new Date())}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
