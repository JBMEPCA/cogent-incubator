import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const F = ["reports.id","reports.campaign_title","reports.subject_line","reports.send_time","reports.emails_sent","reports.list_id","reports.bounces","reports.abuse_reports","reports.unsubscribed","reports.opens","reports.clicks"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
const mine = (d.reports||[]).filter(x => x.list_id === cfg.audienceId && x.emails_sent);
console.log(`Barbering campaigns on record: ${mine.length}\n`);
for (const r of mine) {
  const e=r.emails_sent, hb=r.bounces?.hard_bounces||0, sb=r.bounces?.soft_bounces||0;
  console.log(`  ${(r.send_time||"").slice(0,10)} ${(r.campaign_title||r.subject_line||"").slice(0,34).padEnd(36)} sent ${String(e).padStart(5)}  hard ${String(hb).padStart(3)} (${(hb/e*100).toFixed(2)}%)  soft ${String(sb).padStart(3)}  opens ${(((r.opens?.proxy_excluded_open_rate ?? r.opens?.open_rate ?? 0))*100).toFixed(1)}%  clicks ${(((r.clicks?.click_rate_human ?? r.clicks?.click_rate ?? 0))*100).toFixed(1)}%  unsub ${r.unsubscribed||0}  comp ${r.abuse_reports||0}`);
}
await p.$disconnect();
