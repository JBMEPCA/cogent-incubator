import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
for (const slug of ["dental-business-news","gym-business-news","nursery-daily"]) {
  const s = await p.site.findUnique({ where: { slug } });
  const aid = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc).audienceId;
  const F = ["reports.id","reports.send_time","reports.list_id","reports.emails_sent","reports.bounces"].join(",");
  const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
  const r = (d.reports||[]).filter(x => x.list_id === aid && x.emails_sent)[0];
  console.log(`\n=== ${slug}  ${(r.send_time||"").slice(0,16)}  hard ${r.bounces?.hard_bounces||0} of ${r.emails_sent} ===`);
  let rows = [], off = 0, total = 1;
  while (off < total && off < 3000) {
    const j = await mc(`/reports/${r.id}/sent-to?count=1000&offset=${off}&fields=sent_to.email_address,sent_to.status,total_items`);
    total = j.total_items||0; const got = j.sent_to||[]; rows.push(...got); off += 1000; if (!got.length) break;
  }
  const bad = rows.filter(x => x.status === "hard");
  const dom = {};
  for (const b of bad) { const dd = b.email_address.split("@")[1]; dom[dd]=(dom[dd]||0)+1; }
  const sorted = Object.entries(dom).sort((a,b)=>b[1]-a[1]);
  console.log(`hard bounces found: ${bad.length}, across ${sorted.length} domains`);
  for (const [dd,n] of sorted.slice(0,12)) console.log(`  ${String(n).padStart(3)}  ${dd}`);
}
await p.$disconnect();
