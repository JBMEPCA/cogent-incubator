/**
 * Gym Champions: Hannah Carter and Josh, Carter's Gym (North Walsham). The
 * third Gym Business News interview. JB, 8 Oct 2026: "can you proof me this".
 *
 * Hannah asked twice (29 Sep and 7 Oct) for the piece to be about BOTH owners:
 * "we are joint owners. The gym just shares my surname." The hourly sweep had
 * already drafted post 134 from her 7 Oct 14:23 UK answers as a Hannah-led
 * Q&A, filed under an engine-made "Case Studies" category. This REWRITES 134
 * in place (title, slug, body, excerpt, category, image) rather than making a
 * second post, so the interview row's articleId stays valid.
 *
 * Josh's surname is not known: not in her emails, not on cartersgym.com, and
 * his name badge says only "Josh, Owner". The headline names neither owner
 * for that reason; swap JOSH_SURNAME in and the title when it arrives.
 *
 * She answered five of seven: Weights for Women capacity and the Josh split
 * were skipped. Quotes are hers, trimmed not reworded. The awards line and
 * the 85 members are from our outreach research and her own answer.
 *
 * Images: her photo (1500x2000 portrait), cut to 4:3 with both heads in the
 * upper third. Josh is on the left (his badge reads JOSH). Logo from the site.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-carters-gym-interview.mjs --photos=<dir with hero.jpg, logo.png> [--dry | --draft]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const DRAFT = process.argv.includes("--draft");
if (!DRY && !DRAFT) throw new Error("--dry or --draft");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir>");
const POST_ID = 134;
const TARGET_ID = "cmukzyx1r002f92os4dxnj1hp";

const JOSH = "Josh"; // surname unknown, see header
const HERO_ALT = "Josh and Hannah Carter, joint owners of Carter's Gym, on their gym floor in North Walsham";
const HERO_CAPTION = `${JOSH} (left) and Hannah Carter. Picture: supplied`;

const GYM = "https://gymbusinessnews.com";
const L = { site: "https://cartersgym.com/", hub: `${GYM}/gym-champions/` };

const TITLE_TEXT = "Carter's Gym owners on making weights feel welcoming";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "Hannah Carter and Josh opened a weights gym in North Walsham, signed 85 members within weeks and are award finalists in their first year. They explain how they built it around what puts people off strength training, and what 70 hour weeks cost away from the gym.";
const META =
  "Carter's Gym owners Hannah Carter and Josh on opening a weights gym in North Walsham, women's only sessions and 70 hour weeks.";
const KEYPHRASE = "weights gym";
const SLUG = "gym-champions-carters-gym-owners-on-making-weights-feel-welcoming";
const CATEGORY_ID = 3; // Start & Grow, like the first two

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const qp = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote interview-quote--pull">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");

function buildBody({ logoUrl, logoW, logoH }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Carter's Gym?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Carter's Gym" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>${t(`Carter's Gym is an independent strength gym in North Walsham, Norfolk, opened in 2025 and run by joint owners Hannah Carter and ${JOSH}. It runs women's only weights sessions and menopause sessions alongside general membership, and is a Newcomer of the Year finalist at the 2026 National Fitness Awards.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Carter's Gym</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">cartersgym.com</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Independent strength gym</dd>
</div>
<div>
<dt>Based</dt>
<dd>North Walsham, Norfolk</dd>
</div>
</dl>
</section>`,

    p(t(`Hannah Carter and ${JOSH} opened <a href="${L.site}">Carter's Gym</a> in North Walsham in 2025, signed 85 members within weeks, and are now a Newcomer of the Year finalist at the 2026 National Fitness Awards, having already won a Rising Stars award at Inspire North Norfolk 2026. They own it jointly. As Hannah puts it, the gym just shares her surname. She answered our questions for both of them.`)),

    h2(`Built around what puts people off`),
    p(t(`North Walsham already had two leisure facilities. The owners thought it lacked something more personal and built on strength, so before opening they asked people in and around the town what put them off weight training.`)),
    q(t(`We spoke to people in the town and surrounding areas about what might put them off strength training, so we could base our business off the needs of the community. That's why we run women's only weights sessions, menopause sessions and make sure we are always on hand to give free support and advice.`)),
    p(t(`The latest idea is the Carter's QR codes, placed around the gym.`)),
    q(t(`We are constantly thinking of ways to try and make people feel more comfortable in a gym environment, for example, we have started Carter's QR codes which take you to a video of Josh and I setting up and talking you through a piece of equipment or exercise.`)),

    h2(`Where the first 85 came from`),
    p(t(`The early members were not hard to place, she says: they were either unhappy where they trained or had never been to a gym at all.`)),
    q(t(`Many liked our inclusive ethos, so we got a good amount of interest from the beginning. We have members travel from various areas of North Norfolk.`)),

    h2(`Plan for the worst`),
    p(t(`They used council mentoring and a digital grant early on. Asked for the single most useful piece of advice, Hannah gives it in five words.`)),
    q(
      t(`Plan for the worst case scenario! Opening Carter's was a scary move for us. Although we knew we were hard workers and had thorough plans of what we wanted to do with a gym, we weren't sure if we would actually get a good response.`),
      t(`So we had to expect a slow take up and have tough conversations on whether we should set up the business or not.`)
    ),
    p(t(`The slow start they prepared for did not come.`)),

    h2(`Seventy hours a week`),
    p(t(`Both owners work about 70 hours a week, and have done for 15 months. A day runs from classes and PT sessions to inductions, cleaning and admin. The harder part, she says, is the time off.`)),
    q(t(`It is the hours when we are not at work that can be the hardest. Trying to make conversation that is not about the gym or find the energy to do house chores. It is very tricky to still see friends, family and maintain a relationship, but luckily most people are very supportive of what we are doing!`)),

    h2(`What comes next`),
    p(t(`They are not saying yet what is planned.`)),
    q(t(`We've got so much planned for Carter's! We're going to keep our cards close to our chest at the moment, but changes are definitely coming soon. We have a clear vision for what we want to achieve, but our main goal is to keep listening to our members and the North Walsham community and act on what they need.`)),

    p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

const logoBuf = await sharp(path.join(PHOTOS, "logo.png")).trim({ threshold: 12 }).resize({ height: 240, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
// 1500x2000 portrait -> 1500x1125 (4:3) from y=300, heads in the upper third.
const hero = await sharp(path.join(PHOTOS, "hero.jpg")).rotate().extract({ left: 0, top: 300, width: 1500, height: 1125 }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
console.log(`logo ${logoMeta.width}x${logoMeta.height} | hero 1500x1125`);

if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({ logoUrl: data(logoBuf, "image/png"), logoW: logoMeta.width, logoH: logoMeta.height });
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
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
.interview-company-logo{max-height:56px;width:auto}
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
  const out = path.join(PHOTOS, "carters-gym-proof.html");
  fs.writeFileSync(out, proof);
  console.log(`proof: ${out}`);
  process.exit(0);
}

// --draft: rewrite post 134 in place, still a draft.
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

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, not draft; not touching it`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`carters-logo-${stamp}.png`, logoBuf);
put(`carters-hero-${stamp}.jpg`, hero);
const imp = (file, title, alt, caption) => wp(`media import /tmp/${file} --post_id=${POST_ID} --title=${b64(title)} --alt=${b64(alt)} --caption=${b64(caption)} --porcelain`);
const BODY_ONLY = process.argv.includes("--body-only");
const logoId = BODY_ONLY ? "138" : imp(`carters-logo-${stamp}.png`, "Carter's Gym logo", "Carter's Gym", "Picture: supplied");
const heroId = BODY_ONLY ? wp(`post meta get ${POST_ID} _thumbnail_id`) : imp(`carters-hero-${stamp}.jpg`, "Josh and Hannah Carter, Carter's Gym", HERO_ALT, HERO_CAPTION);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logoMeta.width, logoH: logoMeta.height });
put(`carters-body-${stamp}.html`, Buffer.from(body, "utf8"));

wp(`post update ${POST_ID} /tmp/carters-body-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --post_category=${CATEGORY_ID} --post_author=2`);
wp(`post meta update ${POST_ID} _thumbnail_id ${heroId}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
ssh(`rm -f /tmp/carters-logo-${stamp}.png /tmp/carters-hero-${stamp}.jpg /tmp/carters-body-${stamp}.html`);

const db = forSite(site.id);
const target = await db.interviewTarget.findUnique({ where: { id: TARGET_ID } });
if (target.articleId) await db.article.update({ where: { id: target.articleId }, data: { title: SEO_TITLE, body, keyphrase: KEYPHRASE, metaDesc: META, category: "Start & Grow" } });
await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { headshotUrl: url(heroId) } });
await prisma.$disconnect();

console.log(wp(`post get ${POST_ID} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}`);
console.log(`preview: ${GYM}/?p=${POST_ID}&preview=true`);
