import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=20&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
let total = 0;
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const r = reports.find((x) => x.list_id === aid && x.send_time > "2026-10-08T00:00");
  if (!r) continue;
  total += r.emails_sent;
  console.log(`${s.slug.padEnd(28)} ${r.emails_sent}`);
}
console.log("TOTAL", total);
await p.$disconnect();
