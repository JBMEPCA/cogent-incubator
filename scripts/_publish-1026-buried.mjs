/**
 * One-off: publish post 1026 (Hugs & Co. / Bon Orbit) backdated so it never
 * touches the homepage, then check the front page to prove it.
 *
 * The homepage plan (cogent-base/inc/homepage.php) takes the newest 10 posts
 * site-wide for hero + sub + latest, then the newest 4 per category section.
 * A post is invisible once 10 site-wide AND 4 in its category are newer, so
 * the date goes an hour behind the older of those two boundaries.
 */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const POST_ID = 1026;
const CATEGORY_SLUG = "news";

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
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
};
const uk = (d) => new Date(d + "Z").toLocaleString("en-GB", { timeZone: "Europe/London" });

const recent = await api("posts?per_page=10&status=publish&orderby=date&order=desc&_fields=id,date_gmt,title");
const cat = (await api(`categories?slug=${CATEGORY_SLUG}&_fields=id,name`))[0];
const inCat = await api(
  `posts?per_page=4&status=publish&categories=${cat.id}&orderby=date&order=desc&_fields=id,date_gmt,title`
);
const siteEdge = new Date(recent[9].date_gmt + "Z");
const catEdge = new Date(inCat[3].date_gmt + "Z");
console.log(`10th newest site-wide: ${uk(recent[9].date_gmt)}  ${recent[9].title.rendered.slice(0, 50)}`);
console.log(`4th newest in ${cat.name}:   ${uk(inCat[3].date_gmt)}  ${inCat[3].title.rendered.slice(0, 50)}`);

const target = new Date(Math.min(siteEdge, catEdge) - 60 * 60 * 1000);
const dateGmt = target.toISOString().replace(/\.\d{3}Z$/, "");
console.log(`publishing with date_gmt=${dateGmt} (${uk(dateGmt)} UK)`);

const p = await api(`posts/${POST_ID}`, { status: "publish", date_gmt: dateGmt });
console.log(`status=${p.status}  date_gmt=${p.date_gmt}  link=${p.link}`);

// Prove it: the live article answers, and the homepage does not mention it.
const ua = { "user-agent": "Mozilla/5.0 (verify-check)", "cache-control": "no-cache" };
const art = await fetch(p.link, { headers: ua });
const artHtml = await art.text();
console.log(`article: HTTP ${art.status}, title present: ${/Hugs (&amp;|&#038;|&) Co\. selected/i.test(artHtml)}`);
const home = await fetch(`${base}/?nocache=${Date.now()}`, { headers: ua });
const homeHtml = await home.text();
const hits = (homeHtml.match(new RegExp(p.slug, "g")) || []).length;
console.log(`homepage: HTTP ${home.status}, mentions of the slug: ${hits}`);
console.log(hits === 0 ? "BURIED OK" : "STILL ON HOMEPAGE");
