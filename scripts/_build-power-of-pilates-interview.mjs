/**
 * Gym Champions: Claire Roberts, Power of Pilates (Lower Earley and
 * Crowthorne, Berkshire). Rebuilds the sweep's DRAFT, post 229, in the house
 * shape. JB, 14 Oct 2026: "Proof please".
 *
 * Source: the reply of 14 Oct 2026 13:46 UK from hello@powerofpilates.co.uk,
 * all seven answers plus one photo. It is UNSIGNED: the previous message from
 * that address was signed David, but these answers are the founder's first
 * person ("I came to Pilates because I needed it myself", "after nearly 20
 * years of teaching"), so they are attributed to Claire Roberts, as the sweep's
 * draft also did. The photo is taken to be Claire; JB to confirm.
 *
 * The sweep drafted 229 in the Q&A layout ~35 minutes after the reply landed,
 * before the row could be locked. This keeps the post (and the Article row
 * the sweep linked) and replaces the title, slug, excerpt, body, category and
 * featured image.
 *
 * House shape (JB, 8-9 Oct): h2 prose sections, every quote a plain
 * .interview-quote (all drawn as bubbles by the Gym child theme), a line of our
 * text before every bubble, positive framing. Quotes are hers, trimmed not
 * reworded. The award line is from our outreach research.
 *
 * Photo: 1080 square selfie, hair at the top edge. Scaled to 900 and set low on
 * a 1440x1080 blurred canvas so the article's centred 16:9 crop keeps her head.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-power-of-pilates-interview.mjs --hero=<jpg>
 */
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const HERO = (process.argv.find((a) => a.startsWith("--hero=")) || "").slice(7);
if (!HERO || !fs.existsSync(HERO)) throw new Error("--hero=<jpg>");
const POST_ID = 229;
const TARGET_ID = "cmuv1sdk7002da69vkk6kap0a";
const HERO_ALT = "Claire Roberts, founder of Power of Pilates, in one of her reformer studios in Berkshire";
const HERO_CAPTION = "Claire Roberts. Picture: supplied";

const GYM = "https://gymbusinessnews.com";
const L = { site: "https://powerofpilates.co.uk/", hub: `${GYM}/gym-champions/` };

const TITLE_TEXT = "Claire Roberts on Pilates before the boom";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Claire Roberts was teaching reformer Pilates in Berkshire long before it became the fitness trend of the decade. Nearly 20 years on, with two studios and an award, she explains how she prices classes, keeps good instructors, and why she wants to be the best, not the biggest.";
const META =
  "Power of Pilates founder Claire Roberts on 20 years of reformer Pilates in Berkshire, pricing classes, keeping instructors and opening a second studio.";
