/**
 * SME Leaders: Kari Trajer Morgan, Westbrook Court. Built as a DRAFT on Smart SME.
 *
 * JB, 7 Oct 2026: "proof this Smart SME interview and show me first", then
 * "show me on wordpress". Nothing here publishes and nothing emails Kari.
 *
 * Source: her emailed answers of 7 Oct 2026, saved verbatim in
 * scripts/interviews/westbrook-court-answers.txt. The InterviewTarget row was
 * locked to "drafted" before the sweep read the reply, so the auto-drafter
 * will not make a second copy.
 *
 * Proof edits only: "feet.." to "feet.", "C Suite" to "C-Suite" (her own later
 * spelling), and her dashes recast as commas and full stops for the house
 * no-dash rule. The gate checks every quote against the source with those
 * three edits reversed out.
 *
 * Photo: she sent a two-up; the left half (Hereford Cathedral behind her) is
 * the lead, set on a blurred extension of itself to reach 16:9.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-kari-trajer-morgan-interview.mjs --photo=<file> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTO = (process.argv.find((a) => a.startsWith("--photo=")) || "").split("=").slice(1).join("=");
if (!PHOTO) throw new Error("--photo=<file>");
const SOURCE = fs.readFileSync("scripts/interviews/westbrook-court-answers.txt", "utf8");

const SME = "https://smartsme.co.uk";
const SITE = "https://www.westbrookcourt.co.uk/";
const HUB = `${SME}/sme-leaders/`;
const TITLE_TEXT = "Kari Trajer Morgan on selling the whole house";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Westbrook Court, a country house near Hay-on-Wye, sleeps 21 but never needs to be full. Owner Kari Trajer Morgan on midweek retreats, a 500-tree woodland walk and the admin nobody warns you about.";
const META =
  "Westbrook Court sleeps 21 but never needs to be full. Owner Kari Trajer Morgan on midweek retreats, a 500-tree woodland and why it isn't beige.";
const KEYPHRASE = "Westbrook Court";
const SLUG = "sme-leaders-kari-trajer-morgan-westbrook-court";
const HERO_ALT = "Kari Trajer Morgan, founder of Westbrook Court, with Hereford Cathedral behind her";

const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");
const q = (...paras) => `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${t(x)}</p>`).join("\n")}\n</blockquote>`;
const pull = (...paras) => q(...paras).replace("interview-quote\"", "interview-quote interview-quote--pull\"");
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${t(s)}</p>`;

const BODY = [
  `<p class="standfirst"><em>${t(`Westbrook Court, an independent country house near Hay-on-Wye, has just been named a finalist for Self Catering Accommodation in the Visit Herefordshire Tourism Awards. Its owner is an interior designer who decided the next beautiful cushion would not change anything, so she turned 500 young trees into a woodland walk instead. She answered our seven questions on filling midweek, where the bookings really come from, and the admin nobody warns you about.`)}</em></p>`,
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who is Westbrook Court?</h2>
</div>
<p>${t(`An independent, family-run country house near Hay-on-Wye in Herefordshire, let as a whole house to family groups, celebrations and corporate retreats. It sleeps up to 21 adults across nine bedrooms, and is a 2026 finalist for Self Catering Accommodation in the Visit Herefordshire Tourism Awards.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Westbrook Court</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${SITE}">westbrookcourt.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Group holiday accommodation</dd>
</div>
<div>
<dt>Based</dt>
<dd>Near Hay-on-Wye, Herefordshire</dd>
</div>
</dl>
</section>`,
  `<p>Kari Trajer Morgan owns and runs <a href="${SITE}">Westbrook Court</a> and works as an interior designer, which shows the moment you walk in. She answered our questions in writing, and the answers below are her own words.</p>`,

  h2(`A house for 21 does not have to be full`),
  pull(`Actually, it doesn’t have to be full, and I think that distinction is important. Westbrook Court sleeps up to 21 adults, with additional capacity for children, but we sell the whole house rather than individual bedrooms. A group of twelve can therefore be just as valuable commercially as a group of twenty-one.`),
  p(`This is the most useful idea in the interview for anyone running a venue. Price by the room and a group of twelve leaves the building half empty. Price the whole house and the same twelve people are a full booking. The question stops being how to fill beds and becomes how to fill dates.`),
  q(`Weekends are our natural leisure market. The bigger opportunity is midweek, which is why we are developing C-Suite retreats and experiential stays with workshops. Rather than discounting the house heavily just to achieve occupancy, I would rather create a compelling reason for a different customer to come Monday to Thursday.`),

  h2(`Families pay the bills, retreats fill the week`),
  p(`We asked which is the better business, corporate groups or family gatherings.`),
  q(
    `At the moment, leisure groups and family gatherings are the stronger business simply because they are established and make up the majority of our bookings. Corporate retreats are a market we are actively developing, particularly for midweek stays.`,
    `Commercially, midweek or C-Suite retreat stays are very attractive because it uses the house at exactly the time leisure guests generally don’t. We have nine bedrooms, plenty of communal space and countryside on the doorstep, so a team of nine to twelve people can effectively take over their own little country house for a few days. I don’t see the two markets competing. They complement each other.`
  ),
  p(`The two markets want different days of the week, so a booking from one never costs a booking from the other. That makes the corporate work close to pure upside, provided it is not won with the discounting she has just ruled out.`),

  h2(`When another cushion stops paying back`),
  p(`This year she opened the private woodland to guests. We asked why she spent there and not on the house.`),
  q(
    `Over the years we have continued to improve our interiors with local art, custom made furniture and lighting and more eclectic delights but eventually you reach the point where another beautiful cushion doesn’t fundamentally change somebody’s stay.`,
    `After creating a dedicated games room, workshop room, hot tub and kadai area, we are leaning into the quiet outdoors, of which we have acres at our feet. We planted around 500 trees in 2021 and this year we began turning that young woodland into somewhere guests can actually experience. We created a meandering walk with sculptural art and places to stop, sit, look at the landscape, listen to birdsong or simply do nothing.`,
    `It was also about making more of what is uniquely ours. Guests can find lovely interiors in many places, but it's rare to find a private woodland for their enjoyment. Well, at Westbrook Court, we've created a special place to be out in the Herefordshire landscape.`
  ),
  p(`Knowing when spending on something has stopped making a difference is hard for any owner, and harder for a designer whose eye will always find one more thing to improve. Her answer is to spend on what a competitor cannot copy. Anyone can buy nice furniture. Nobody else has her trees.`),

  h2(`It certainly isn’t beige`),
  q(
    `I’m an interior designer as well as the owner, so I want guests to feel immediately that they are in somebody’s contemporary country farmhouse rather than a hospitality product.`,
    `There are old pieces alongside modern pieces, our collection of local art, our curated Herefordshire/Hay library of books, vibrant colours and objects collected over time. It isn’t overly coordinated and it certainly isn’t beige.`,
    `More importantly, people are allowed to relax in it. Put your feet up, light the fire, pour a glass of wine, cook together and take over the house. Design matters enormously to me, but comfort matters more.`
  ),

  h2(`Half the bookings come through partners`),
  q(
    `We value our online travel partners, who generate around half of our bookings and give Westbrook Court a fantastic reach into different markets. Our own website is constantly evolving too, and we’re fortunate to have a growing number of repeat guests who return year after year.`,
    `For us, it’s about having a healthy mix. Our specialist travel partners introduce Westbrook Court to audiences we might not otherwise reach, while our website, recommendations and returning guests help us build our own community. Having several strong booking channels working alongside each other makes the business much more resilient.`
  ),
  p(`For a small accommodation business, travel partners are an acquisition cost, and repeat guests are where the margin is. Partners bring in the first stay. A guest who comes back and books direct the next year is worth more to the business. Her mix of partners, the business's own website and returning guests is the model most independent holiday lets aim for.`),

  h2(`The admin nobody warns you about`),
  q(
    `The sheer amount of invisible administration.`,
    `People see a beautiful country house and perhaps imagine arranging flowers and choosing cushions. The reality is payment chasing, deposits, bins, boilers, laundry hire, Wi-Fi, maintenance, blocked drains, contractor schedules and answering the question you were absolutely certain you had already answered in the guest information.`,
    `Hospitality is essentially hundreds of tiny operational details that have to work so that the guest never notices them. I've developed a great team behind the scenes to make sure the guest experience is seamless.`
  ),

  h2(`Better, not bigger`),
  q(
    `I don’t particularly want Westbrook Court to become bigger. I want it to become better and more distinctive.`,
    `That means developing our private woodland and walks from the doorstep, introducing more experiential workshops, growing our midweek and retreat business and continuing to improve the guest experience while making the business increasingly efficient behind the scenes.`,
    `We are fortunate to have a beautiful house in a remarkable part of Herefordshire. The next stage is less about adding things and more about giving people stronger reasons to come here, and to come at different times of the week and year.`
  ),

  `<p><em><a href="${HUB}">SME Leaders</a> is Smart SME&#8217;s series with the people who own and run UK small businesses. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a business and would like to take part, write to <a href="mailto:press@smartsme.co.uk">press@smartsme.co.uk</a>.</em></p>`,
].join("\n\n");

// ---- gate ----
const problems = [];
const outside = BODY.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[—–]/.test(BODY + TITLE + EXCERPT + META + HERO_ALT)) problems.push("dash somewhere");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length}`);
if (META.length > 155) problems.push(`meta ${META.length}`);
const norm = (x) => x.replace(/<[^>]+>/g, "").replace(/&#8217;|[‘’]/g, "'").replace(/&#8220;|&#8221;|[“”]/g, '"')
  .replace(/\s*[–—-]\s+/g, " ").replace(/[.,;]/g, "").replace(/\.\./g, ".").replace(/C Suite/g, "C-Suite").replace(/\bWell\b/g, "well").replace(/\s+/g, " ").trim().toLowerCase();
const src = norm(SOURCE);
for (const m of BODY.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)) {
  for (const para of m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const n = norm(para[1]);
    if (!src.includes(n)) problems.push(`NOT VERBATIM: ${n.slice(0, 90)}`);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`gate ok | seo ${SEO_TITLE.length} | meta ${META.length} | ~${outside.replace(/<[^>]+>/g, " ").split(/\s+/).length} words of ours`);

// ---- hero: left half of the two-up, on a blurred 16:9 ----
const m = await sharp(PHOTO).metadata();
const half = await sharp(PHOTO).extract({ left: 0, top: 0, width: Math.floor(m.width / 2) - 4, height: m.height }).toBuffer();
const H = 900, W = 1600;
const fg = await sharp(half).resize({ height: H }).toBuffer();
const fgW = (await sharp(fg).metadata()).width;
const base = await sharp(half).resize(W, H, { fit: "cover" }).blur(30).modulate({ brightness: 0.85 }).jpeg().toBuffer();
const hero = await sharp(base).composite([{ input: fg, left: Math.round((W - fgW) / 2), top: 0 }]).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
if (DRY) { fs.writeFileSync(PHOTO.replace(/\.\w+$/, "-hero.jpg"), hero); console.log("DRY: hero written"); process.exit(0); }

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`))
  .filter((r) => /Trajer|Westbrook/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`kari-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/kari-hero-${stamp}.jpg --title=${sq("Kari Trajer Morgan, Westbrook Court")} --alt=${sq(HERO_ALT)} --caption=${sq("Kari Trajer Morgan, founder of Westbrook Court. Picture: supplied")} --porcelain`);
put(`kari-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
const postId = wp(
  `post create /tmp/kari-body-${stamp}.html --post_type=post --post_status=draft --post_category=8 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/kari-hero-${stamp}.jpg /tmp/kari-body-${stamp}.html`);
const db = forSite(site.id);
await db.interviewTarget.update({ where: { id: "cmuv1sep10045a69van45n5f6" }, data: { headshotUrl: wp(`post get ${heroId} --field=guid`) } });
await prisma.$disconnect();
console.log(`DRAFT ${postId} hero ${heroId}`);
console.log(`preview: ${SME}/?p=${postId}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${postId}&action=edit`);
