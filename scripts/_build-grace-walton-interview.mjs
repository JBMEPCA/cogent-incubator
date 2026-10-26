/**
 * Gym Champions: Grace Walton, Grace Walton Fitness (Cheltenham). Built as a
 * WordPress DRAFT for JB to preview. JB, 9 Oct 2026: "Can you proof to me".
 *
 * Source: her reply of 9 Oct 2026 15:27 UK (gracewaltonfitness@gmail.com),
 * six answers (she skipped Q1, how renting space in another gym works
 * financially) and one photo she is "happy for you to use". Row locked to
 * "drafted" at ~15:35 UK before the sweep read it.
 *
 * House shape for Gym Champions as JB set it on 8 and 9 Oct: h2 sections of
 * prose, every quote a plain .interview-quote (the Gym child theme draws each
 * one as a speech bubble), a line of our text before every bubble, and a
 * positive framing. Quotes are hers, trimmed not reworded; punctuation only.
 * The award line is from our outreach research (Muddy Stilettos winners page).
 *
 * Photo: a 959x1147 selfie. Cut 860 tall from y=30 and set on a 4:3 canvas
 * over a blurred copy of itself, so the article's centred 16:9 crop keeps her
 * whole head. No logo: none found on gracewaltonfitness.co.uk.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-grace-walton-interview.mjs --hero=<4:3 jpg> [--post=<id>]
 */
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const HERO = (process.argv.find((a) => a.startsWith("--hero=")) || "").slice(7);
if (!HERO || !fs.existsSync(HERO)) throw new Error("--hero=<jpg>");
const TARGET_ID = "cmuv1sdnh002ja69vafjmvzvs";
const HERO_ALT = "Grace Walton, personal trainer and founder of Grace Walton Fitness, smiling in a gym in Cheltenham";
const HERO_CAPTION = "Grace Walton. Picture: supplied";

const GYM = "https://gymbusinessnews.com";
const L = { site: "https://gracewaltonfitness.co.uk/", hub: `${GYM}/gym-champions/` };

const TITLE_TEXT = "Grace Walton on a PT business built in a year";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Grace Walton left journalism to become a personal trainer in Cheltenham, and a year later she has an established business and an award to show for it. She explains how social media filled it before she started, and what a Sunday run club with coffee at the end has done for the business.";
const META =
  "Cheltenham personal trainer Grace Walton on building a PT business in a year, filling her diary through social media and her Jog and Brew run club.";
