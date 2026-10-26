// Is Barbering blocked, or is it just the dead import? A blocklisting hits the
// whole list; a bad import only hits the addresses in it.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const AID = cfg.audienceId;

// today's campaign
const F = ["reports.id","reports.campaign_title","reports.send_time","reports.list_id","reports.emails_sent","reports.bounces","reports.opens","reports.abuse_reports"].join(",");
const d = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC&fields=${encodeURIComponent(F)}`);
const r = (d.reports||[]).find(x => x.list_id === AID && (x.send_time||"").slice(0,10) === "2026-10-12");
console.log(`campaign ${r.id}  sent ${r.emails_sent}  hard ${r.bounces?.hard_bounces||0} soft ${r.bounces?.soft_bounces||0}  complaints ${r.abuse_reports||0}`);

// who opened it
const openers = new Set();
let off = 0, total = 1;
while (off < total && off < 3000) {
  const j = await mc(`/reports/${r.id}/email-activity?count=500&offset=${off}&fields=emails.email_address,emails.activity,total_items`);
  total = j.total_items||0;
  for (const e of j.emails||[]) if ((e.activity||[]).some(a => a.action === "open")) openers.add(e.email_address.toLowerCase());
  const got = (j.emails||[]).length; off += 500; if (!got) break;
}
console.log(`email-activity rows scanned: ${Math.min(off,total)} of ${total}, openers found ${openers.size}`);

// split by when they joined
let members = [], o2 = 0, t2 = 1;
while (o2 < t2 && o2 < 4000) {
  const j = await mc(`/lists/${AID}/members?count=1000&offset=${o2}&status=subscribed&fields=members.email_address,members.timestamp_opt,total_items`);
  t2 = j.total_items||0; members.push(...(j.members||[])); const got=(j.members||[]).length; o2 += 1000; if (!got) break;
}
const CUT = new Date("2026-09-30T00:00:00Z");
const box = { "original list": { n:0, o:0 }, "imported 30 Sep": { n:0, o:0 } };
for (const m of members) {
  const g = (m.timestamp_opt && new Date(m.timestamp_opt) >= CUT) ? "imported 30 Sep" : "original list";
  box[g].n++; if (openers.has(m.email_address.toLowerCase())) box[g].o++;
}
console.log("\ntoday's opens, split by when the address joined:");
for (const [g,v] of Object.entries(box)) console.log(`  ${g.padEnd(18)} ${String(v.n).padStart(5)} sent  ${String(v.o).padStart(4)} opened  ${(v.o/Math.max(v.n,1)*100).toFixed(1)}%`);
await p.$disconnect();
