/** One-off: publish post 1017 and report its live URL. */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const wp = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).wordpress;
await prisma.$disconnect();
const base = (wp.baseUrl || wp.url || "").replace(/\/$/, "");
const auth = Buffer.from(`${wp.username || wp.user}:${wp.appPassword || wp.password}`).toString("base64");
const res = await fetch(`${base}/wp-json/wp/v2/posts/1017`, {
  method: "POST",
  headers: { authorization: `Basic ${auth}`, "content-type": "application/json", "user-agent": "CogentBot/1.0" },
  body: JSON.stringify({ status: "publish" }),
});
const p = await res.json();
if (!res.ok) { console.error(`publish failed ${res.status}: ${JSON.stringify(p).slice(0, 300)}`); process.exit(1); }
console.log(`status=${p.status}\ndate_gmt=${p.date_gmt}\ntags=${JSON.stringify(p.tags)}\nlink=${p.link}`);
