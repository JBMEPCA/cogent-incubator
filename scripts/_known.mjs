// Every domain we ALREADY get content from, so the outreach list can exclude them.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const p = new PrismaClient();
const reg = (u) => {
  if (!u) return "";
  try {
    const h = new URL(u.startsWith("http") ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, "");
    const bits = h.split(".");
    return bits.length > 2 && bits.at(-2).length <= 3 && bits.at(-1).length <= 3 ? bits.slice(-3).join(".") : bits.slice(-2).join(".");
  } catch { return ""; }
};
const known = new Set();
const SINCE = new Date(Date.now() - 60 * 864e5);
const feeds = await p.prBrand.findMany({ where: { feedStatus: "ok" }, select: { website: true, newsHubUrl: true, feedUrl: true } });
for (const b of feeds) for (const u of [b.website, b.newsHubUrl, b.feedUrl]) { const d = reg(u); if (d) known.add(d); }
console.log("domains with a live feed:", known.size);
const active = await p.feedItem.groupBy({ by: ["brandId"], where: { discoveredAt: { gte: SINCE } }, _count: true });
const ids = active.map((a) => a.brandId);
for (let i = 0; i < ids.length; i += 500) {
  const brands = await p.prBrand.findMany({ where: { id: { in: ids.slice(i, i + 500) } }, select: { website: true, newsHubUrl: true } });
  for (const b of brands) for (const u of [b.website, b.newsHubUrl]) { const d = reg(u); if (d) known.add(d); }
}
console.log("after brands that produced items in 60 days:", known.size);
if (fs.existsSync(`${SP}/press-senders.json`)) {
  for (const d of JSON.parse(fs.readFileSync(`${SP}/press-senders.json`, "utf8"))) known.add(reg(d));
  console.log("after press@ senders:", known.size);
}
fs.writeFileSync(`${SP}/known-domains.json`, JSON.stringify([...known].filter(Boolean).sort()));
console.log("written", known.size);
await p.$disconnect();
