// Today's Monday briefing, as Mailchimp has it right now.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const F = ["reports.id","reports.campaign_title","reports.subject_line","reports.send_time","reports.emails_sent","reports.list_id","reports.bounces","reports.abuse_reports","reports.unsubscribed","reports.opens","reports.clicks"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
const today = (d.reports||[]).filter(r => (r.send_time||"").slice(0,10) === "2026-10-12");
const byList = new Map();
for (const r of today) if (!byList.has(r.list_id)) byList.set(r.list_id, r);
let sent=0, del=0, op=0, cl=0;
console.log("title".padEnd(27) + "delivered   opens   open%   clicks  click%   bounce   unsub  comp");
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!cr.length) { console.log(`${s.slug.padEnd(27)} no mailchimp`); continue; }
  const aid = decryptJson(cr[0].payloadEnc).audienceId;
  const r = byList.get(aid);
  if (!r) { console.log(`${s.slug.padEnd(27)} NOTHING SENT TODAY`); continue; }
  const e = r.emails_sent||0, hb = r.bounces?.hard_bounces||0, sb = r.bounces?.soft_bounces||0;
  const delivered = e - hb - sb;
  const opens = r.opens?.proxy_excluded_unique_opens ?? r.opens?.unique_opens ?? 0;
  const orate = (r.opens?.proxy_excluded_open_rate ?? r.opens?.open_rate ?? 0) * 100;
  const clicks = r.clicks?.subscriber_clicks_human ?? r.clicks?.unique_subscriber_clicks ?? 0;
  const crate = (r.clicks?.click_rate_human ?? r.clicks?.click_rate ?? 0) * 100;
  sent+=e; del+=delivered; op+=opens; cl+=clicks;
  console.log(s.slug.padEnd(27) + String(delivered).padStart(9) + String(opens).padStart(8) + (orate.toFixed(1)+"%").padStart(8) + String(clicks).padStart(9) + (crate.toFixed(1)+"%").padStart(8) + String(hb+sb).padStart(9) + String(r.unsubscribed||0).padStart(8) + String(r.abuse_reports||0).padStart(6));
}
console.log("TOTAL".padEnd(27) + String(del).padStart(9) + String(op).padStart(8) + ((op/Math.max(del,1))*100).toFixed(1).padStart(7) + "%" + String(cl).padStart(9));
await p.$disconnect();
