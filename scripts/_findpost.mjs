import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const WANT = {
  "smart-sme": "Joyner",
  "golf-resort-magazine": "Mountain Lake",
  "airport-business-magazine": "Mark Johnston",
  "gym-business-news": "Gym Champions",
  "dental-business-news": "Beaty",
  "barbering-business": "Rob Wood",
  "nursery-daily": "Konyardi",
};
for (const [slug, q] of Object.entries(WANT)) {
  const site = await p.site.findUnique({ where: { slug } });
  const rows = await p.siteCredential.findMany({ where: { siteId: site.id, kind: "wordpress" } });
  const wp = decryptJson(rows[0].payloadEnc);
  const base = String(wp.url).replace(/\/$/, "");
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const res = await fetch(`${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=5&orderby=date&order=desc&_fields=id,title,date,featured_media`, {
    headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
  });
  const posts = res.ok ? await res.json() : [];
  console.log(`\n## ${slug}  "${q}"  (${res.status})`);
  for (const x of posts) console.log(`  ${String(x.id).padStart(5)} ${x.date.slice(0, 10)} media=${x.featured_media || "none"}  ${x.title.rendered.replace(/<[^>]+>/g, "").slice(0, 70)}`);
}
await p.$disconnect();
