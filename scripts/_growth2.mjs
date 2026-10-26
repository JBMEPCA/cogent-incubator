import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true, name:true }, orderBy: { createdAt: "asc" } });
const WEEK = new Date(Date.now() - 7*864e5).toISOString();
const FORT = new Date(Date.now() - 14*864e5).toISOString();
let totC = 0, totW = 0;
const rows = [];
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!cr.length) { rows.push({ slug: s.slug, err: "no mailchimp" }); continue; }
  const cfg = decryptJson(cr[0].payloadEnc);
  try {
    const l = await mc(`/lists/${cfg.audienceId}?fields=stats.member_count,stats.unsubscribe_count,stats.cleaned_count,stats.total_contacts`);
    const week = await mc(`/lists/${cfg.audienceId}/members?count=1&status=subscribed&since_timestamp_opt=${encodeURIComponent(WEEK)}&fields=total_items`);
    const fort = await mc(`/lists/${cfg.audienceId}/members?count=1&status=subscribed&since_timestamp_opt=${encodeURIComponent(FORT)}&fields=total_items`);
    const c = l.stats?.member_count||0, w = week.total_items||0, f = fort.total_items||0;
    totC += c; totW += w;
    rows.push({ slug: s.slug, count: c, week: w, prevWeek: f - w, cleaned: l.stats?.cleaned_count||0, unsub: l.stats?.unsubscribe_count||0 });
  } catch (e) { rows.push({ slug: s.slug, err: e.message.slice(0,60) }); }
}
console.log("title".padEnd(27) + "subscribers   this week   week before   cleaned   unsub");
for (const r of rows) {
  if (r.err) { console.log(`${r.slug.padEnd(27)} ${r.err}`); continue; }
  console.log(r.slug.padEnd(27) + String(r.count).padStart(11) + String(r.week > 0 ? "+"+r.week : "0").padStart(12) + String(r.prevWeek > 0 ? "+"+r.prevWeek : "0").padStart(14) + String(r.cleaned).padStart(10) + String(r.unsub).padStart(8));
}
console.log("TOTAL".padEnd(27) + String(totC).padStart(11) + String("+"+totW).padStart(12));
const g = await p.globalSetting.findUnique({ where: { key: "drip_paused_targets" } }).catch(()=>null);
console.log("\ndrip paused targets:", g?.value ? g.value.slice(0, 400) : "(none set)");
await p.$disconnect();
