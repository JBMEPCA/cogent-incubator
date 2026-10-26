import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const F = ["reports.id","reports.campaign_title","reports.subject_line","reports.send_time","reports.emails_sent","reports.list_id","reports.opens","reports.bounces"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
const today = (d.reports||[]).filter(r => (r.send_time||"").slice(0,10) === "2026-10-12");
console.log(`campaigns with a send_time of today on the whole account: ${today.length}\n`);
const mine = new Map();
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (cr.length) mine.set(decryptJson(cr[0].payloadEnc).audienceId, s.slug);
}
for (const r of today) {
  const who = mine.get(r.list_id) || "(another CIM title)";
  console.log(`${String(who).padEnd(27)} ${(r.send_time||"").slice(11,16)}  "${(r.campaign_title||r.subject_line||"").slice(0,52)}"  sent ${r.emails_sent}  opens ${r.opens?.opens_total||0} total / ${r.opens?.unique_opens||0} unique / ${r.opens?.proxy_excluded_unique_opens ?? "n/a"} proxy-excluded`);
}
await p.$disconnect();
