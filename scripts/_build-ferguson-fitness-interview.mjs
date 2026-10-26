/**
 * Gym Champions: Matty Ferguson, Ferguson Fitness HQ (Hexham). Built as a
 * WordPress DRAFT for JB to preview. JB, 8 Oct 2026: "make a proof then show
 * me first ... always show proofs on wordpress". Nothing publishes, nothing
 * emails Matty.
 *
 * Source: his reply of 7 Oct 18:02 UK (fergusonfitness02@gmail.com), seven
 * numbered answers to the seven questions on the InterviewTarget row, plus one
 * photo. The row was locked to "drafted" at 8 Oct ~08:40 UK before the hourly
 * sweep could draft its own.
 *
 * Quotes are his, trimmed not reworded. Edits: "two much" to "too much", two
 * missing spaces after full stops, curly apostrophes. Figures are his (12,000
 * population, over a quarter of income on rent and rates, under 1km from the
 * A69, three years). The finalist line and July 2023 come from our outreach
 * research (Hexham Courant).
 *
 * No logo: fergusonfitnesshq.co.uk has a text header ("FFHQ") and no logo
 * file, so the company card runs without the image.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-ferguson-fitness-interview.mjs --photos=<dir with hero.jpg>
 */
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir>");
const TARGET_ID = "cmuv1sdfw0025a69v3xzedzjf";
const HERO_ALT = "Matty Ferguson, owner of Ferguson Fitness HQ, in his gym in Hexham";
const HERO_CAPTION = "Matty Ferguson. Picture: supplied";

const GYM = "https://gymbusinessnews.com";
const L = { site: "https://fergusonfitnesshq.co.uk/", hub: `${GYM}/gym-champions/` };

const TITLE_TEXT = "Matty Ferguson on a functional gym in Hexham";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Matty Ferguson opened Ferguson Fitness HQ on an industrial estate in Hexham three years ago and is now an awards finalist. He explains why he cut the opening hours, why rent and rates take over a quarter of his income, and how charity events fill the gym.";
const META =
  "Ferguson Fitness HQ owner Matty Ferguson on running a functional gym in Hexham, cutting opening hours and rent that takes a quarter of income.";
