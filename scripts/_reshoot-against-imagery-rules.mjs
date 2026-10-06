// One-off: re-check a title's LIVE header images against the picture gate as it
// now stands (its own imagery rules plus the wrong-country refusal), and re-shoot
// the ones that fail.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_reshoot-against-imagery-rules.mjs --site=nursery-daily --dry-run
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_reshoot-against-imagery-rules.mjs --site=nursery-daily
//
// Written 2 Oct 2026 after JB's Nursery feedback: Nursery Daily's standard bans
// stock photos of identifiable children, the gate never saw that rule, and the
// archive went out with children in several headers and a story about Ireland
// illustrated somewhere that was plainly not Ireland. lib/qa.js and lib/images.js
// now carry the rules; this cleans up what was published before they did.
//
// WordPress is the authority on what is live, so posts are read from there. A
// post whose replacement cannot be found keeps its picture and is listed, rather
// than being left bare.
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { verifyImage } from "../lib/qa.js";
import { chooseSmartImage } from "../lib/images.js";
import { uploadMedia, updatePost } from "../lib/wordpress.js";

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const DRY = process.argv.includes("--dry-run");
const site = await prisma.site.findUnique({ where: { slug: arg("site") } });
if (!site) throw new Error("--site=<slug> required");
const { creds } = await siteCredentials(site.id);
const wp = creds.wordpress;
const base = `${wp.url.replace(/\/$/, "")}/wp-json/wp/v2`;
const auth = { authorization: `Basic ${Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64")}` };
const db = forSite(site.id);

const decode = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&amp;/g, "&")
    .trim();

const posts = [];
for (let page = 1; page <= 10; page++) {
  const res = await fetch(`${base}/posts?per_page=100&page=${page}&status=publish&_fields=id,title,link,featured_media`, { headers: auth });
  if (res.status === 400) break;
  if (!res.ok) throw new Error(`WP posts ${res.status}`);
  const batch = await res.json();
  posts.push(...batch);
  if (batch.length < 100) break;
}
console.log(`${site.name}: ${posts.length} published posts${DRY ? " (dry run)" : ""}\n`);

// --only=1,2,3 re-shoots exactly these posts and skips the judging pass. The
// gate is a Haiku call and on the 2 Oct run it also refused a few pictures the
// rule permits (an empty playroom, a render of an empty nursery), so the list
// that was actually replaced was confirmed by eye from a contact sheet first.
const only = (arg("only") || "").split(",").filter(Boolean).map(Number);

const failed = [];
for (const p of posts.filter((x) => x.featured_media && only.length && only.includes(x.id))) {
  failed.push({ ...p, title: decode(p.title.rendered) });
}
for (const p of posts.filter((x) => x.featured_media && !only.length)) {
  const media = await (await fetch(`${base}/media/${p.featured_media}?_fields=source_url`, { headers: auth })).json();
  const url = media?.source_url;
  if (!url) continue;
  const title = decode(p.title.rendered);
  // Judge the ORIGINAL picture (Pexels, the source page) where the app has it.
  // The title's own host 403s the gate's bot user-agent, so fetching the
  // uploaded copy from WordPress fails every time and judges nothing.
  const article = await db.article.findFirst({ where: { wpPostId: p.id }, select: { imageUrl: true } });
  const judge = article?.imageUrl && !article.imageUrl.includes(new URL(wp.url).hostname) ? article.imageUrl : url;
  const check = await verifyImage({ site, imageUrl: judge, title });
  if (check.ok) continue;
  if (/^image (fetch|unreachable)/.test(check.reason)) {
    console.log(`SKIP   ${p.id}  ${title}: could not fetch the picture to judge it (${check.reason})`);
    continue;
  }
  console.log(`FAILS  ${p.id}  ${title}\n       ${check.reason}\n       ${p.link}`);
  failed.push({ ...p, title, url });
}
console.log(`\n${failed.length} header image(s) fail the current gate.`);

if (!DRY) {
  for (const p of failed) {
    const article = await db.article.findFirst({ where: { wpPostId: p.id }, select: { id: true, keyphrase: true, category: true } });
    const { image, reason } = await chooseSmartImage(site, { title: p.title, keyphrase: article?.keyphrase, category: article?.category });
    if (!image) {
      console.log(`KEPT   ${p.id}  ${p.title}: no replacement found (${reason})`);
      continue;
    }
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const media = await uploadMedia(wp, { imageUrl: image.url, alt: image.alt, caption: image.credit || undefined, filename: slug });
    // The title rides along so Yoast rewrites the indexable and og:image follows.
    await updatePost(wp, p.id, { featured_media: media.id, title: p.title });
    if (article) {
      await db.article.update({ where: { id: article.id }, data: { imageUrl: image.url, imageAlt: image.alt, imageSource: image.source } });
    }
    console.log(`SWAPPED ${p.id}  ${p.title}\n        ${media.url}`);
  }
}
await prisma.$disconnect();
