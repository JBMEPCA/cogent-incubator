import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const DAY = "2026-10-22";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const F = ["reports.id","reports.campaign_title","reports.subject_line","reports.send_time","reports.emails_sent","reports.list_id","reports.bounces","reports.abuse_reports","reports.unsubscribed","reports.opens","reports.clicks"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
const today = new Map();
for (const r of (d.reports||[]).filter(x => (x.send_time||"").slice(0,10) === DAY)) if (!today.has(r.list_id)) today.set(r.list_id, r);
console.log("title".padEnd(27) + "sent    delivered   opens   open%   human clicks  click%   hard  unsub  comp");
let D=0,O=0,H=0, missing=[];
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!cr.length) continue;
  const r = today.get(decryptJson(cr[0].payloadEnc).audienceId);
  if (!r) { console.log(`${s.slug.padEnd(27)} NOTHING SENT TODAY`); missing.push(s.slug); continue; }
  const e=r.emails_sent||0, hb=r.bounces?.hard_bounces||0, sb=r.bounces?.soft_bounces||0;
  const del=e-hb-sb;
  const op=r.opens?.proxy_excluded_unique_opens ?? r.opens?.unique_opens ?? 0;
  const orate=(r.opens?.proxy_excluded_open_rate ?? r.opens?.open_rate ?? 0)*100;
  const hc=r.clicks?.subscriber_clicks_human ?? 0;
  D+=del;O+=op;H+=hc;
  console.log(s.slug.padEnd(27) + (r.send_time||"").slice(11,16).padEnd(8) + String(del).padStart(9) + String(op).padStart(8) + (orate.toFixed(1)+"%").padStart(8) + String(hc).padStart(14) + ((hc/Math.max(del,1))*100).toFixed(2).padStart(7) + "%" + String(hb).padStart(7) + String(r.unsubscribed||0).padStart(7) + String(r.abuse_reports||0).padStart(6));
}
console.log("TOTAL".padEnd(27) + "".padEnd(8) + String(D).padStart(9) + String(O).padStart(8) + ((O/Math.max(D,1))*100).toFixed(1).padStart(7) + "%" + String(H).padStart(14) + ((H/Math.max(D,1))*100).toFixed(2).padStart(7) + "%");
if (missing.length) console.log("\nDID NOT SEND:", missing.join(", "));
await p.$disconnect();
