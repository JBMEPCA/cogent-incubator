/**
 * SME Leaders: Molly Edgecombe, Strategy Studio. Built as a DRAFT on Smart SME.
 *
 * JB, 23 Oct 2026: "put me a proof together please on WP". Nothing here
 * publishes and nothing emails Molly.
 *
 * Source: her emailed answers of 23 Oct 2026 10:46 UK (sent from the
 * team@strategy-studio.co.uk mailbox, which shows as Nick Patrozos), saved
 * verbatim in scripts/interviews/strategy-studio-answers.txt. The
 * InterviewTarget row was locked to "drafted" first so the sweep cannot draft
 * a second copy. No proof edits needed; every quote is word for word.
 *
 * Her answer to question four undercuts the question: "nothing was broken",
 * the 1,409% came from emailing a dormant list of 11,000. The piece says so
 * plainly rather than repeating the percentage as a result.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-molly-edgecombe-interview.mjs --photo=<file> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTO = (process.argv.find((a) => a.startsWith("--photo=")) || "").split("=").slice(1).join("=");
if (!PHOTO) throw new Error("--photo=<file>");
const SOURCE = fs.readFileSync("scripts/interviews/strategy-studio-answers.txt", "utf8");

const SME = "https://smartsme.co.uk";
const SITE = "https://strategy-studio.co.uk/";
const HUB = `${SME}/sme-leaders/`;
const TARGET_ID = "cmvjni2lh0001dv0k89edxs0f";
const TITLE_TEXT = "Molly Edgecombe on the email after the post";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Molly Edgecombe watched posts go viral without making a single sale, so she built Strategy Studio around the emails that turn followers into customers. On a £17,853 Christmas, a dormant list of 11,000, and the one flow to set up this week.";
const META =
  "Molly Edgecombe of Strategy Studio on why viral posts do not sell, five Christmas emails that made £17,853, and the welcome flow every owner needs.";
const KEYPHRASE = "email marketing for small business";
const SLUG = "sme-leaders-molly-edgecombe-on-the-email-after-the-post";
const HERO_ALT = "Molly Edgecombe, founder of Strategy Studio, at her desk";
const CAPTION = "Molly Edgecombe, founder of Strategy Studio. Picture: supplied";

const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;").replace(/"([^"]*)"/g, "&#8220;$1&#8221;");
const q = (...paras) => `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${t(x)}</p>`).join("\n")}\n</blockquote>`;
const pull = (...paras) => q(...paras).replace("interview-quote\"", "interview-quote interview-quote--pull\"");
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${t(s)}</p>`;

const BODY = [
  `<p class="standfirst"><em>${t(`Molly Edgecombe spent years inside brands running content, email and customer journeys, and kept watching the same thing happen: posts went viral, followers arrived, and nobody bought. So she built Strategy Studio around what happens after the post. She answered our seven questions on where the sale gets lost, a £17,853 Christmas, and the one email flow a busy owner should set up this week.`)}</em></p>`,
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who is Strategy Studio?</h2>
</div>
<p>${t(`A UK studio led by email marketing, founded by Molly Edgecombe. It builds the email journeys that turn a brand's social media following and website visitors into paying customers, and is launching an email audit service for smaller businesses.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Strategy Studio</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${SITE}">strategy-studio.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Email marketing</dd>
</div>
</dl>
</section>`,
  `<p><a href="${SITE}">Molly Edgecombe</a> answered our questions in writing, and the answers below are her own words. Client examples are anonymised.</p>`,

  h2(`Why email and not more content`),
  q(`Content gets you seen, but it's hard to prove what it's worth. I'd watch posts go viral and bring in followers and likes, and sometimes not a single sale. Email is different. You can see what each send brings in, so the return on investment is clear for an owner who wants more revenue. What really drew me in was taking the visibility a brand already has on social media and turning it into customers. With email we can build journeys for a business's specific customers, so people get the right message at each point in their buying journey, which makes them far more likely to buy. And as a business owner myself, I love being able to sit down with a client and show them exactly how much revenue an email made that month.`),

  h2(`Where the sale gets lost`),
  p(`We asked where it breaks down between someone seeing a post and actually buying.`),
  q(`It breaks down at the nurturing. Most owners put everything into their social media presence and getting eyeballs, but once they've got those eyeballs, there's nothing in place to take someone who has just discovered the business and warm them up to buying. Say a post resonates and someone joins your email list. That's the moment to welcome them, tell them your brand story, introduce your best sellers, and then invite them to shop with an exclusive code or other incentive. Each email moves them a step further, from simply noticing you to becoming a customer. Without that journey, the attention fades and they scroll on.`),
  pull(`The post did its job, but nothing caught them afterwards.`),
  p(`It is the clearest description we have heard of where small business marketing effort goes missing. The time goes into being seen, and the follow-up that turns a passing interest into a sale is the part nobody had time to build.`),

  h2(`Five emails, £17,853`),
  q(`This client is a food business with perishable products, so timing was everything. The five emails launched their Christmas gift boxes alongside their Christmas delivery slots, then kept reminding people what was available and that slots were limited. We also set up an early access waitlist with its own sign-up form, so anyone who joined could book slots a day before everyone else. That built anticipation and rewarded the most engaged customers. Where most owners go wrong is mentioning it once, because they worry about nagging. But when you have a plan and people are joining at different stages, you're not nagging, you're reminding them to buy. Not everyone sees the first email, and plenty who do aren't ready yet.`),
  p(`The fear of nagging is real, and it costs money. An owner who sends one Christmas email is reaching the share of the list that happened to open it that day and was ready to buy that day, which is rarely most of them.`),

  h2(`The list nobody was emailing`),
  p(`Strategy Studio says one client's attributed revenue rose 1,409% in its first month. We asked what had been broken. Her answer was more honest than the number.`),
  q(
    `Honestly, nothing was broken. The owner had good monthly revenue and had been collecting sign-ups on her website for years, but never had the time to do anything with them. She had over 11,000 subscribers who weren't being emailed. Rather than blast everyone at once, we sent a simple "do you still want to hear from us?" email with preference options. Whoever engaged became our priority segment, and campaigns went only to them. That's good inbox practice: it warms the account back up and improves deliverability for every future send. Alongside that, we set up the core automations and optimised her sign-up forms. So it wasn't really a fix, more waking up a list that had been quietly waiting all along.`
  ),
  p(`A percentage rise that large is what you get when email revenue starts from almost nothing, so the figure says more about the starting point than the work. The useful lesson is the starting point itself. Plenty of small businesses have a list of thousands sitting in their website platform that has never been sent a single email, and the re-permission step she describes is the safe way to wake it up without damaging deliverability.`),

  h2(`Is email really driving the sale?`),
  q(`It's a fair question, and one I hear a lot. We judge it by tracking clicks through to sales. Someone may have browsed the site a few days earlier without buying, but the email is what brought them back and got them to check out. So if we send at 6pm and see a wave of sales between 6pm and 8pm, we can trace the URLs those purchases came from back to that email, and that's the revenue we attribute to it. Anything outside those parameters, like sessions from other channels that day, gets reported separately rather than claimed for email. When you can see the links from an email leading directly to the sales, it's a reliable measure of what that email actually did.`),

  h2(`The one flow to set up this week`),
  q(`A welcome flow, 100%. Even before that, I tell every owner to have a sign-up form on their website, even if they have no time to email anyone yet. Data collected today is far more valuable than wishing you'd started a list when you finally want to use one. Then spend a couple of days building a simple welcome flow. The first email thanks people for signing up and delivers an exclusive discount or incentive. The second tells your story and shows off your best sellers. The third reminds them to use the incentive before it runs out. Once it's set up, it runs on its own for every new subscriber, and it's where many of my clients have seen their best results.`),
  p(`Three emails, written once, sent automatically to everyone who signs up from now on. Of everything in this interview, it is the piece of advice a reader can act on before the weekend.`),

  h2(`What comes next`),
  q(`Email, fully. Over the past few years I also helped brands with content, and recently we've worked with bigger, higher-revenue businesses. Now we're bringing that experience to smaller businesses with a new email audit service: a short review of someone's account and a clear plan they can implement themselves, or that we can help with. Right now our focus is making sure every client has a successful Black Friday and Christmas, because Q4 is the biggest time of year for email (and marketing in general!). We're also excited about AI and automation, which sits naturally alongside email. We're working with tools that turn a social media following into an email list through keyword automations, so we can measure how well these new list-building strategies work and stay on top of what's coming next.`),

  `<p><em><a href="${HUB}">SME Leaders</a> is Smart SME&#8217;s series with the people who own and run UK small businesses. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a business and would like to take part, write to <a href="mailto:press@smartsme.co.uk">press@smartsme.co.uk</a>.</em></p>`,
].join("\n\n");

// ---- gate ----
const problems = [];
if (/[—–]/.test(BODY + TITLE + EXCERPT + META + HERO_ALT + CAPTION)) problems.push("dash somewhere");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length}`);
if (META.length > 155) problems.push(`meta ${META.length}`);
const norm = (x) => x.replace(/<[^>]+>/g, "").replace(/&#8217;|[‘’]/g, "'").replace(/&#8220;|&#8221;|[“”]/g, '"').replace(/\s+/g, " ").trim();
const src = norm(SOURCE);
for (const m of BODY.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)) {
  for (const para of m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const n = norm(para[1]);
    if (!src.includes(n)) problems.push(`NOT VERBATIM: ${n.slice(0, 90)}`);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const ours = BODY.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
console.log(`gate ok | seo ${SEO_TITLE.length} | meta ${META.length} | ~${ours} words of ours`);

// ---- hero: a true 16:9 crop of her portrait, head to chest ----
// The supplied shot is 2:3 with a lot of wall above her; a full-width 16:9
// band from just above her hair fills the frame without any blur extension.
const H = 900, W = 1600;
const m = await sharp(PHOTO).rotate().metadata();
const bandH = Math.round((m.width * 9) / 16);
const top = Math.min(m.height - bandH, Math.round(m.height * 0.27));
const hero = await sharp(PHOTO).rotate().extract({ left: 0, top, width: m.width, height: bandH }).resize(W, H).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
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
  .filter((r) => /Edgecombe/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`molly-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/molly-hero-${stamp}.jpg --title=${sq("Molly Edgecombe, Strategy Studio")} --alt=${sq(HERO_ALT)} --caption=${sq(CAPTION)} --porcelain`);
put(`molly-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
const postId = wp(
  `post create /tmp/molly-body-${stamp}.html --post_type=post --post_status=draft --post_category=8 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/molly-hero-${stamp}.jpg /tmp/molly-body-${stamp}.html`);
const db = forSite(site.id);
await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { headshotUrl: wp(`post get ${heroId} --field=guid`) } });
await prisma.$disconnect();
console.log(`DRAFT ${postId} hero ${heroId}`);
console.log(`preview: ${SME}/?p=${postId}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${postId}&action=edit`);
