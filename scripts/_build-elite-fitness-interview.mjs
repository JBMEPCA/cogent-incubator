/**
 * Gym Champions: Stefan White and Kevin Furlong, Elite Fitness (Douglas, Isle
 * of Man). The first Gym Business News interview. Built as a DRAFT, plus a
 * local proof page for JB.
 *
 * JB, 28 Sep 2026: "use this as a gym 7 questions interview, proof to me
 * first". Nothing here publishes and nothing emails Stefan.
 *
 * Source: Stefan's email reply of 28 Sep 2026 to the seven questions, signed
 * "Stefan White (and Kevin Furlong), Owners". Both are named as the voice.
 *
 * Quotes are their own sentences, trimmed but not reworded. Edits: "a more
 * more social space" loses the doubled word, "complimentary services" becomes
 * "complementary", single-quoted phrases become double quotes. The closing
 * "lightly edited for clarity" covers those. Every figure is theirs, except
 * the awards finalist line, which is from our own outreach research.
 *
 * Images: the photo they sent (Kevin left, his name is on his shirt; Stefan
 * right). It is 4:3 and the theme crops heroes to 16:9, so it is cut here with
 * the sign and both heads kept. Logo: the Squarespace header logo from
 * elitefitness.im, a black panel, so NOT trimmed (a trim keyed on the black
 * corner would eat into the red frame).
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-elite-fitness-interview.mjs --photos=<dir with hero.webp, elite-logo.jpg> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir with hero.webp and elite-logo.jpg>");
const HERO_FILE = path.join(PHOTOS, "hero.webp");
const LOGO_FILE = path.join(PHOTOS, "elite-logo.jpg");
const HERO_ALT = "Kevin Furlong and Stefan White, owners of Elite Fitness, in their gym in Douglas";
const HERO_CAPTION = "Kevin Furlong (left) and Stefan White. Picture: supplied";

const GYM = "https://gymbusinessnews.com";
const L = {
  elite: "https://www.elitefitness.im/",
};

const TITLE_TEXT = "Stefan White and Kevin Furlong on the big move";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Elite Fitness lost its lease, then moved into 13,000 square feet in Douglas and became a finalist for North Gym of the Year. Its owners explain how they made the numbers work, why they dropped classes, and what the new cafe is really for.";
const META =
  "Elite Fitness owners Stefan White and Kevin Furlong on moving an independent gym into 13,000 sq ft, dropping classes and adding a cafe.";
const KEYPHRASE = "independent gym";
const SLUG = "gym-champions-stefan-white-and-kevin-furlong-on-the-big-move";
const CATEGORY_ID = 3; // Start & Grow (Gym has no Case Studies category)
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
<h2>Who are Elite Fitness?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Elite Fitness" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>${t(`Elite Fitness is an independent gym in Douglas on the Isle of Man, opened in 2013 by Stefan White and Kevin Furlong. It now runs from a 13,000 square foot home with 24/7 access, a cafe and a social space, and was a finalist for North Gym of the Year at the 2026 National Fitness Awards.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Elite Fitness</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.elite}">elitefitness.im</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Independent gym</dd>
</div>
<div>
<dt>Based</dt>
<dd>Douglas, Isle of Man</dd>
</div>
</dl>
</section>`,

    p(t(`Stefan White and Kevin Furlong opened <a href="${L.elite}">Elite Fitness</a> in 2013 in a 6,000 square foot unit in Douglas. A decade later their landlord told them the building was coming down, so they went looking for somewhere bigger and ended up with more than twice the space. The gym has since been named a finalist for North Gym of the Year at the 2026 National Fitness Awards. They answered our questions together.`)),

    h2(`Making 13,000 square feet stack up`),
    p(t(`The move was forced on them. Their lease ran to 2025, and in 2022 the landlord said it would not be renewed because the building and four neighbouring units were due for redevelopment.`)),
    q(t(`The move came more out of necessity, but the opportunity allowed us to take everything we had learned about running a gym over the previous 10 years and create something we knew was needed on the island. It was a leap of faith and a huge financial risk for us both as a business and personally, but we were confident that our reputation as a gym and our gym community was only ever limited by the amount of members we could fit in a 6,000 square foot gym.`)),
    p(t(`They could not buy the new unit themselves, by mortgage or with an angel investor. One of their own members bought it and leased it to them, and they had to write a business plan to justify the risk. The worst case they planned for was flat membership.`)),
    q(t(`We could still afford the rent but not our staffing costs. That would mean we had to staff the gym ourselves as owners, something we had done for years when starting out, so we knew the sacrifice was possible and worthwhile in the long run.`)),
    p(t(`They did not expect it to come to that. The new site has more than double the floor space, four times the parking, room for the 15 machines they already had in storage, and 24/7 access.`)),

    h2(`Why there are no classes`),
    p(t(`When Elite opened it had a studio, rented to independent instructors who ran pay-as-you-go classes. Folding classes into the membership fee never made sense to them.`)),
    q(t(`Instructor insurance (and space) usually restricts class sizes to 20 which meant if we had included classes as part of the membership then the vast majority would be paying for them but never be able to use them. We want every member to get fair and equal value from their membership.`)),
    p(t(`The studio was used for two or three hours of a 15 hour day, which did not justify the rent on the floor space. After a couple of years it closed, and became reception and more gym floor. They say members rarely ask for classes now.`)),
    q(t(`We find that most people are either gym people or class people, so we focus on giving the best experience we can to the gym people and allow others to cater for the class lovers.`)),
    p(t(`On the island, they add, instructors tend to hire church halls or run their own studios, which is cheaper than carrying a full gym's overheads.`)),

    h2(`Competing in a small market`),
    p(t(`The Isle of Man is too small for the big chains, and the owners see that as the advantage.`)),
    q(t(`We are never under threat from large corporate chain gyms as we simply don't have the population to meet their operating minimums. This has allowed us as independent gym owners to be more flexible and specific for our island's needs and not just box tick what gym users should expect.`)),
    q(t(`As a small island community the gym owners all know each other personally and it has always been about what we can offer our members holistically rather than competing against each other. Every gym on the island offers something different, whether that is location, facilities, equipment or service, and members gravitate to the gym that meets their needs the most.`)),

    h2(`From mostly men to an even split`),
    p(t(`Elite's membership has moved from mostly male to roughly half and half. They did not change the gym to make that happen. They put it down to social media.`)),
    q(t(`What used to be all about arms and chest for the male gym goer has increasingly become about glutes and hams for the female users. This social shift has taken away the old stigma about gyms and the male ego and made them into a much more shared space.`)),
    p(t(`They are candid that the motive is not always health.`)),
    q(t(`That is not necessarily to say it is always a good thing, but we would say that 80% of members use the gym to look better rather than (and often to the detriment of) being fitter or healthier.`)),
    p(t(`They also point to people drinking less, which has made the gym a place to meet like-minded people, and to a clear rise in female members after lockdown.`)),

    h2(`The cafe is revenue and retention`),
    p(t(`In the old building every bit of social space was eventually given over to equipment. The chat just moved onto the gym floor.`)),
    q(t(`We could see that although this proved popular with members, all the social interaction then took place on the gym floor, often with people stood or sat chatting for most of their "workout". We knew that this social aspect of the gym was important, both to the members individually but also the gym community as a whole.`)),
    p(t(`The new layout set aside a large social area, and the front glazing now reads Physical, Mental, Social and Therapy. The rented coffee machine went, and the whole team took barista training.`)),
    q(t(`We all got our qualifications together to make a decent coffee, even if half of us don't actually like the stuff! This was an extra revenue stream, but also gave members a reason to stay and attract people in from the street or neighbouring businesses. We knew secondary spend was an important part of being a successful business.`)),

    h2(`The part nobody warns you about`),
    q(t(`The least glamorous part of running a gym comes from the best part about running a gym, the people! While 99% of members love what we offer and respect us and each other, unfortunately there is always the odd one or two that selfishly ruin it for others. The toilet habits of some people, whether that's from a high protein diet, have caused us some rubber gloved moments over the years and not always where you would expect!`)),

    h2(`What comes next`),
    p(t(`The gym's motto is "Continuous Improvement", and the owners are already looking past the new building.`)),
    q(t(`With our new home now secure and successful we are looking at options to expand. Whether this is a new additional location on the island, another gym for overflow capacity closer by, adding additional complementary services off site or even how we go larger than 13,000 square foot in the future!`)),
    p(t(`Nearer term, they are improving the service for out-of-hours members next month, and new Atlantis equipment ordered from Canada is due in early 2027.`)),

    p(t(`<em>Gym Champions profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

// Logo: black panel, already tight. Resize only.
const logoBuf = await sharp(LOGO_FILE).resize({ height: 160, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
console.log(`logo ${logoMeta.width}x${logoMeta.height}`);

// Hero: 4:3 cut to 16:9, starting near the top so the sign and both heads stay.
const src = await sharp(HERO_FILE).rotate().metadata();
const heroH = Math.round((src.width * 9) / 16);
const heroTop = Math.min(Math.round(src.height * 0.08), src.height - heroH);
const hero = await sharp(HERO_FILE).rotate().extract({ left: 0, top: heroTop, width: src.width, height: heroH }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
console.log(`hero ${src.width}x${src.height} -> ${src.width}x${heroH} from y=${heroTop}`);

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
  const out = path.join(PHOTOS, "elite-fitness-proof.html");
  fs.writeFileSync(out, proof);
  console.log(`proof: ${out}`);
  process.exit(0);
}

// Live draft path: not run until JB approves the proof.
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
  .filter((r) => /Stefan White|Elite Fitness/i.test(r.post_title));
if (existing.length) throw new Error(`a piece for Elite Fitness already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`elite-logo-${stamp}.png`, logoBuf);
put(`elite-hero-${stamp}.jpg`, hero);
const imp = (file, title, alt, caption) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --caption=${sq(caption)} --porcelain`);
const logoId = imp(`elite-logo-${stamp}.png`, "Elite Fitness logo", "Elite Fitness", "Picture: supplied");
const heroId = imp(`elite-hero-${stamp}.jpg`, "Kevin Furlong and Stefan White, Elite Fitness", HERO_ALT, HERO_CAPTION);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logoMeta.width, logoH: logoMeta.height });
put(`elite-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/elite-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/elite-logo-${stamp}.png /tmp/elite-hero-${stamp}.jpg /tmp/elite-body-${stamp}.html`);

// Lock the row so the hourly sweep does not draft a second version of its own.
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "elitefitness.im" } });
await db.interviewTarget.update({ where: { id: target.id }, data: { status: "drafted", headshotUrl: url(heroId), error: null } });
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}`);
console.log(`preview: ${GYM}/?p=${postId}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${postId}&action=edit`);
