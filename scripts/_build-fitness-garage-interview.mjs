/**
 * Gym Champions: Andy Gardner, Fitness Garage (Harrogate). The second Gym
 * Business News interview. Built as a DRAFT, plus a local proof page for JB.
 *
 * JB, 28 Sep 2026: "can you make this one next, preview first". Nothing here
 * publishes and nothing emails Andy.
 *
 * Source: Andy's email reply of 28 Sep 2026 14:15 UK to the seven questions,
 * with headshots of himself and his co-founder Steve Henwood. Andy is the
 * voice; Steve is named but not quoted.
 *
 * Quotes are his own sentences, trimmed but not reworded. Edits:
 * "repsonsibilities" spelling, "one to one" and "off peak" hyphenated, mixed
 * curly and straight quote marks made consistent. The closing "lightly edited
 * for clarity" covers those. Every figure is his, except the awards finalist
 * line, which is from the Your Harrogate report our outreach cited.
 *
 * Images: two square black-and-white headshots, told apart by the site's own
 * files (Andy-Gardner.jpg is the zip jacket, Steve-Henwood.jpg the t-shirt).
 * The theme crops heroes to 16:9, so they are set side by side on one 16:9
 * canvas, Andy on the left. Logo: schema.org logo from the site, trimmed.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-fitness-garage-interview.mjs --photos=<dir with andy.jpg, steve.jpg, fg-logo.png> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir with andy.jpg, steve.jpg and fg-logo.png>");
const ANDY_FILE = path.join(PHOTOS, "andy.jpg");
const STEVE_FILE = path.join(PHOTOS, "steve.jpg");
const LOGO_FILE = path.join(PHOTOS, "fg-logo.png");
const HERO_ALT = "Andy Gardner and Steve Henwood, co-founders of Fitness Garage in Harrogate";
const HERO_CAPTION = "Andy Gardner (left) and Steve Henwood. Pictures: supplied";

const GYM = "https://gymbusinessnews.com";
const L = {
  fg: "https://www.fitnessgarageharrogate.co.uk/",
  hub: `${GYM}/gym-champions/`,
};

const TITLE_TEXT = "Andy Gardner on renting the gym by the hour";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Fitness Garage in Harrogate sells no memberships. Personal trainers book a station by the hour and keep their own clients. Co-founder Andy Gardner explains how the model came out of lockdown, how he plans cash flow around other people's diaries, and why he is happy when a trainer outgrows him.";
const META =
  "Fitness Garage co-founder Andy Gardner on renting PT space by the hour, planning cash flow and what makes a personal trainer's business last.";
const KEYPHRASE = "PT space rental";
const SLUG = "gym-champions-andy-gardner-on-renting-the-gym-by-the-hour";
const CATEGORY_ID = 3; // Start & Grow, as the first Gym Champions piece
const AUTHOR_ID = 2; // james-burke

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");

function buildBody({ logoUrl, logoW, logoH }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Fitness Garage?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Fitness Garage" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>${t(`Fitness Garage is a private training gym in Harrogate run by Andy Gardner and Steve Henwood. It sells no memberships: independent personal trainers book their own PT station by the hour and bring their own clients. It is a finalist for Gym Innovation of the Year at the 2026 National Fitness Awards.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Fitness Garage</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.fg}">fitnessgarageharrogate.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>PT gym rental</dd>
</div>
<div>
<dt>Based</dt>
<dd>Harrogate, North Yorkshire</dd>
</div>
</dl>
</section>`,

    p(t(`<a href="${L.fg}">Fitness Garage</a> is a gym with no members. Personal trainers rent space by the hour, bring their own clients and keep them, and more than 70 have worked there since Andy Gardner and Steve Henwood joined forces in 2017. The model has taken the Harrogate gym to the final of Gym Innovation of the Year at the 2026 National Fitness Awards. Gardner explains how it works.`)),

    h2(`A model borrowed from retail`),
    p(t(`For its first four years the Garage had five or six trainers on fixed monthly agreements.`)),
    q(t(`It worked, but we realised it was limiting for both the trainers and us.`)),
    p(t(`The first lockdown gave them the time and, with government support and a Bounce Back Loan, the money to start again. The idea came from one of Gardner's own clients, who worked in concession-based retail.`)),
    q(t(`We created individual PT stations, each with its own rig and core equipment, alongside shared access to less frequently used kit. Trainers could then simply book and pay for the hours they needed, with peak and off-peak rates.`)),
    q(t(`Having enough variety of equipment was crucial. We wanted the space to work for lots of different trainers and training styles rather than designing it around one particular way of delivering PT.`)),

    h2(`Happy to be outgrown`),
    p(t(`The trainers keep their own clients, so what stops a good one leaving? Gardner's answer is short.`)),
    q(t(`Nothing, really, and we don't want to restrict a trainer's growth.`)),
    p(t(`Some trainers use the Garage occasionally and others run almost their whole business from it. The busiest get client enquiries passed to them, and discounts kick in at 30, 60 and 90 hours a month so the rent stays competitive as they grow. One trainer recently left after eight years, having moved into small group PT and needed his own space.`)),
    q(t(`We knew that might happen and saw it as a positive. Eight years is a pretty good client lifetime!`), t(`If somebody outgrows us, we'd rather celebrate that, promote what they've achieved and find the next trainer who wants to build their business with us.`)),

    h2(`Cash flow from other people's diaries`),
    p(t(`Hourly booking means income moves with trainers' diaries. After six years of close tracking, Gardner says it has become surprisingly predictable.`)),
    q(t(`We allocate budgets for marketing, repairs, improvements and new equipment, while keeping a cash reserve for unexpected expenditure. Our accountant also prepares our accounts very early, so there are no nasty surprises later in the year.`)),
    p(t(`Costs are paid monthly wherever possible, rather than left to build into large annual bills.`)),
    q(t(`It's actually quite a nice business to monitor and run. There are always small fluctuations from month to month, but once you've collected enough historical data, you understand the patterns, set your annual goals and plan around them.`)),

    h2(`What makes a trainer's business last`),
    p(t(`Of the 70-plus trainers who have come through, the ones who build a real business tend to keep the same clients for years.`)),
    q(t(`The trainers who continue learning, attend regular CPD, try new ideas and keep their service fresh tend to build very loyal client bases.`)),
    q(t(`There is room for lots of different approaches to one-to-one PT, but professionalism matters. Trainers who confidently make sensible price increases, maintain professional relationships and enforce cancellation policies tend to avoid many of the frustrations that can make PT difficult, particularly last minute cancellations and constant changes to session times.`)),
    p(t(`The Garage backs them up with clear booking and cancellation rules that trainers can point clients to.`)),

    h2(`Two founders, quick decisions`),
    q(t(`Steve and I joining forces in 2017 has probably been the best professional partnership I've had. Hopefully he agrees!`)),
    p(t(`They barely knew each other at the start. Henwood's background as a professional handyman saved a lot on labour while they fitted out what was then a fairly basic space, and Gardner took the systems and admin.`)),
    q(t(`Despite being quite different, we've developed an ability to anticipate what the other will think, which makes decisions surprisingly quick. We always say a "yes" or a "no" is always better than a "maybe"!`)),
    p(t(`He counts the choice of booking software among their most important decisions.`)),
    q(t(`We were fortunate that we could build the business around the software rather than trying to force software around an established model.`)),
    p(t(`The result is a gym neither founder needs to be in every day: the systems watch most things, and the trainers say quickly when something needs attention.`)),

    h2(`The part nobody warns you about`),
    q(t(`Even though we now have two cleaning teams, Steve and I still occasionally end up cleaning a toilet. If something isn't right, you can't just leave it!`)),
    p(t(`The other is tidying. The Garage runs a "home for everything" rule so it is obvious where each piece of kit belongs, and new trainers pick up that the standard is shared.`)),
    q(t(`Sometimes running a gym is much less about exciting new equipment and much more about noticing that something isn't where it should be and putting it back!`)),

    h2(`What comes next`),
    p(t(`After nearly ten years, Gardner says they are spending less time building and more on marketing, the website and bringing good client enquiries to their trainers. They are always looking for the next trainer to fit into the schedule.`)),
    q(t(`You think you know everyone but it surprises us that brilliant trainers keep getting in touch, even in a town the size of Harrogate.`)),
    p(t(`Both founders have other businesses and jobs, and neither wants a chain of sites to manage. What does interest them is the model itself.`)),
    q(t(`What would interest us is helping other trainers or gym owners develop their own version of the Fitness Garage model, whether that's creating a dedicated facility or converting part of an existing gym into flexible PT space for local independent trainers.`)),

    p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

const logoBuf = await sharp(LOGO_FILE).trim({ threshold: 12 }).resize({ height: 240, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
console.log(`logo ${logoMeta.width}x${logoMeta.height}`);

// Hero: both squares at 900px, 50px shaved off each outer edge, side by side = 1600x900 (16:9).
const half = async (file, left) => sharp(file).rotate().resize(900, 900).extract({ left, top: 0, width: 800, height: 900 }).toBuffer();
const hero = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#000" } })
  .composite([{ input: await half(ANDY_FILE, 50), left: 0, top: 0 }, { input: await half(STEVE_FILE, 50), left: 800, top: 0 }])
  .jpeg({ quality: 88, mozjpeg: true }).toBuffer();
console.log("hero 1600x900, Andy left, Steve right");

if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({ logoUrl: data(logoBuf, "image/png"), logoW: logoMeta.width, logoH: logoMeta.height });
  const plain = body.replace(/<[^>]+>/g, " ").replace(/&#8217;/g, "'").replace(/\s+/g, " ");
  console.log(`DRY RUN: ~${plain.split(" ").length} words, dashes in body: ${/[—–]/.test(body)}`);
  const proof = `<meta charset="utf-8"><title>Proof: ${TITLE_TEXT}</title>
<style>
body{font:17px/1.6 Georgia,serif;color:#1d2326;background:#f6f5f2;margin:0}
main{max-width:760px;margin:0 auto;padding:32px 20px 80px;background:#fff}
.meta{font:13px/1.4 Arial,sans-serif;color:#555;background:#fff8e6;border:1px solid #f0d98a;padding:12px 14px;margin-bottom:28px}
.meta b{color:#B91C1C}
h1{font:700 34px/1.2 Arial,sans-serif;margin:8px 0 12px}
.franchise-eyebrow{display:block;font:700 13px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B91C1C;margin-bottom:10px}
.excerpt{font:19px/1.5 Arial,sans-serif;color:#444;margin:0 0 20px}
.hero{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;margin:0}
.cap{font:13px Arial,sans-serif;color:#666;margin:6px 0 28px}
h2{font:700 23px/1.3 Arial,sans-serif;color:#1d2326;margin:34px 0 10px}
.interview-company{border:1px solid #dde3e6;border-left:4px solid #B91C1C;padding:18px 20px;margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px}
.interview-company-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
.interview-company-head h2{margin:0;font-size:18px}
.interview-company-logo{max-height:44px;width:auto}
.interview-company dl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px;margin:12px 0 0}
.interview-company dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#777}
.interview-company dd{margin:0;font-weight:600}
blockquote{margin:18px 0;padding:4px 0 4px 20px;border-left:4px solid #B91C1C;font-style:italic;color:#243034}
a{color:#B91C1C}
</style>
<main>
<div class="meta"><b>PROOF, not published.</b> WordPress title: ${SEO_TITLE} (${SEO_TITLE.length} chars) &middot; URL: /${SLUG}/ &middot; Meta (${META.length}): ${META} &middot; Keyphrase: ${KEYPHRASE}</div>
<h1><span class="franchise-eyebrow">🏋️ Gym Champions</span>${TITLE_TEXT}</h1>
<p class="excerpt">${EXCERPT}</p>
<img class="hero" src="${data(hero, "image/jpeg")}" alt="${HERO_ALT}">
<p class="cap">${HERO_CAPTION}</p>
${body}
</main>`;
  const out = path.join(PHOTOS, "fitness-garage-proof.html");
  fs.writeFileSync(out, proof);
  fs.writeFileSync(path.join(PHOTOS, "hero-check.jpg"), await sharp(hero).resize(700).jpeg().toBuffer());
  console.log(`proof: ${out}`);
  process.exit(0);
}

// Live draft path.
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=400 --fields=ID,post_title --format=json`))
  .filter((r) => /Andy Gardner|Fitness Garage/i.test(r.post_title));
if (existing.length) throw new Error(`a piece for Fitness Garage already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`fg-logo-${stamp}.png`, logoBuf);
put(`fg-hero-${stamp}.jpg`, hero);
const imp = (file, title, alt, caption) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --caption=${sq(caption)} --porcelain`);
const logoId = imp(`fg-logo-${stamp}.png`, "Fitness Garage logo", "Fitness Garage", "Picture: supplied");
const heroId = imp(`fg-hero-${stamp}.jpg`, "Andy Gardner and Steve Henwood, Fitness Garage", HERO_ALT, HERO_CAPTION);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logoMeta.width, logoH: logoMeta.height });
put(`fg-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/fg-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/fg-logo-${stamp}.png /tmp/fg-hero-${stamp}.jpg /tmp/fg-body-${stamp}.html`);

// Row already locked to "drafted" at 14:25 so the sweep would not draft its own.
const db = forSite(site.id);
await db.interviewTarget.update({ where: { id: "cmukzywwp002592os4splqmkl" }, data: { status: "drafted", headshotUrl: url(heroId), error: null } });
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}`);
console.log(`preview: ${GYM}/?p=${postId}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${postId}&action=edit`);
