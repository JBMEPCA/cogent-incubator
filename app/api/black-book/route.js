import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The Black Book as a CSV, for a sales push or a mail merge.
 *
 * Behind the sign-in wall: proxy.js covers every /api route not in its
 * exclusion list, and this is real people's contact data, so it must stay
 * out of that list.
 */
const cell = (v) => {
  const s = v == null ? "" : String(v);
  // Quote everything, and defuse cells a spreadsheet would run as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export async function GET() {
  const [contacts, sites] = await Promise.all([
    prisma.blackBookContact.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.site.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map(sites.map((s) => [s.id, s.name]));

  const rows = [
    ["Company", "Name", "Email", "Relevant to", "Notes", "Follow up", "Added", "Source"],
    ...contacts.map((c) => [
      c.company,
      c.name,
      c.email,
      c.siteIds.length ? c.siteIds.map((id) => names.get(id) || "Removed title").join("; ") : "All titles",
      c.notes,
      day(c.followUpDate),
      day(c.createdAt),
      c.source,
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="black-book-${day(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
