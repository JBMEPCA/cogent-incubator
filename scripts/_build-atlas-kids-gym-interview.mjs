/**
 * Gym Champions: Ben Hutchings, Atlas Kids Gym (Balham and Clapham). Built as
 * a WordPress DRAFT for JB to preview. JB, 9 Oct 2026: "proof to me first".
 *
 * Sources, all from team@atlaskidsgym.co.uk on 9 Oct 2026: the seven short
 * answers (10:40 UK), then two longer paragraphs on the Atlas Jnr Cup and the
 * Battersea arch plus four photos (10:55 UK), sent after we asked for more.
 * The row was locked to "drafted" at ~10:50 UK so the sweep would not draft.
 *
 * Every quote is his. Punctuation only: "i" capitalised, sentence capitals,
 * "Its" to "It's", "childrens" to "children's", "downsyndrome" to "Down
 * syndrome", and his one dash ("aim for, a real event") recast as a comma for
 * the house no-dash rule. "taking over padelpals" is left out of the HYROX
 * quote rather than guessed at.
 *
 * JB, 9 Oct: no bubble without a line of text before it, and the HYROX
 * section framed positively, so his "It costs me" line is no longer quoted.
 *
 * Every quote is a plain .interview-quote: the Gym child theme (0.3.1) draws
 * them all as speech bubbles. No --pull marks.
 *
 * Photo: the one JB picked (Ben with five squad members in AKG shirts),
 * 1500x2000 cut to 4:3. The children are identifiable; Ben sent the photos
 * with "feel free to use any of the below". Gym has no children rule (Nursery
 * Daily does). No logo: the site's only mark sits inside a promo graphic.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-atlas-kids-gym-interview.mjs --photos=<dir with hero.jpg>
 */
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir>");
const TARGET_ID = "cmukzyx2x002h92os7mdjy9tq";
const HERO_ALT = "Ben Hutchings, founder of Atlas Kids Gym, flexing with five members of the Atlas squad in orange club shirts";
const HERO_CAPTION = "Ben Hutchings with members of the Atlas Kids Gym squad. Picture: supplied";

const GYM = "https://gymbusinessnews.com";
const L = { site: "https://atlaskidsgym.co.uk/", hub: `${GYM}/gym-champions/` };

const TITLE_TEXT = "Ben Hutchings on the business of kids fitness";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Ben Hutchings runs a HYROX-inspired kids fitness club across Balham and Clapham without a building of his own, and is now an awards finalist. He explains who he is really selling to, why he started his own junior cup, and the arch in Battersea he wants next.";
const META =
  "Atlas Kids Gym founder Ben Hutchings on running a kids fitness club in London, selling to parents and children, and his own Atlas Jnr Cup.";
