// Click rates for today's briefings, human clicks separated from bot clicks.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const F = ["reports.id","reports.list_id","reports.send_time","reports.emails_sent","reports.bounces","reports.clicks","reports.opens"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
const today = new Map();
for (const r of (d.reports||[]).filter(x => (x.send_time||"").slice(0,10) === "2026-10-12")) if (!today.has(r.list_id)) today.set(r.list_id, r);
console.log("title".padEnd(27) + "delivered  human clicks  human rate   all clicks   all rate   bot share");
let D=0,H=0,A=0;
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!cr.length) continue;
  const r = today.get(decryptJson(cr[0].payloadEnc).audienceId);
  if (!r) { console.log(`${s.slug.padEnd(27)} nothing today`); continue; }
  const delivered = (r.emails_sent||0) - (r.bounces?.hard_bounces||0) - (r.bounces?.soft_bounces||0);
  const human = r.clicks?.subscriber_clicks_human ?? null;
  const all = r.clicks?.unique_subscriber_clicks ?? 0;
  const hr = human === null ? null : human/Math.max(delivered,1)*100;
  const ar = all/Math.max(delivered,1)*100;
  D+=delivered; H+=(human??0); A+=all;
  console.log(s.slug.padEnd(27) + String(delivered).padStart(9) + String(human===null?"n/a":human).padStart(14) + (hr===null?"n/a":hr.toFixed(2)+"%").padStart(12) + String(all).padStart(13) + (ar.toFixed(2)+"%").padStart(11) + (all? (((all-(human??0))/all)*100).toFixed(0)+"%" : "-").padStart(12));
}
console.log("TOTAL".padEnd(27) + String(D).padStart(9) + String(H).padStart(14) + (H/D*100).toFixed(2).padStart(11) + "%" + String(A).padStart(13) + (A/D*100).toFixed(2).padStart(10) + "%" + (((A-H)/A)*100).toFixed(0).padStart(11) + "%");
await p.$disconnect();
