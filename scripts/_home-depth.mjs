/**
 * One-off: how far back does a post have to sit to fall off the Smart SME
 * homepage entirely?
 *
 * The plan in cogent-base/inc/homepage.php reserves HERO(1)+SUB(3)+LATEST(6)
 * from the newest posts site-wide, then gives each section the newest 4 of its
 * category that the plan has not already used. So a post is invisible on the
 * front page once 10 posts site-wide AND 4 Operations posts are newer than it.
 */
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
const get = (path) =>
  fetch(`${base}/wp-json/wp/v2/${path}`, {
    headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
  }).then((r) => r.json());

const uk = (d) => new Date(d + "Z").toLocaleString("en-GB", { timeZone: "Europe/London" });

const recent = await get("posts?per_page=14&status=publish&orderby=date&order=desc&_fields=id,date_gmt,title");
console.log("newest 14 site-wide:");
recent.forEach((p, i) =>
  console.log(`  ${String(i + 1).padStart(2)}. ${uk(p.date_gmt)}  ${p.title.rendered.slice(0, 55)}`)
);

const cats = await get("categories?slug=operations&_fields=id,name,count");
const opsId = cats[0]?.id;
const ops = await get(
  `posts?per_page=6&status=publish&categories=${opsId}&orderby=date&order=desc&_fields=id,date_gmt,title`
);
console.log(`\nnewest 6 in Operations (id ${opsId}, ${cats[0]?.count} posts):`);
ops.forEach((p, i) =>
  console.log(`  ${String(i + 1).padStart(2)}. ${uk(p.date_gmt)}  ${p.title.rendered.slice(0, 55)}`)
);

console.log(`\n10th newest site-wide:  ${recent[9] ? uk(recent[9].date_gmt) : "n/a"}`);
console.log(`4th newest in Operations: ${ops[3] ? uk(ops[3].date_gmt) : "n/a"}`);
