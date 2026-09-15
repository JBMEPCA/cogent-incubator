/**
 * In the Chair: Rob Wood, Novo Cabelo. Built as a DRAFT on Barbering Business.
 *
 * Source: Rob's email of 15 Sep 2026 09:27, "7 Questions -Rob Wood", sent from
 * rob@novocabelo.co.uk as a new message rather than a reply to the thread we
 * started with support@. The sweep matches replies on our own subject line, so
 * it never saw this one and the row stayed "questioned". Photos are the two he
 * attached, both from the same studio shoot.
 *
 * Format copied from the live Karl Foster piece (post 456), which is the
 * Barbering reference JB asked for, with one deliberate difference: no internal
 * link sits inside a quote. Karl's live piece has had links written into his
 * blockquotes after publication, which puts words in the subject's mouth.
 *
 * Quote edits against the email, all minimal and all listed for JB to approve:
 *   Q2  cut "Following doesn't mean you're doing something wrong." (unclear)
 *   Q4  "Just focus of being proud" -> "Just focus on being proud"
 *   Q5  "don't set up to fail" -> "don't set yourself up to fail"
 *   Q6  "Stay consist to" -> "Stay consistent to"
 *   Q7  "make hair systems to norm" -> "make hair systems the norm"
 * Everything else is punctuation only.
 *
 * Nothing here emails Rob. The row is moved to "drafted", which the sweep
 * neither reads replies for nor sends a backlink ask from.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-rob-wood-interview.mjs --photos=<dir> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir containing IMG_3739.jpeg and IMG_3736-4.jpeg>");
const HERO_FILE = path.join(PHOTOS, "IMG_3739.jpeg"); // landscape 1280x853
const PORTRAIT_FILE = path.join(PHOTOS, "IMG_3736-4.jpeg"); // portrait 905x1280

const SITE = "https://barberingbusiness.com";
const L = {
  awards: "https://modernbarber.co.uk/modern-barber-awards-2025-winners",
  novo: "https://novocabelo.co.uk/",
  booking: `${SITE}/barbershop-booking-system-an-independent-uk-buyers-guide/`,
  reviews: `${SITE}/best-google-review-management-tools-for-uk-barbershops/`,
  hairloss: `${SITE}/hair-loss-awareness-month-glowwa-tells-stylists-to-back-every-cut-with-a-12-week-supplement-plan/`,
  menspire: `${SITE}/three-top-barbers-launch-mentored-by-menspire-one-membership-weekly-mentoring-sessions/`,
  // Our own news story on Novo Cabelo's non-shave system, 28 Aug 2026, post 84.
  trueblend: `${SITE}/novo-cabelo-launches-trueblend-non-shave-hair-replacement-what-it-costs-a-shop-to-offer/`,
};

// ---------- copy ----------------------------------------------------------------
const TITLE_TEXT = "Rob Wood on the posts that fill chairs";
const TITLE = `<span class="franchise-eyebrow">🪑 In the Chair:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `In the Chair: ${TITLE_TEXT}`;
const EXCERPT =
  "Rob Wood won Best Social Barber at the Modern Barber Awards and runs Novo Cabelo, a hair systems business in County Durham. He explains which posts actually bring clients in, how much time it really takes, and why chasing the algorithm is a game you lose.";
const META =
  "Rob Wood won Best Social Barber at the Modern Barber Awards. He explains which posts fill a chair, what it takes and why chasing the algorithm loses.";
const KEYPHRASE = "barber social media";

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((p) => `<p>${p}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const figure = (src, alt, size = "large") =>
  `<figure class="wp-block-image size-${size}"><img src="${src}" alt="${alt}" loading="lazy" decoding="async"></figure>`;

function buildBody({ logoUrl, logoW, logoH, portraitUrl }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Novo Cabelo?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Novo Cabelo" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>A hair replacement specialist founded by Rob Wood, fitting hair systems for people with hair loss across the UK and training stylists, salons and barbers to offer the service themselves. The name means &#8220;new hair&#8221; in Portuguese, and the business supports Little Lady Locks and the Katie Piper Foundation.</p>
<dl>
<div>
<dt>Website</dt>
<dd><a href="${L.novo}">novocabelo.co.uk</a></dd>
</div>
<div>
<dt>Based</dt>
<dd>Murton, County Durham</dd>
</div>
</dl>
</section>`,

    p(`Most barbers treat social media as a noticeboard: post the cut, hope for likes, move on. Rob Wood treats his phone as a tool of the trade, and it won him Best Social Barber at the <a href="${L.awards}">Modern Barber Awards 2025</a>.`),

    q(`My phone is just as important as my scissors and comb, to be honest. From booking in appointments to showing my work on social media, it&#8217;s a tool I couldn&#8217;t do without. People connect with people, so it&#8217;s a great way to display your skills and get your personality across.`),

    p(`Wood is the founder and creative director of <a href="${L.novo}">Novo Cabelo</a>, which fits hair systems for clients with hair loss and trains stylists and barbers to deliver the service. We covered its <a href="${L.trueblend}">TrueBlend non-shave system and what it costs a shop to offer</a> last month, and it is a specialism worth understanding for any shop whose clients worry about thinning, as <a href="${L.hairloss}">our Hair Loss Awareness Month coverage</a> explored. It is work built on trust, which may be why he talks about social media less as advertising and more as a way of letting people meet you before they sit down. For most shops the phone now carries a large part of the front of house, from the feed to the <a href="${L.booking}">booking system</a>.`),

    h2(`Why most posting gets nothing back`),
    p(`Plenty of barbers post every day and see nothing come of it. Wood does not accept that they are doing it wrong, and he reframes what the audience is actually there for.`),
    q(`You&#8217;re not doing it wrong if you&#8217;re proud of the work and/or message you put out. People consume social media differently now&#8230; they want to know what your day looks like. They want helpful tips to style their hair. Always think quality over quantity.`),

    h2(`What actually fills a chair`),
    p(`Likes are easy to count and hard to bank. Asked what kind of post turns into a booking, Wood points away from the haircut itself.`),
    q(`Real connections, conversations and a smile off your client. The styling isn&#8217;t always the important part. We all need to relate to connect with the content.`),

    h2(`Opinions come with the territory`),
    p(`Being visible means being judged, in the comments and in the <a href="${L.reviews}">Google reviews</a> that sit beside every listing. Wood&#8217;s answer is not to take it personally.`),
    q(`Online is just an extension of your business&#8230; it&#8217;s not personal. You can never please everyone, and everyone has opinions. You do, right? Just focus on being proud of your work and content; that is what&#8217;s important.`),

    h2(`How much time it really takes`),
    p(`The usual objection to social media is time, in a shop where an hour on the phone is an hour off the chair. Wood&#8217;s advice is to start smaller than you think and build from there.`),
    q(`Firstly, don&#8217;t set yourself up to fail. Set yourself a goal that&#8217;s achievable. Put a client-focussed video out at least once a week and refine it. Once done, double it! Otherwise, use your stories option for testing, talking to followers and day-to-day content.`),

    h2(`Building on ground that keeps moving`),
    p(`Every year the platforms change what they reward, and every year a new trick promises to beat the change. Wood&#8217;s view of that race is blunt.`),
    q(`Stay consistent to what you love doing. Don&#8217;t try to chase the algorithm, &#8217;cause you&#8217;ll lose. People will always respond to good, honest and educational content.`),

    h2(`Where Novo Cabelo goes from here`),
    figure(portraitUrl, "Rob Wood, founder and creative director of Novo Cabelo, photographed in the studio", "full"),
    q(`Our mission has always been to make hair systems the norm within our industry, and for people with hair loss to fully understand the power of them. Putting positive, heartwarming and educational content out there is our goal.`),

    p(`Hair systems are still a specialist service that most shops never offer. Wood wants to change that, and the same principle runs through all of his advice on social media: show the work honestly, explain it well, and the right clients will find their way to the chair.`),

    p(`<em>In the Chair profiles the people running Britain&#8217;s barbershops and grooming businesses. Answers have been lightly edited for spelling and clarity.</em>`),
  ].join("\n");
}

// ---------- checks -------------------------------------------------------------
const plainTitle = SEO_TITLE;
if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("em or en dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${plainTitle.length} chars | meta: ${META.length} chars`);

// ---------- images -------------------------------------------------------------
async function logoPng() {
  const src = "https://novocabelo.co.uk/wp-content/uploads/2023/06/cropped-Novo-Cabelo-Logo-Transparent_BOW-Long-Strap-scaled-1.webp";
  const r = await fetch(src, { headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" } });
  if (!r.ok) throw new Error(`logo fetch ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  // Trim transparent padding, then cap the width so the card is not shipping a
  // 2560px file to render at 132px.
  const trimmed = await sharp(buf).trim({ threshold: 12 }).resize({ width: 800, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  // Guard against the white-on-transparent variant, which vanishes on the card.
  const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 128) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  }
  const lum = n ? sum / n : 255;
  console.log(`logo: ${meta.width}x${meta.height}, mean ink luminance ${lum.toFixed(0)} (0 dark, 255 white)`);
  if (lum > 200) throw new Error("logo ink is near-white and would disappear on the white company card");
  return { buf: trimmed, width: meta.width, height: meta.height };
}

const logo = await logoPng();
const hero = fs.readFileSync(HERO_FILE);
const portrait = fs.readFileSync(PORTRAIT_FILE);

// ---------- dry run: a standalone proof ---------------------------------------
if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({
    logoUrl: data(logo.buf, "image/png"),
    logoW: logo.width,
    logoH: logo.height,
    portraitUrl: data(portrait, "image/jpeg"),
  });
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const proof = `<title>Proof: ${SEO_TITLE}</title>
<style>
  :root{--brand:#8a3b1e;--ink:#15161a;--muted:#5b5e66;--line:#e4e1dc;--bg:#faf8f5}
  body{background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,"Times New Roman",serif;margin:0}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px}
  .note{font:13px/1.5 system-ui,sans-serif;background:#fff7e0;border:1px solid #e8d49a;border-radius:8px;padding:12px 14px;margin-bottom:28px;color:#5a4a12}
  .note ol{margin:6px 0 0 18px;padding:0}
  h1{font:700 34px/1.2 system-ui,sans-serif;margin:0 0 14px}
  .franchise-eyebrow{color:var(--brand)}
  .standfirst{font:19px/1.5 system-ui,sans-serif;color:var(--muted);margin:0 0 20px}
  .hero{width:100%;height:auto;border-radius:6px;display:block;margin-bottom:28px}
  h2{font:700 23px/1.3 system-ui,sans-serif;margin:34px 0 10px}
  .interview-company{background:#fff;border-top:4px solid var(--brand);padding:20px 22px;margin:0 0 28px}
  .interview-company-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
  .interview-company-head h2{margin:0;font-size:21px}
  .interview-company-logo{max-width:200px;max-height:48px;width:auto;height:auto;object-fit:contain}
  .interview-company dl{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 0;font:14px system-ui,sans-serif}
  .interview-company dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .interview-company dd{margin:0;overflow-wrap:anywhere}
  .interview-quote{background:#fff;border-left:3px solid var(--brand);border-radius:14px;margin:18px 0;padding:14px 20px;box-shadow:0 1px 2px color-mix(in srgb,var(--brand) 12%,transparent),0 6px 18px color-mix(in srgb,var(--brand) 8%,transparent)}
  .interview-quote p{margin:.4em 0}
  figure{margin:22px 0}figure img{max-width:100%;height:auto;border-radius:6px;display:block}
  a{color:var(--brand)}
</style>
<div class="wrap">
  <div class="note"><strong>Proof, not published.</strong> This is a local preview styled to approximate the site. The real draft is in WordPress. About ${words} words. Quote edits to approve:
    <ol>
      <li>Q2: cut “Following doesn’t mean you’re doing something wrong.” (unclear as written)</li>
      <li>Q4: “focus of being proud” → “focus on being proud”</li>
      <li>Q5: “don’t set up to fail” → “don’t set yourself up to fail”</li>
      <li>Q6: “Stay consist to” → “Stay consistent to”</li>
      <li>Q7: “make hair systems to norm” → “make hair systems the norm”</li>
    </ol>
  </div>
  <h1>${TITLE}</h1>
  <p class="standfirst">${EXCERPT}</p>
  <img class="hero" src="${data(hero, "image/jpeg")}" alt="Rob Wood, founder and creative director of Novo Cabelo">
  ${body}
</div>`;
  const out = path.join(PHOTOS, "rob-wood-proof.html");
  fs.writeFileSync(out, proof);
  console.log(`DRY RUN: ~${words} words, dashes in body: ${/[—–]/.test(body)}\nproof: ${out}`);
  process.exit(0);
}

// ---------- write it, over SSH -------------------------------------------------
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

// Refuse to make a second interview. Matched on the title, not a body search:
// post 84 is a published news story that quotes Rob, and a search for his name
// finds it and would block the interview forever.
const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=200 --fields=ID,post_title --format=json`))
  .filter((r) => /In the Chair/i.test(r.post_title) && /Rob Wood/i.test(r.post_title));
if (existing.length) throw new Error(`an In the Chair piece for Rob Wood already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`novo-cabelo-logo-${stamp}.png`, logo.buf);
put(`rob-wood-hero-${stamp}.jpg`, hero);
put(`rob-wood-portrait-${stamp}.jpg`, portrait);

const imp = (file, title, alt) =>
  wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --porcelain`);
const logoId = imp(`novo-cabelo-logo-${stamp}.png`, "Novo Cabelo logo", "Novo Cabelo");
const heroId = imp(`rob-wood-hero-${stamp}.jpg`, "Rob Wood, Novo Cabelo", "Rob Wood, founder and creative director of Novo Cabelo");
const portraitId = imp(`rob-wood-portrait-${stamp}.jpg`, "Rob Wood, Novo Cabelo (portrait)", "Rob Wood, founder and creative director of Novo Cabelo, photographed in the studio");
const url = (id) => wp(`post get ${id} --field=guid`);
const logoUrl = url(logoId);
const portraitUrl = url(portraitId);
const heroUrl = url(heroId);

const body = buildBody({ logoUrl, logoW: logo.width, logoH: logo.height, portraitUrl });
put(`rob-wood-body-${stamp}.html`, Buffer.from(body, "utf8"));

// Category 4 is Marketing & Clients, which fits a piece about social media
// better than Karl's Business & Money.
const postId = wp(
  `post create /tmp/rob-wood-body-${stamp}.html --post_type=post --post_status=draft --post_category=4 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/novo-cabelo-logo-${stamp}.png /tmp/rob-wood-hero-${stamp}.jpg /tmp/rob-wood-portrait-${stamp}.jpg /tmp/rob-wood-body-${stamp}.html`);

// Record the answers and move the row out of the sweep's reach. "drafted" is
// neither a state it reads replies for nor one it sends a backlink ask from.
const email = JSON.parse(fs.readFileSync(path.join(PHOTOS, "rob-email.json"), "utf8"));
const target = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, personName: "Rob Wood" } });
await prisma.interviewTarget.update({
  where: { id: target.id },
  data: { status: "drafted", answeredAt: new Date(email.date), replyBody: email.body, headshotUrl: heroUrl },
});
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}, portrait ${portraitId}`);
console.log(`preview: ${SITE}/?p=${postId}&preview=true`);
console.log(`edit:    ${SITE}/wp-admin/post.php?post=${postId}&action=edit`);
