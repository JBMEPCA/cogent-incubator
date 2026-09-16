/**
 * SME Leaders: Dr Mark Williams OBE, LIMB-art. Built as a DRAFT on Smart SME.
 *
 * JB, 16 Sep 2026: "just draft for now please". Nothing here publishes and
 * nothing emails Mark.
 *
 * Source: Mark's reply of 16 Sep 2026 14:25 to "Seven questions for Limb-art".
 * The row was locked to "drafted" before the hourly sweep read the reply, so
 * the auto-drafter will not make a second copy.
 *
 * Photos. He sent five and said full length shots suit them better. Used: the
 * studio full-length of Mark with Rachael as the lead, framed onto a landscape
 * canvas so the homepage and social crops do not cut them off at the knees,
 * and, at JB's request on 16 Sep, the investiture photo with the Princess Royal
 * beside the OBE section. That photo arrived as a Facebook screenshot with no
 * photographer credit; it was first held back for that reason and JB chose to
 * use it. It replaced the solo studio full-length. Not used: an HSBC advert (a
 * bank's marketing creative, not ours to republish).
 *
 * Quotes are his own sentences, selected and kept in his order. The only edits
 * are punctuation: spaced dashes become commas, under the house rule.
 *
 * Titles are written with the franchise eyebrow span, so anything printing the
 * title as text must strip it. See the memory note on title markup leaks.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-mark-williams-interview.mjs --photos=<dir> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir with LIMB_ART_1914-(1).jpg, LIMB_ART_1999.jpg, mark-email.json>");
const DUO_FILE = path.join(PHOTOS, "LIMB_ART_1914-(1).jpg"); // Mark and Rachael, full length, 2561x3840
// JB chose this over the solo studio shot. It arrived as a Facebook screenshot
// with no interface in frame; the photographer is not credited.
const ROYAL_FILE = path.join(PHOTOS, "Screenshot_20260609_164902_Facebook.jpg"); // 1079x1352

const ROYAL_ALT = "Dr Mark Williams OBE showing his LIMB-art prosthetic leg cover to the Princess Royal at his investiture";

const SME = "https://smartsme.co.uk";
const L = {
  limbart: "https://limb-art.com/",
  martyn: `${SME}/sme-leaders-martyn-barklett-judge-on-proving-it-to-the-vets/`,
  ceMarking: `${SME}/ce-marking-stays-legal-in-britain-what-small-manufacturers-must-check-across-20-product-types/`,
};

const TITLE_TEXT = "Mark Williams on the leg nobody should hide";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Dr Mark Williams OBE turned a cover he made for his own prosthetic leg into LIMB-art, a King's Award winning manufacturer in rural North Wales that now supplies through the NHS and exports worldwide. He explains what the OBE changed, running a company with his wife, and the most expensive mistake he made.";
const META =
  "Dr Mark Williams OBE of LIMB-art on prosthetic legs people want to show off, building from North Wales, and the costly mistake of chasing perfection.";
const KEYPHRASE = "prosthetic leg covers";
const SLUG = "sme-leaders-mark-williams-on-the-leg-nobody-should-hide";

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((p) => `<p>${p}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
// A real wp:image block, not bare HTML, or core never loads the image styles
// and the photo renders at native size. Portraits held to 480px.
const figure = (src, alt) =>
  `<!-- wp:image {"width":"480px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n<figure class="wp-block-image aligncenter size-full is-resized"><img src="${src}" alt="${alt}" style="width:480px"/></figure>\n<!-- /wp:image -->`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");

function buildBody({ logoUrl, logoW, logoH, royalUrl }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are LIMB-art?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="LIMB-art" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>${t(`LIMB-art designs and makes covers for prosthetic legs, in standard colours, hydrodipped finishes and custom designs, from rural Conwy in North Wales. Founded by Dr Mark Williams OBE, it won a King's Award for Enterprise for Innovation in 2024, supplies through the NHS and exports internationally.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>LIMB-art Ltd</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.limbart}">limb-art.com</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Prosthetics</dd>
</div>
<div>
<dt>Based</dt>
<dd>Conwy, North Wales</dd>
</div>
</dl>
</section>`,

    p(t(`Most prosthetic legs are designed to disappear. Dr Mark Williams OBE makes them to be noticed, and the idea started with a child in a supermarket.`)),

    q(
      t(`The real lightbulb moment came in a supermarket. I'd made myself a bright green leg cover with flashing LED lights, mainly because I wanted my prosthetic leg to look cool rather than something I needed to hide.`),
      t(`A little child came up to me and said how cool my leg looked. That completely changed the way I thought about it. Prosthetics had traditionally been about trying to make something look as much like a real leg as possible. I suddenly thought: why are we hiding them? Why not make something people actually want to show off?`),
      t(`That was when it stopped being about making something for me and became: could this help other people feel the same way? LIMB-art grew from there.`)
    ),

    p(t(`Williams founded <a href="${L.limbart}">LIMB-art</a> with his wife Rachael. The company won a King's Award for Enterprise for Innovation in 2024, the same award <a href="${L.martyn}">Pet Remedy's Martyn Barklett-Judge told us about</a> this year, and Williams has since been appointed OBE.`)),

    h2(`Building from a village in North Wales`),
    p(t(`LIMB-art designs and manufactures in rural Conwy rather than a city, and Williams is clear about what that costs.`)),
    q(
      t(`There are disadvantages. We're a long way from some of our customers, suppliers and the big centres of the prosthetics industry. If I have a meeting in London, it isn't exactly a quick trip across town. Recruitment can also be harder when you're not sitting in a big manufacturing or technology cluster.`),
      t(`But I wouldn't swap it.`),
      t(`North Wales has given LIMB-art part of its identity. We're designing and manufacturing an innovative product here and exporting it around the world. I actually like proving that you don't have to be in London, Manchester or another major city to build an international business.`),
      t(`And personally, I think the environment helps. I can be dealing with distributors or clinicians around the world and then twenty minutes later I'm back on the farm. It keeps things grounded.`)
    ),

    h2(`What the OBE changed`),
    figure(royalUrl, ROYAL_ALT),
    q(
      t(`Interestingly, I don't think it changed me very much, but it definitely changed how some other people initially perceive me.`),
      t(`An OBE gives you a certain amount of credibility before you've even walked into the room. People who don't know you perhaps take a little more notice of what you've done and what you've got to say.`),
      t(`For LIMB-art that's useful, because we're still a relatively small company challenging much larger businesses in an established industry.`)
    ),
    p(t(`He is wary of leaning on it.`)),
    q(t(`But I never want the letters after my name to be the reason somebody listens to me. The important thing is what we've built, the difference we're making for prosthetic users and whether what I'm saying actually has value.`)),

    h2(`Running a company as a couple`),
    p(t(`Williams and Rachael run LIMB-art together. Asked for the rule that keeps that workable, he had an answer ready.`)),
    q(
      t(`Know your strengths, and stay in your lane!`),
      t(`Rachael and I are very different, which is probably why it works. I'm naturally the one who wants to push things forward, come up with the next idea and say, “Why can't we do this?” Rachael is exceptionally good at making sure the business actually works.`),
      t(`There's obviously overlap, and we disagree like any couple does, but there's enormous trust between us.`),
      t(`The other important thing is remembering that we're husband and wife first. LIMB-art is incredibly important to both of us, but you can't allow every meal, weekend and conversation to turn into a board meeting.`),
      t(`We're not always successful at that bit!`)
    ),

    h2(`Selling into a conservative market`),
    p(t(`Prosthetics sits close to medicine, with the procurement and regulation that comes with it. Small manufacturers already carry a heavy compliance load, as our guide to <a href="${L.ceMarking}">what CE marking still requires across twenty product types</a> sets out. What surprised Williams most was the pace.`)),
    q(
      t(`Probably how conservative it can be.`),
      t(`We're not changing the clinical function of a prosthesis, we're changing how somebody feels about wearing it, but you're still working within a world that quite rightly takes safety, evidence, procurement and regulation extremely seriously.`),
      t(`What surprised me was how long it can take for something genuinely different to become accepted.`),
      t(`The flip side is that once clinicians understand the product and, more importantly, see the reaction from prosthetic users, attitudes can change very quickly. We're now supplying through the NHS and exporting internationally, which would have seemed extraordinary when we started making covers in North Wales.`)
    ),

    h2(`The most expensive mistake`),
    q(
      t(`Trying to get everything perfect before properly testing whether the customer actually cared about it.`),
      t(`I'm an engineer at heart and I can obsess over tiny details. In the early days we spent money and enormous amounts of time developing things that I thought needed to be perfect, only to discover that the customer either didn't notice or valued something completely different.`),
      t(`It taught me a really important lesson: get close to the customer as early as possible.`)
    ),
    p(t(`The best of the range has come from exactly that.`)),
    q(t(`Some of our best product development hasn't come from sitting around a table discussing what amputees might want. It has come from amputees telling us directly.`)),

    h2(`What comes next for LIMB-art`),
    q(
      t(`International growth.`),
      t(`We've proved the product, we've proved the manufacturing process and we've shown that a small company in North Wales can sell into major healthcare systems and export around the world.`),
      t(`The next stage is scale.`),
      t(`That means more countries, more distributors, more clinical partnerships and continuing to improve the product and manufacturing behind it.`)
    ),
    p(t(`Scale brings its own risk, and he names it.`)),
    q(
      t(`But I don't want LIMB-art to become a company that loses sight of why it exists.`),
      t(`The business started because one little child looked at my prosthetic leg and thought it was cool. However big LIMB-art becomes, the mission is still essentially that simple: helping people stop hiding their prosthetic leg and giving them something they can be proud to show off.`),
      t(`Stand Out. Stand Proud.`)
    ),
    p(t(`Few companies can point to the single moment they began. For LIMB-art it was a child in a supermarket, and everything since, from the King's Award to NHS supply and the export push, has been about giving more people that same reaction.`)),

    p(t(`<em>SME Leaders profiles the people building Britain's best small businesses. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

// Their site logo (assets/img/logo.svg) is white-on-transparent for a dark
// header and vanishes on the white card. Recolouring it would be altering their
// mark, so the card uses their own blue roundel, published as the site icon.
async function logoPng() {
  const r = await fetch("https://limb-art.com/wp-content/uploads/2024/05/cropped-LIMB-art_Roundel1_LT5B.png", { headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" } });
  if (!r.ok) throw new Error(`logo fetch ${r.status}`);
  const src = Buffer.from(await r.arrayBuffer());
  const trimmed = await sharp(src).trim({ threshold: 12 }).resize({ width: 240, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 128) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  }
  const lum = n ? sum / n : 255;
  console.log(`logo: ${meta.width}x${meta.height}, mean ink luminance ${lum.toFixed(0)}`);
  if (lum > 200) throw new Error("logo ink is near-white and would disappear on the white company card");
  return { buf: trimmed, width: meta.width, height: meta.height };
}

// A full-length portrait as a landscape lead image: the photo, whole, centred
// on a softened copy of itself. Cropping a full-length shot to 16:9 cuts people
// off at the knees, which is exactly what Mark asked to avoid.
//
// The sides are the photo's own outermost pixel columns stretched outwards, so
// the studio backdrop's vertical gradient and the floor line carry on without a
// seam. A blurred copy of the photo was tried first and left dark, ghostly
// silhouettes either side of the couple.
async function framedHero(file) {
  const W = 1600, H = 1000;
  const fg = await sharp(file).rotate().resize({ height: H }).toBuffer();
  const { width: fw } = await sharp(fg).metadata();
  const pad = Math.ceil((W - fw) / 2);
  const edge = async (left) =>
    sharp(fg)
      .extract({ left: left ? 2 : fw - 4, top: 0, width: 2, height: H })
      .resize(pad, H, { fit: "fill", kernel: "nearest" })
      .toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: "#b8b8bc" } })
    .composite([
      { input: await edge(true), left: 0, top: 0 },
      { input: await edge(false), left: W - pad, top: 0 },
      { input: fg, left: Math.floor((W - fw) / 2), top: 0 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

const logo = await logoPng();
const hero = await framedHero(DUO_FILE);
const royal = await sharp(ROYAL_FILE).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
console.log(`hero ${hero.length} bytes, royal ${royal.length} bytes`);

if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({ logoUrl: data(logo.buf, "image/png"), logoW: logo.width, logoH: logo.height, royalUrl: data(royal, "image/jpeg") });
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const proof = `<title>Proof: ${SEO_TITLE}</title>
<style>
  :root{--brand:#2E3EEE;--ink:#0A0C16;--muted:#5A5E75;--bg:#F4F5FA}
  body{background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,serif;margin:0}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px}
  .note{font:13px/1.5 system-ui,sans-serif;background:#fff7e0;border:1px solid #e8d49a;border-radius:8px;padding:12px 14px;margin-bottom:28px;color:#5a4a12}
  h1{font:700 34px/1.2 system-ui,sans-serif;margin:0 0 14px}.franchise-eyebrow{color:var(--brand)}
  .standfirst{font:19px/1.5 system-ui,sans-serif;color:var(--muted);margin:0 0 20px}
  .hero{width:100%;height:auto;border-radius:6px;display:block;margin-bottom:28px}
  h2{font:700 23px/1.3 system-ui,sans-serif;margin:34px 0 10px}
  .interview-company{background:#fff;border-top:4px solid var(--brand);padding:20px 22px;margin:0 0 28px}
  .interview-company-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
  .interview-company-head h2{margin:0;font-size:21px}
  .interview-company-logo{max-width:200px;max-height:48px;width:auto;height:auto;object-fit:contain}
  .interview-company dl{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 0;font:14px system-ui,sans-serif}
  .interview-company dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.interview-company dd{margin:0}
  .interview-quote{background:#fff;border-left:3px solid var(--brand);border-radius:14px;margin:18px 0;padding:14px 20px;box-shadow:0 6px 18px rgba(46,62,238,.08)}
  .interview-quote p{margin:.4em 0}
  figure{margin:22px auto;text-align:center}figure img{max-width:100%;height:auto;border-radius:6px}
  a{color:var(--brand)}
</style>
<div class="wrap">
  <div class="note"><strong>Proof, draft only.</strong> Local preview approximating Smart SME. About ${words} words. Every quote is Mark's own sentences; the only edits are dashes changed to commas.</div>
  <h1>${TITLE}</h1>
  <p class="standfirst">${EXCERPT}</p>
  <img class="hero" src="${data(hero, "image/jpeg")}" alt="Dr Mark Williams OBE and Rachael of LIMB-art">
  ${body}
</div>`;
  const out = path.join(PHOTOS, "mark-williams-proof.html");
  fs.writeFileSync(out, proof);
  fs.writeFileSync(path.join(PHOTOS, "mark-hero-preview.jpg"), hero);
  console.log(`DRY RUN: ~${words} words, dashes in body: ${/[—–]/.test(body)}\nproof: ${out}`);
  process.exit(0);
}

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

// One piece per person. Matched on title, not a body search, which also finds
// news stories that merely mention him.
const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`))
  .filter((r) => /SME Leaders/i.test(r.post_title) && /Mark Williams/i.test(r.post_title));
if (existing.length) throw new Error(`an SME Leaders piece for Mark Williams already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`limbart-logo-${stamp}.png`, logo.buf);
put(`mark-hero-${stamp}.jpg`, hero);
put(`mark-royal-${stamp}.jpg`, royal);
const imp = (file, title, alt) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --porcelain`);
const logoId = imp(`limbart-logo-${stamp}.png`, "LIMB-art logo", "LIMB-art");
const heroId = imp(`mark-hero-${stamp}.jpg`, "Dr Mark Williams OBE and Rachael, LIMB-art", "Dr Mark Williams OBE and Rachael of LIMB-art, each holding a prosthetic leg cover");
const royalId = imp(`mark-royal-${stamp}.jpg`, "Dr Mark Williams OBE at his investiture", ROYAL_ALT);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logo.width, logoH: logo.height, royalUrl: url(royalId) });
put(`mark-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/mark-body-${stamp}.html --post_type=post --post_status=draft --post_category=8 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/limbart-logo-${stamp}.png /tmp/mark-hero-${stamp}.jpg /tmp/mark-royal-${stamp}.jpg /tmp/mark-body-${stamp}.html`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "limb-art.com" } });
await db.interviewTarget.update({ where: { id: target.id }, data: { status: "drafted", headshotUrl: url(heroId) } });
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`image block: ${wp(`eval 'echo has_block("core/image", ${postId}) ? "yes" : "no";'`)}`);
console.log(`media: logo ${logoId}, hero ${heroId}, royal ${royalId}`);
console.log(`preview: ${SME}/?p=${postId}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${postId}&action=edit`);