const KEYPHRASE = "kids fitness business";
const SLUG = "gym-champions-ben-hutchings-on-the-business-of-kids-fitness";
const CATEGORY_ID = 3; // Start & Grow
const AUTHOR_ID = 2;

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;");

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Atlas Kids Gym?</h2>
</div>
<p>${t(`Atlas Kids Gym is a HYROX-inspired fitness club for children in south London, running sessions in halls and partner gyms across Balham and Clapham. It was founded by Ben Hutchings, who has worked in education for 20 years, and is a finalist for Gym Innovation of the Year at the 2026 National Fitness Awards.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Atlas Kids Gym</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">atlaskidsgym.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Children's fitness</dd>
</div>
<div>
<dt>Based</dt>
<dd>Balham and Clapham, London</dd>
</div>
</dl>
</section>`,

  p(t(`Ben Hutchings started <a href="${L.site}">Atlas Kids Gym</a> without a building. His HYROX-inspired fitness club for children runs out of halls and partner gyms in Balham and Clapham, and it has already made the final of Gym Innovation of the Year at the 2026 National Fitness Awards. He told us how a kids club makes its money, and where he wants it to go.`)),

  h2(`No building, for now`),
  p(t(`Renting space rather than owning it was a starting point, not a principle. Keeping costs low early on let him prove the idea first.`)),
  q(t(`This is a starting point, currently looking at an arch space in Battersea, as well as continuing current clubs, as we have been efficient with reducing costs at the start to prove the product to keep margins clear.`)),
  p(t(`The arch would be more than extra capacity.`)),
  q(t(`This would give us the ability to increase class capacity and numbers, allowing us to reach more children and connect with the NHS and the Down Syndrome Society to have a hub for SEN children.`)),

  h2(`Two customers at once`),
  p(t(`The child takes the class and the parent pays for it. Hutchings says a kids club has to win both.`)),
  q(t(`It's a multi sale function, which is how kids clubs differentiate from other industries. Educating parents on children's fitness, whilst proving to children that gym is a fun club.`)),

  h2(`Why he built his own cup`),
  p(t(`Atlas is an official HYROX Training Club, and the hybrid race format runs through how the club trains. Hutchings wanted to take that idea further, to children who would never enter an adult-style race, at a price working families can afford. So he started his own competition, the Atlas Jnr Cup, a hybrid circuit championship built for kids.`)),
  q(
    t(`I started the Atlas JNR Cup because I wanted to give kids something bigger to aim for, a real event that makes their training mean something. It's not just about running laps; it's about building confidence, teamwork, and pride in what they achieve.`),
    t(`We have a huge problem in London with obesity and children being below fitness levels for their age, and a lot of the current competitions push out a lot of these children instead of making an event inclusive by design.`)
  ),

  h2(`Keeping children through the holidays`),
  p(t(`Term times and school holidays make kids fitness seasonal. His fix is to give every child something to train for.`)),
  q(t(`Setting goals and events, such as Race for Kids, TRYKA, HYROX, Atlas Cup. Training for something gives them a motive and keeps retention.`)),

  h2(`Hiring coaches for children`),
  p(t(`Coaching children takes more than a qualification, and Hutchings is careful about who he puts in front of a class. His own background helps him spot the right people.`)),
  q(t(`Heavy vetting. I have been in education for 20 years, so I have a great eye for people who come because they love training instead of boosting the bank.`)),

  h2(`The part nobody warns you about`),
  p(t(`Almost every owner in this series has given us some version of the same answer to this question. His is the shortest.`)),
  q(t(`We are all secret cleaners.`)),

  h2(`What comes next`),
  p(t(`The Battersea arch is one step towards a much bigger goal. Hutchings wants Atlas in front of far more children across the capital, and he has put a number and a date on it.`)),
  q(t(`We want to get to 1,000 students by 2029. We want to be the go-to kids gym in London.`)),

  p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
].join("\n");

if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION + BODY)) throw new Error("dash");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
if (SEO_TITLE.length > 60) throw new Error(`seo title ${SEO_TITLE.length} > 60`);
const words = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
console.log(`seo title ${SEO_TITLE.length} | meta ${META.length} | ~${words} words | quotes ${(BODY.match(/interview-quote"/g) || []).length}`);

const hero = await sharp(path.join(PHOTOS, "hero.jpg")).rotate()
  .extract({ left: 0, top: 520, width: 1500, height: 1125 }) // 520 not 640: the article page crops to 16:9 from the centre and took the top of his head (JB, 9 Oct).jpeg({ quality: 88, mozjpeg: true }).toBuffer();

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

const existing = wp(`post list --post_type=post --post_status=any --s=Atlas --fields=ID,post_status --format=csv`).split("\n").slice(1).filter(Boolean);
const POST_ARG = (process.argv.find((a) => a.startsWith("--post=")) || "").slice(7);
if (existing.length && !POST_ARG) throw new Error(`an Atlas post exists already: ${existing.join(" ")} (pass --post=<id> to update it)`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`atlas-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
let postId;
if (POST_ARG) {
  postId = Number(POST_ARG);
  if (wp(`post get ${postId} --field=post_status`) !== "draft") throw new Error(`post ${postId} is not a draft`);
  wp(`post update ${postId} /tmp/atlas-body-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)}`);
} else {
  postId = Number(wp(
    `post create /tmp/atlas-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --porcelain`
  ));
  put(`atlas-hero-${stamp}.jpg`, hero);
  const heroId = wp(`media import /tmp/atlas-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${b64("Ben Hutchings and the Atlas Kids Gym squad")} --alt=${b64(HERO_ALT)} --caption=${b64(HERO_CAPTION)} --porcelain`);
  const db = forSite(site.id);
  await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { status: "drafted", headshotUrl: wp(`post get ${heroId} --field=guid`) } });
  console.log(`hero media ${heroId}`);
}
wp(`post meta update ${postId} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
ssh(`rm -f /tmp/atlas-body-${stamp}.html /tmp/atlas-hero-${stamp}.jpg`);
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`preview: ${GYM}/?p=${postId}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${postId}&action=edit`);
