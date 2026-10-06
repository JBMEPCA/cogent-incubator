/** One-off: create the guest-perspective tag and put it on draft 1017. */
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
const api = async (path, body) => {
  const res = await fetch(`${base}/wp-json/wp/v2/${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json", "user-agent": "CogentBot/1.0" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && json?.code !== "term_exists") throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
};

let tag = (await api("tags?slug=guest-perspective"))[0];
if (!tag) {
  const made = await api("tags", { name: "Guest perspective", slug: "guest-perspective" });
  tag = made.id ? made : { id: made?.data?.term_id };
}
console.log(`tag guest-perspective id=${tag.id}`);

const post = await api("posts/1026", { tags: [tag.id] });
console.log(`post 1026 status=${post.status} tags=${JSON.stringify(post.tags)} slug=${post.slug}`);

// The bury is the tag, not the date: put the date back to now.
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");
const dated = await api("posts/1026", { date_gmt: now });
console.log(`date_gmt=${dated.date_gmt}  link=${dated.link}`);

const ua = { "user-agent": "Mozilla/5.0 (verify-check)", "cache-control": "no-cache" };
const homeHtml = await fetch(`${base}/?nocache=${Date.now()}`, { headers: ua }).then((r) => r.text());
const hits = (homeHtml.match(new RegExp(dated.slug, "g")) || []).length;
console.log(`homepage mentions of the slug: ${hits}  ->  ${hits === 0 ? "BURIED OK" : "STILL ON HOMEPAGE"}`);
const art = await fetch(dated.link, { headers: ua });
console.log(`article: HTTP ${art.status}`);
