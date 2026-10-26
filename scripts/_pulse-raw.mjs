import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const token = (process.env.PULSE_TOKEN || "").trim();
if (!token) { console.log("no PULSE_TOKEN"); process.exit(); }
const sites = await p.site.findMany({ where: { status: { in: ["live", "cold_start"] } }, orderBy: { createdAt: "asc" } });
const all = {};
for (const s of sites) {
  const c = await p.siteCredential.findFirst({ where: { siteId: s.id, kind: "wordpress" } });
  const wp = c && decryptJson(c.payloadEnc);
  const r = await fetch(`${String(wp.url).replace(/\/$/, "")}/wp-json/cogent/v1/pulse/report?days=40&token=${encodeURIComponent(token)}`, { headers: { "user-agent": process.env.UA || "CogentDashboard/1.0", accept: "application/json" } }).then(r => r.json()).catch(e => ({ err: e.message }));
  all[s.slug] = r; if (!r.daily) { console.log(s.slug, "->", JSON.stringify(r).slice(0, 200)); continue; }
  console.log(`\n=== ${s.slug} first ${r.first} humans ${r.humans} bots ${r.bots} ${JSON.stringify(r.sources)}`);
  console.log("  daily:", (r.daily || []).map(d => `${d.day.slice(5)}:${d.views}`).join(" "));
  console.log("  top:", (r.top || []).slice(0, 5).map(t => `${t.views} ${t.title.slice(0, 45)}`).join(" | "));
}
await p.$disconnect();