const KEYPHRASE = "Pilates studio business";
const SLUG = "gym-champions-claire-roberts-on-pilates-before-the-boom";
const CATEGORY_ID = 3; // Start & Grow

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/’/g, "&#8217;");

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Power of Pilates?</h2>
</div>
<p>${t(`Power of Pilates is an independent Pilates business in Berkshire, founded by Claire Roberts in 2007. It teaches mat and reformer classes at studios in Lower Earley and Crowthorne, and was voted Best Yoga and Pilates Studio in Berkshire at the Muddy Stilettos Awards for a second year running in 2026.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Power of Pilates</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">powerofpilates.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Pilates studios</dd>
</div>
<div>
<dt>Based</dt>
<dd>Lower Earley and Crowthorne, Berkshire</dd>
</div>
</dl>
</section>`,

  p(t(`Claire Roberts founded <a href="${L.site}">Power of Pilates</a> in 2007, years before reformer classes filled every high street. Nearly two decades on, she runs two studios in Berkshire and has been voted the county's Best Yoga and Pilates Studio at the Muddy Stilettos Awards for a second year running. She told us what the boom has changed, and what it has not.`)),

  h2(`Busy before it was fashionable`),
  p(t(`The studio did not need the reformer boom to fill its classes. For most of its life it did not even advertise where it was.`)),
  q(t(`We've actually been busy since we opened nearly 20 years ago. For the first 17 years, we didn't even have a sign outside the studio! Most of our business came through word of mouth.`)),
  p(t(`What has changed is the format. Demand has moved her from private sessions towards slightly larger group classes.`)),
  q(t(`It's lovely to see Pilates getting so much attention, although I do sometimes smile when people talk about Reformer as if it's just been invented!`)),

  h2(`A second studio, and a new community`),
  p(t(`A second site was planned before Covid and put on hold. When it came, it had to be the right place, run to the same standards as the first.`)),
  q(t(`I was never interested in opening lots of studios just for the sake of growing. It had to be the right location, and I wanted to be sure we could maintain the same standards and personal feel that we've built in Lower Earley.`)),
  p(t(`Crowthorne opened in December 2025, and the thing that surprised her most was how quickly the clients found each other.`)),
  q(t(`Almost from day one, clients were going for coffee together after classes and getting to know each other. It's lovely to see those friendships developing so naturally, especially as that's always been such a big part of what we do at Lower Earley.`)),

  h2(`Pricing for quality, not to be cheapest`),
  p(t(`Reformer classes cost roughly twice as much as mat classes at Power of Pilates. The equipment is expensive, instructors need extra training, and fewer people fit in the room. Roberts is clear about where she wants to compete.`)),
  q(t(`We try to keep both affordable while making sure we're not compromising on the quality of teaching. I've never wanted to compete by being the cheapest studio. I'd rather people come to us because they know they're getting a really good class.`)),

  h2(`Built on her own recovery`),
  p(t(`Pilates began as part of Roberts' own recovery, and she says that has shaped the business more than anything else.`)),
  q(t(`I came to Pilates because I needed it myself, so I've always understood that people aren't necessarily coming to us because they want to look a certain way. Often they just want to feel better, move more comfortably or get back to doing things they enjoy.`)),
  p(t(`It is why the studios set out to welcome complete beginners as warmly as clients of many years.`)),
  q(t(`Pilates should feel welcoming, not intimidating, and nobody should feel they have to be fit or flexible before they walk through the door.`)),

  h2(`Instructors who want to stay`),
  p(t(`Every new instructor goes through the studio's own onboarding, and the business invests in workshops and ongoing training. A qualification, she says, is only the starting point.`)),
  q(t(`We also try to look after our instructors. We have lovely, loyal clients and generally very busy classes, which makes a big difference. Nobody wants to turn up to teach an empty room!`),
    t(`I think good instructors want to feel supported, valued and part of something, rather than just being another name on a timetable.`)),

  h2(`The part nobody warns you about`),
  p(t(`Ask almost any studio owner this question and the answer involves a bathroom. Roberts is no exception.`)),
  q(t(`Unblocking toilets! And having to tell someone they can't have a refund because they've cancelled their class at the last minute.`),
    t(`After nearly 20 years, I've learned that running a Pilates studio involves surprisingly little Pilates some days!`)),

  h2(`The best, not the biggest`),
  p(t(`With two studios, a strong team and a loyal client base, Roberts has no plans to build a chain.`)),
  q(t(`Growth is great, but not if it means losing what made the business successful in the first place. Our aim has always been to be the best, not the biggest. And after nearly 20 years, I don't see that changing.`)),

  p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
].join("\n");

if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION + BODY)) throw new Error("dash");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
if (SEO_TITLE.length > 60) throw new Error(`seo title ${SEO_TITLE.length} > 60`);
const blocks = BODY.split("\n<blockquote");
let bare = 0;
for (let i = 1; i < blocks.length; i++) if (/<\/(h2|blockquote)>\s*$/.test(blocks[i - 1])) bare++;
if (bare) throw new Error(`${bare} bubble(s) with no text of ours before them`);
const words = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
console.log(`seo title ${SEO_TITLE.length} | meta ${META.length} | ~${words} words | bubbles ${blocks.length - 1}`);

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const wp = (args) => ssh(`cd '${docroot}' && wp ${args}`);

if (wp(`post get ${POST_ID} --field=post_status`) !== "draft") throw new Error(`post ${POST_ID} is not a draft`);
const oldThumb = wp(`post meta get ${POST_ID} _thumbnail_id`);
const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`pop-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
wp(`post update ${POST_ID} /tmp/pop-body-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --post_category=${CATEGORY_ID} --post_author=2`);
// --keep-hero: body-only rebuild, reuse the featured image already set.
const KEEP = process.argv.includes("--keep-hero");
if (!KEEP) put(`pop-hero-${stamp}.jpg`, fs.readFileSync(HERO));
const heroId = KEEP ? oldThumb : wp(`media import /tmp/pop-hero-${stamp}.jpg --post_id=${POST_ID} --featured_image --title=${b64("Claire Roberts, Power of Pilates")} --alt=${b64(HERO_ALT)} --caption=${b64(HERO_CAPTION)} --porcelain`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
ssh(`rm -f /tmp/pop-body-${stamp}.html /tmp/pop-hero-${stamp}.jpg`);

const db = forSite(site.id);
const target = await db.interviewTarget.findUnique({ where: { id: TARGET_ID } });
if (target.articleId) await db.article.update({ where: { id: target.articleId }, data: { title: SEO_TITLE, body: BODY, keyphrase: KEYPHRASE, metaDesc: META, category: "Start & Grow" } });
await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { headshotUrl: wp(`post get ${heroId} --field=guid`) } });
await prisma.$disconnect();

console.log(`old thumb ${oldThumb} kept in library; new hero ${heroId}`);
console.log(wp(`post get ${POST_ID} --fields=ID,post_status,post_name --format=json`));
console.log(`preview: ${GYM}/?p=${POST_ID}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${POST_ID}&action=edit`);
