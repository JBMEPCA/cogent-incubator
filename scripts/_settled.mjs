import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=60&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const mine = reports.filter((x) => x.list_id === aid && x.emails_sent);
  console.log(`${s.slug.padEnd(28)} ` + mine.slice(0, 3).map((r) => {
    const b = r.bounces || {};
    return `${uk(r.send_time)} ${r.emails_sent} hard ${b.hard_bounces} (${((100 * (b.hard_bounces || 0)) / r.emails_sent).toFixed(2)}%) abuse ${r.abuse_reports}`;
  }).join("  |  "));
}
await p.$disconnect();
