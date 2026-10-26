import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const j = await mc(`/reports?count=6&list_id=${cfg.audienceId}&sort_field=send_time&sort_dir=DESC`);
const reps = j.reports || [];
console.log(`Barbering, last ${reps.length} campaigns:`);
for (const r of reps) {
  const e = r.emails_sent||0, hb = r.bounces?.hard_bounces||0, sb = r.bounces?.soft_bounces||0;
  console.log(`  ${(r.send_time||"").slice(0,16)} ${r.id}  "${(r.subject_line||"").slice(0,30).padEnd(32)}" sent ${String(e).padStart(5)} hard ${String(hb).padStart(3)} soft ${String(sb).padStart(3)} = ${((hb+sb)/Math.max(e,1)*100).toFixed(2)}%  opens ${(((r.opens?.proxy_excluded_open_rate ?? r.opens?.open_rate ?? 0))*100).toFixed(1)}%  unsub ${r.unsubscribed||0}`);
}
// who bounced on the two most recent
const dom = {};
for (const r of reps.slice(0,2)) {
  const b = await mc(`/reports/${r.id}/unsubscribed?count=1`).catch(()=>null);
  const s2 = await mc(`/reports/${r.id}/sent-to?count=2000&fields=sent_to.email_address,sent_to.status,total_items`).catch(e=>({ sent_to: [], err: e.message }));
  const bad = (s2.sent_to||[]).filter(x => x.status === "hard" || x.status === "soft");
  console.log(`\n${(r.send_time||"").slice(0,10)}: ${bad.length} bounced of ${s2.total_items||0}`);
  for (const x of bad) { const d = x.email_address.split("@")[1]; dom[d] = (dom[d]||0)+1; }
}
console.log("\nbouncing domains:");
for (const [d,n] of Object.entries(dom).sort((a,b)=>b[1]-a[1]).slice(0,25)) console.log(`  ${String(n).padStart(3)}  ${d}`);
await p.$disconnect();
