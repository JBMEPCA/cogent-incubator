import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const F = ["reports.send_time","reports.emails_sent","reports.list_id","reports.bounces","reports.abuse_reports","reports.opens"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
console.log("hard bounce rate, last four issues (newest first). ceiling is 2%, two in a row blocks.\n");
console.log("title".padEnd(27) + "newest".padStart(9) + "prev".padStart(9) + "prev".padStart(9) + "prev".padStart(9) + "   risk");
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!cr.length) continue;
  const aid = decryptJson(cr[0].payloadEnc).audienceId;
  const mine = (d.reports||[]).filter(x => x.list_id === aid && x.emails_sent).slice(0,4);
  const rates = mine.map(r => (r.bounces?.hard_bounces||0)/r.emails_sent*100);
  const risk = rates[0] > 2 && rates[1] > 2 ? "BLOCKED" : rates[0] > 2 ? "warning, one more blocks it" : "ok";
  console.log(s.slug.padEnd(27) + rates.map(r=>(r.toFixed(2)+"%").padStart(9)).join("") + "   " + risk);
}
await p.$disconnect();