const KEYPHRASE = "personal trainer business";
const SLUG = "gym-champions-grace-walton-on-a-pt-business-built-in-a-year";
const CATEGORY_ID = 3; // Start & Grow
const AUTHOR_ID = 2;

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/’/g, "&#8217;");

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Grace Walton Fitness?</h2>
</div>
<p>${t(`Grace Walton Fitness is a personal training business in Cheltenham, run by former journalist Grace Walton. She offers one to one PT and small group sessions from gyms in the town, runs the Jog and Brew social run club, and won Best Sport and Fitness Instructor at the Muddy Stilettos Gloucestershire and Worcestershire Awards 2026.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Grace Walton Fitness</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">gracewaltonfitness.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Personal training</dd>
</div>
<div>
<dt>Based</dt>
<dd>Cheltenham, Gloucestershire</dd>
</div>
</dl>
</section>`,

  p(t(`A year ago Grace Walton was a journalist. Today <a href="${L.site}">Grace Walton Fitness</a> is an established personal training business in Cheltenham, and she has just been named Best Sport and Fitness Instructor at the Muddy Stilettos Gloucestershire and Worcestershire Awards 2026. She told us how she built it, and why she would not change a thing.`)),

  h2(`Three ways in, one business`),
  p(t(`Walton runs one to one PT, small group classes and a social run club. Asked which one grows the business, she says they all do, each in its own way.`)),
  q(t(`My PT sessions are where I make my money and truly get to know my clients and build rapport. The group classes enable me to bring out my fun side and for people to get to know me. Through this, it is word of mouth on how I recruit new clients.`)),

  h2(`Coffee at the finish line`),
  p(t(`Jog and Brew started as something for herself: a reason to get out on a Sunday morning, and a way to meet people.`)),
  q(t(`Knowing there is a coffee and natter at the end means it is more motivating to get out of bed on a Sunday morning for a run. In time, I have met some lovely people through this group who I am now lucky to call my friends.`)),
  p(t(`It was never meant to sell anything, but it has done the business good all the same.`)),
  q(t(`It wasn't really a tool to boost business, however, it has increased awareness of Grace Walton Fitness and has led to me personal training some of these members.`)),

  h2(`Clients waiting on day one`),
  p(t(`Most new personal trainers spend their first months trying to fill a diary. Walton had the start of hers before she left her old job.`)),
  q(t(`Social media! Before I started my business and left my previous career as a journalist, I set up an Instagram and Facebook page to get my name out there. The content enabled my followers to get to know me.`)),
  p(t(`She mixed nutrition and exercise posts with an introduction to herself and some lighter, funny content, so people could relate to her.`)),
  q(t(`As a result, when I started my PT career I already had a few clients lined up.`)),

  h2(`Her own space, one day`),
  p(t(`She trains clients in other people's gyms for now, and she is in no hurry to change that.`)),
  q(t(`I would love to open my own space, but perhaps further down the line. For now, I am so happy where I am and the gym venues I work at. It has enabled me to grow my social network and build on my skillset of being a PT by meeting other professionals.`)),

  h2(`The part nobody warns you about`),
  p(t(`Ask any self-employed trainer about the hidden side of the job and the answer is usually the hours. Walton's days bear that out.`)),
  q(t(`Definitely the long hours and very early mornings. Some days I am out of the house from 5.45am and don't get home until 8.30pm.`)),

  h2(`What comes next`),
  p(t(`A year in, she has no grand expansion plan. She simply wants more of the same.`)),
  q(t(`I have worked hard to get to where I am, and loved every minute of it. If I am still this successful in the long term and continue meeting wonderful clients, then I would be very happy. I truly love what I do, and it was the best decision I ever made taking the leap and starting my own business.`)),

  p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
].join("\n");

if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION + BODY)) throw new Error("dash");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
if (SEO_TITLE.length > 60) throw new Error(`seo title ${SEO_TITLE.length} > 60`);
// Every bubble must have our own paragraph or the company card/intro right before it.
const blocks = BODY.split("\n<blockquote");
for (let i = 1; i < blocks.length; i++) if (/<\/blockquote>\s*$/.test(blocks[i - 1]) || /<\/h2>\s*$/.test(blocks[i - 1])) throw new Error(`bubble ${i} has no text before it`);
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

const POST_ARG = (process.argv.find((a) => a.startsWith("--post=")) || "").slice(7);
const existing = wp(`post list --post_type=post --post_status=any --s=Walton --fields=ID --format=csv`).split("\n").slice(1).filter(Boolean);
if (existing.length && !POST_ARG) throw new Error(`a Walton post exists already: ${existing.join(",")} (pass --post=<id>)`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`grace-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
let postId;
if (POST_ARG) {
  postId = Number(POST_ARG);
  if (wp(`post get ${postId} --field=post_status`) !== "draft") throw new Error(`post ${postId} is not a draft`);
  wp(`post update ${postId} /tmp/grace-body-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)}`);
} else {
  postId = Number(wp(
    `post create /tmp/grace-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --porcelain`
  ));
  put(`grace-hero-${stamp}.jpg`, fs.readFileSync(HERO));
  const heroId = wp(`media import /tmp/grace-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${b64("Grace Walton, Grace Walton Fitness")} --alt=${b64(HERO_ALT)} --caption=${b64(HERO_CAPTION)} --porcelain`);
  await forSite(site.id).interviewTarget.update({ where: { id: TARGET_ID }, data: { status: "drafted", headshotUrl: wp(`post get ${heroId} --field=guid`) } });
  console.log(`hero media ${heroId}`);
}
wp(`post meta update ${postId} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
ssh(`rm -f /tmp/grace-body-${stamp}.html /tmp/grace-hero-${stamp}.jpg`);
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`preview: ${GYM}/?p=${postId}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${postId}&action=edit`);
