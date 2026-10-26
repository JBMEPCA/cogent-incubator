import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
console.log("audience:", cfg.audienceId);
let reps = [];
for (let off = 0; off < 400 && reps.length < 8; off += 100) {
  const j = await mc(`/reports?count=100&offset=${off}&sort_field=send_time&sort_dir=DESC`);
  reps.push(...(j.reports||[]).filter(r => r.list_id === cfg.audienceId || /barbering/i.test(r.campaign_title||r.subject_line||"")));
  if (!(j.reports||[]).length) break;
}
console.log(`found ${reps.length}`);
for (const r of reps.slice(0,8)) {
  const e=r.emails_sent||0, hb=r.bounces?.hard_bounces||0, sb=r.bounces?.soft_bounces||0;
  console.log(`  ${(r.send_time||"").slice(0,16)} ${r.id} "${(r.campaign_title||r.subject_line||"").slice(0,42).padEnd(44)}" sent ${String(e).padStart(5)} hard ${String(hb).padStart(3)} soft ${String(sb).padStart(3)} = ${((hb+sb)/Math.max(e,1)*100).toFixed(2)}%  opens ${(((r.opens?.proxy_excluded_open_rate ?? r.opens?.open_rate ?? 0))*100).toFixed(1)}%`);
}
const dom = {}, addrs = [];
for (const r of reps.slice(0,2)) {
  let all = [], off = 0, total = 1;
  while (off < total && off < 3000) {
    const j = await mc(`/reports/${r.id}/sent-to?count=1000&offset=${off}&fields=sent_to.email_address,sent_to.status,total_items`);
    total = j.total_items||0; all.push(...(j.sent_to||[])); off += 1000;
    if (!(j.sent_to||[]).length) break;
  }
  const bad = all.filter(x => x.status === "hard" || x.status === "soft");
  console.log(`\n${(r.send_time||"").slice(0,10)}: ${bad.length} bounced of ${all.length} fetched (total ${total})`);
  for (const x of bad) { const d = x.email_address.split("@")[1]; dom[d]=(dom[d]||0)+1; addrs.push(`${x.status}  ${x.email_address}`); }
}
console.log("\nbouncing domains:");
for (const [d,n] of Object.entries(dom).sort((a,b)=>b[1]-a[1]).slice(0,30)) console.log(`  ${String(n).padStart(3)}  ${d}`);
await p.$disconnect();
