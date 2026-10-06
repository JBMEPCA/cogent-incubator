import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=20&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const r = reports.find((x) => x.list_id === aid && x.send_time > "2026-10-05T00:00");
  if (!r) { console.log(`${s.slug.padEnd(28)} NO SEND`); continue; }
  const b = r.bounces || {};
  const pct = ((100 * (b.hard_bounces || 0)) / r.emails_sent).toFixed(2);
  console.log(`${s.slug.padEnd(28)} ${uk(r.send_time)} hard ${String(b.hard_bounces).padStart(3)} (${pct}%) soft ${b.soft_bounces} | ${r.subject_line.slice(0, 54)}`);
}
await p.$disconnect();
