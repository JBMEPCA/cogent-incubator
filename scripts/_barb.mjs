import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { lastIssueHealth, mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const h = await lastIssueHealth(cfg.audienceId);
console.log("gate:", JSON.stringify(h));
const j = await mc(`/reports?count=8&sort_field=send_time&sort_dir=DESC&fields=reports.subject_line,reports.send_time,reports.emails_sent,reports.bounces,reports.abuse_reports,reports.unsubscribed,reports.opens,reports.clicks,reports.list_id`);
const reps = (j.reports||[]).filter(r => r.list_id === cfg.audienceId);
console.log(`\nlast ${reps.length} Barbering campaigns:`);
for (const r of reps) {
  const e = r.emails_sent||0, b = (r.bounces?.hard_bounces||0)+(r.bounces?.soft_bounces||0);
  console.log(`  ${(r.send_time||"").slice(0,16)}  "${(r.subject_line||"").slice(0,34).padEnd(36)}" sent ${String(e).padStart(5)} hard ${String(r.bounces?.hard_bounces||0).padStart(3)} soft ${String(r.bounces?.soft_bounces||0).padStart(3)} bounce ${(b/Math.max(e,1)*100).toFixed(2)}% comp ${r.abuse_reports||0} unsub ${r.unsubscribed||0} opens ${(((r.opens?.proxy_excluded_open_rate ?? r.opens?.open_rate ?? 0))*100).toFixed(1)}%`);
}
await p.$disconnect();