const KEYPHRASE = "functional fitness gym";
const SLUG = "gym-champions-matty-ferguson-on-a-functional-gym-in-hexham";
const CATEGORY_ID = 3; // Start & Grow
const AUTHOR_ID = 2;

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const qp = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote interview-quote--pull">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Ferguson Fitness HQ?</h2>
</div>
<p>${t(`Ferguson Fitness HQ is a functional fitness gym on an industrial estate in Hexham, Northumberland, opened by Matty Ferguson in July 2023. It is an ATHX affiliate, and a finalist for Functional Training Gym of the Year at the 2026 National Fitness Awards.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Ferguson Fitness HQ</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">fergusonfitnesshq.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Functional fitness gym</dd>
</div>
<div>
<dt>Based</dt>
<dd>Hexham, Northumberland</dd>
</div>
</dl>
</section>`,

  p(t(`Matty Ferguson opened <a href="${L.site}">Ferguson Fitness HQ</a> in Hexham in July 2023, in his early twenties. Three years on, the gym is a finalist for Functional Training Gym of the Year at the 2026 National Fitness Awards, in a market town of about 12,000 people where, he says, rent and business rates take more than a quarter of his income.`)),

  h2(`The first mistake: doing everything`),
  p(t(`Asked what he got wrong in the first year, Ferguson does not hesitate.`)),
  q(t(`One of the things as a gym owner I believe went wrong was trying and doing everything. We opened all day every day and had to cut back. This was too much for a small team to manage and we weren't utilizing our time efficiently keeping the gym open in quieter times.`)),
  q(t(`This time was better spent going through cleaning, email follow ups and equipment maintenance which in the long run actually made our service better!`)),

  h2(`A small town with big rent`),
  p(t(`Hexham's size limits how many members a gym can draw. Its popularity pushes the other way, on costs.`)),
  q(t(`With Hexham being recognised as the happiest place to live in England in 2019, demand for property and business premises is high, meaning our rent and business rates are extremely expensive. In fact, over a quarter of our income is spent on these costs.`)),
  p(t(`His answer has been community events. Under the Sport Tynedale name, the gym organises charity events that raise money for local sports clubs and organisations and bring new people through the door.`)),
  q(t(`For us, this is about much more than simply gaining new members. We want Ferguson Fitness HQ to be a genuine hub for the local community, a place where people can train, build relationships and feel part of something.`)),

  h2(`Standing out in a crowded label`),
  p(t(`Functional training is on every gym's sign now. Ferguson reads that as proof of demand rather than a threat.`)),
  q(t(`There is a reason so many gyms have adopted functional training as it works, and it's relevant to almost everyone, regardless of age, ability or fitness level.`)),
  p(t(`What he offers locally is distance saved. He says the gym is the only dedicated functional fitness gym and ATHX affiliate between Carlisle and Newcastle.`)),
  q(t(`We aren't trying to be another functional fitness gym, we are trying to be the place people in our area come to when they want to become stronger, fitter and more capable for everyday life.`)),

  h2(`The first coach was a member`),
  p(t(`Ferguson stopped being the only coach on the floor about six months in, still in the original premises. His first hire came from inside the gym.`)),
  q(t(`Our first coach was actually one of our first ever members, which was a really important decision for us. Having experienced the gym first hand as a member, she already understood the product we delivered, the standards we expected and, most importantly, how we wanted our members to feel when they walked through the door.`)),
  p(t(`The second coach was chosen the same way.`)),

  h2(`Industrial units are not cheap any more`),
  q(t(`Industrial units are often described as a cheaper option, but that isn't necessarily the reality anymore. Commercial and industrial property has become increasingly competitive, particularly since COVID, and finding the right space at the right price has been one of the biggest challenges of growing Ferguson Fitness HQ.`)),
  p(t(`A functional gym needs floor space, high ceilings and storage for rowers, barbells, bumper plates and rigs, and kit and construction costs have both risen. The trade-off is access: the unit is under 1km from the A69 and just over 1km from the town centre, close enough to walk or cycle, with a bus stop at the bottom of the road.`)),

  h2(`Never completely off the clock`),
  q(t(`The least glamorous part of running a gym is realising that you are never completely off the clock and that sometimes, your own fitness has to take a back seat. Since opening Ferguson Fitness HQ three years ago, my own training and fitness have actually decreased.`)),
  p(t(`He has just taken his first holiday abroad since opening, made possible by the team, though he says the business never fully switches off.`)),
  q(t(`There is a huge amount of work behind the scenes that members never see managing staff, dealing with suppliers, maintaining equipment, finances, marketing, programming, cleaning, customer service and constantly thinking about what needs to happen next.`)),

  h2(`What comes next`),
  q(t(`Our ambition for Ferguson Fitness HQ is simple: we want to become the benchmark for functional fitness in our region. We don't want to grow just for the sake of being bigger. We want to grow sustainably, protect the culture we have built and continue delivering the level of coaching and member experience that got us here in the first place.`)),

  p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
].join("\n");

if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION + BODY)) throw new Error("dash");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
if (SEO_TITLE.length > 60) throw new Error(`seo title ${SEO_TITLE.length} > 60`);
const words = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
console.log(`seo title ${SEO_TITLE.length} | meta ${META.length} | ~${words} words`);

// 1333x2000 portrait -> 4:3 from y=330, head in the upper third.
const src = await sharp(path.join(PHOTOS, "hero.jpg")).rotate().metadata();
const hero = await sharp(path.join(PHOTOS, "hero.jpg")).rotate()
  .extract({ left: 0, top: 330, width: src.width, height: Math.round((src.width * 3) / 4) })
  .jpeg({ quality: 88, mozjpeg: true }).toBuffer();

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`ferg-body-${stamp}.html`, Buffer.from(BODY, "utf8"));

// Draft 141 was created 8 Oct; wp post list --name does not find drafts reliably, so look it up by id.
const EXISTING = 141;
let postId = { ID: EXISTING, post_status: wp(`post get ${EXISTING} --field=post_status`) };
if (postId && postId.post_status !== "draft") throw new Error(`post ${postId.ID} is ${postId.post_status}; not touching it`);
const others = wp(`post list --post_type=post --post_status=any --s=Ferguson --fields=ID --format=csv`).split("\n").slice(1).filter(Boolean).filter((id) => Number(id) !== postId?.ID);
if (others.length) throw new Error(`another Ferguson post exists: ${others.join(",")}`);

if (postId) {
  postId = postId.ID;
  wp(`post update ${postId} /tmp/ferg-body-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)}`);
} else {
  postId = Number(wp(
    `post create /tmp/ferg-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --porcelain`
  ));
  put(`ferg-hero-${stamp}.jpg`, hero);
  const heroId = wp(`media import /tmp/ferg-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${b64("Matty Ferguson, Ferguson Fitness HQ")} --alt=${b64(HERO_ALT)} --caption=${b64(HERO_CAPTION)} --porcelain`);
  const db = forSite(site.id);
  await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { status: "drafted", headshotUrl: wp(`post get ${heroId} --field=guid`) } });
  console.log(`hero media ${heroId}`);
}
wp(`post meta update ${postId} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
ssh(`rm -f /tmp/ferg-body-${stamp}.html /tmp/ferg-hero-${stamp}.jpg`);
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`preview: ${GYM}/?p=${postId}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${postId}&action=edit`);
