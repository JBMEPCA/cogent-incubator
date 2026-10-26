import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const F = "members.email_address,members.status,members.timestamp_opt,members.member_rating,members.stats,total_items";
let all = [], off = 0, total = 1;
while (off < total && off < 4000) {
  const j = await mc(`/lists/${cfg.audienceId}/members?count=1000&offset=${off}&fields=${encodeURIComponent(F)}`);
  total = j.total_items||0; const got = j.members||[]; all.push(...got); off += 1000; if (!got.length) break;
}
console.log(`audience ${cfg.audienceId}: ${all.length} fetched of ${total}`);
const st = {}; for (const m of all) st[m.status]=(st[m.status]||0)+1;
console.log("by status:", st);
const CUT = new Date("2026-09-30T00:00:00Z");
const grp = (m) => (m.timestamp_opt && new Date(m.timestamp_opt) >= CUT) ? "added 30 Sep onward" : "original list";
const box = {};
for (const m of all) {
  if (m.status !== "subscribed") continue;
  const g = grp(m);
  const o = m.stats?.avg_open_rate ?? 0;
  box[g] = box[g] || { n:0, everOpened:0, sumOpen:0 };
  box[g].n++; box[g].sumOpen += o; if (o > 0) box[g].everOpened++;
}
console.log("\nsubscribed members, have they ever opened:");
for (const [g,v] of Object.entries(box)) console.log(`  ${g.padEnd(22)} ${String(v.n).padStart(5)} people, ${String(v.everOpened).padStart(4)} have opened at least once (${(v.everOpened/v.n*100).toFixed(1)}%), avg open rate ${(v.sumOpen/v.n*100).toFixed(1)}%`);
const cleaned = all.filter(m=>m.status==="cleaned");
console.log(`\ncleaned (dead) addresses on the list: ${cleaned.length}`);
const cd = {}; for (const m of cleaned) { const d=m.email_address.split("@")[1]; cd[d]=(cd[d]||0)+1; }
console.log("  top domains:", Object.entries(cd).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([d,n])=>`${d} ${n}`).join(", "));
await p.$disconnect();
