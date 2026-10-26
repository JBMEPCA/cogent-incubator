// Are today's bounces the addresses the drip imported on Tuesday?
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const CUT = new Date("2026-10-19T00:00:00Z"); // imported Tue 20 Oct
for (const slug of ["gym-business-news","dental-business-news","smart-sme","golf-resort-magazine"]) {
  const s = await p.site.findUnique({ where: { slug } });
  const aid = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc).audienceId;
  const F = ["reports.id","reports.list_id","reports.send_time","reports.emails_sent","reports.bounces"].join(",");
  const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
  const r = (d.reports||[]).filter(x => x.list_id === aid && x.emails_sent)[0];
  // bounced addresses from this campaign
  let rows = [], off = 0, total = 1;
  while (off < total && off < 12000) {
    const j = await mc(`/reports/${r.id}/sent-to?count=1000&offset=${off}&fields=sent_to.email_address,sent_to.status,total_items`);
    total = j.total_items||0; const got = j.sent_to||[]; rows.push(...got); off += 1000; if (!got.length) break;
  }
  const bad = new Set(rows.filter(x => x.status === "hard").map(x => x.email_address.toLowerCase()));
  // when did each member join
  let mem = [], o2 = 0, t2 = 1;
  while (o2 < t2 && o2 < 12000) {
    const j = await mc(`/lists/${aid}/members?count=1000&offset=${o2}&fields=members.email_address,members.timestamp_opt,total_items`);
    t2 = j.total_items||0; const got = j.members||[]; mem.push(...got); o2 += 1000; if (!got.length) break;
  }
  const box = { "imported Tuesday": {n:0,b:0}, "already on the list": {n:0,b:0} };
  for (const m of mem) {
    const g = (m.timestamp_opt && new Date(m.timestamp_opt) >= CUT) ? "imported Tuesday" : "already on the list";
    box[g].n++; if (bad.has(m.email_address.toLowerCase())) box[g].b++;
  }
  console.log(`\n=== ${slug}: ${bad.size} hard bounces on today's issue ===`);
  for (const [g,v] of Object.entries(box)) console.log(`  ${g.padEnd(22)} ${String(v.n).padStart(6)} addresses, ${String(v.b).padStart(4)} bounced  ${(v.b/Math.max(v.n,1)*100).toFixed(2)}%`);
}
await p.$disconnect();
