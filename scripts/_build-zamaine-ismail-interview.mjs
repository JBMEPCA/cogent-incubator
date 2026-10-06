/**
 * In the Chair: Zamaine Ismail, West and Hunter. Built as a DRAFT on
 * Barbering Business, with a local proof for JB. JB, 29 Sep 2026:
 * "interview for barber, can you preview to me". Nothing here publishes and
 * nothing emails Zamaine.
 *
 * Source: his reply of 29 Sep 2026 09:36 from info@westandhunter.com,
 * answering all seven questions. The row was locked to "drafted" before the
 * hourly sweep could draft its own copy.
 *
 * Quote edits, all punctuation, for JB to approve:
 *   Q7  "giving them a platform - talking about success" loses the dash and
 *       becomes "giving them a platform, talking about success" (house rule)
 *   Q6  "before you've even picked up a pair of scissors" keeps his exclamation
 * Everything else is his wording, character for character.
 *
 * Photos: four he sent. The shopfront team shot leads because we do not know
 * which face is his, and he has promised a high-res image separately; swap the
 * hero when it lands. No caption names anybody.
 *
 * No company logo on the card: the West and Hunter mark is white on black and
 * would vanish on the white card, and their site serves no dark version.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-zamaine-ismail-interview.mjs --photos=<dir> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir with shopfront.jpg and cutting.jpg>");
const HERO_FILE = path.join(PHOTOS, "shopfront.jpg");
const INLINE_FILE = path.join(PHOTOS, "cutting.jpg");
const HERO_ALT = "The West and Hunter team outside the shop on Chiswick High Road";
const INLINE_ALT = "A barber cutting a client's hair in the West and Hunter shop floor";

const SITE = "https://barberingbusiness.com";
const L = {
  wh: "https://westandhunter.com/",
  hub: `${SITE}/in-the-chair/`,
  awards: "https://hji.co.uk/british-hairdressing-business-awards-2026-finalists-revealed",
  loyalty: `${SITE}/best-barbershop-loyalty-app-loyalty-and-referral-tools-compared-for-uk-owners/`,
  pricing: `${SITE}/inflation-climbs-to-2-9-as-bcc-warns-firms-are-still-feeling-the-heat-what-it-means-for-barbershop-pricing/`,
};

const TITLE_TEXT = "Zamaine Ismail on going deeper before wider";
const TITLE = `<span class="franchise-eyebrow">🪑 In the Chair:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `In the Chair: ${TITLE_TEXT}`;
const SLUG = "in-the-chair-zamaine-ismail-on-going-deeper-before-wider";
const CATEGORY_ID = 3; // Business & Money
const EXCERPT =
  "Zamaine Ismail opened West and Hunter in Chiswick in 2020 and is shortlisted again for Barbershop and Grooming Salon of the Year. He explains where the money really comes from, how he priced at the luxury end, and why the next move is depth rather than another site.";
const META =
  "Zamaine Ismail of West and Hunter on pricing at the luxury end, building an ecosystem around the chair, and why he is going deeper before wider.";
const KEYPHRASE = "barbershop membership";

const q = (...paras) => `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/"/g, "&#8220;");
// A real wp:image block: a bare figure renders at native size and breaks the column.
const figure = (src, alt) =>
  `<!-- wp:image {"sizeSlug":"full","linkDestination":"none","align":"center"} -->\n<figure class="wp-block-image aligncenter size-full"><img src="${src}" alt="${alt}"/></figure>\n<!-- /wp:image -->`;

function buildBody({ inlineUrl }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are West and Hunter?</h2>
</div>
<p>${t(`An independently owned men's hairdressers and barbershop on Chiswick High Road in west London, trading as a gentlemen's grooming club. Alongside cutting and shaving it runs a private membership, a members' lounge, a bar, skincare and grooming services, events and its own product collection.`)}</p>
<dl>
<div>
<dt>Website</dt>
<dd><a href="${L.wh}">westandhunter.com</a></dd>
</div>
<div>
<dt>Based</dt>
<dd>Chiswick, west London</dd>
</div>
<div>
<dt>Opened</dt>
<dd>2020</dd>
</div>
</dl>
</section>`,

    p(t(`Opening a barbershop in 2020 meant opening into the worst year the trade has had. Zamaine Ismail did it anyway, and <a href="${L.wh}">West and Hunter</a> is now <a href="${L.awards}">shortlisted again for Barbershop and Grooming Salon of the Year</a> at the British Hairdressing Business Awards, three years after winning it.`)),

    q(
      t(`Opening in 2020 taught me resilience very quickly.`),
      t(`We were trying to establish a completely new business at a time when our industry was being told to close its doors. There were periods where we physically couldn't trade, yet the rent, responsibilities and pressures of running a business didn't disappear.`)
    ),
    p(t(`He argues the timing shaped the business rather than just damaging it.`)),
    q(
      t(`We couldn't take anything for granted. Every client who walked through the door mattered, and we had to give people a reason to come back.`),
      t(`Chiswick really embraced us, and a lot of the people who supported us during those early days are still sitting in our chairs today.`)
    ),

    h2(`The chair is still the heartbeat`),
    p(t(`West and Hunter sells a good deal more than haircuts: a product collection, a private membership, a members' lounge, events, and a podcast recorded on site. Asked where the money actually comes from, Ismail puts the craft first.`)),
    q(
      t(`The chair is still the heartbeat of West and Hunter.`),
      t(`We're barbers and men's hairdressers first, and I never want everything we're building around the business to dilute the quality of the craft.`),
      t(`But I've always believed the opportunity is much bigger than selling somebody a haircut every few weeks.`)
    ),
    p(t(`The distinction he draws is between adding revenue and extending a relationship, which is the same test any owner should apply to a <a href="${L.loyalty}">membership or loyalty scheme</a>.`)),
    q(
      t(`A client might initially discover us because they need their hair cut, but while they're with us they're experiencing the hospitality, using our products, discovering our membership, spending time in the lounge and developing a relationship with the brand.`),
      t(`We're not trying to bolt random revenue streams onto a barbershop. Everything has to make sense for the same gentleman we're already looking after.`)
    ),

    h2(`Pricing at the luxury end`),
    p(t(`West and Hunter's prices sit high for the area. Asked how he knew Chiswick would pay them, at a time when <a href="${L.pricing}">every shop is weighing what it can charge</a>, his answer is unusually direct.`)),
    q(
      t(`I didn't know.`),
      t(`That's probably the most truthful answer.`),
      t(`What I did know was that there were people who valued exceptional service, expertise, consistency and their time.`)
    ),
    p(t(`He had seen the model work before opening, having worked in luxury men's grooming including at Acqua di Parma in Mayfair, and took the standard west rather than copying it.`)),
    q(
      t(`We don't set out to be expensive for the sake of being expensive. The price has to be justified every time somebody walks through the door.`),
      t(`You can't simply put a premium price on the menu and call yourself luxury. The client has to experience the difference.`)
    ),

    h2(`Family gives it heart, structure keeps it honest`),
    p(t(`The business is family run, and Ismail does not pretend the two sides come apart cleanly.`)),
    q(
      t(`Being independently and family owned means there is a personal level of accountability behind West and Hunter. Our name and reputation genuinely matter to us.`),
      t(`At the same time, you have to learn when you're making an emotional decision and when you're making a commercial one. That's something I've become much better at as the business has matured.`),
      t(`Family gives the business its heart, but you still need structure, standards and accountability for it to grow.`)
    ),

    h2(`What an award does not change`),
    p(t(`West and Hunter won Barbershop and Grooming Salon of the Year at the British Hairdressing Business Awards in 2023. Ismail is clear about what that did for the business, and what it did not.`)),
    q(
      t(`It gave the team recognition for the enormous amount of work happening behind the scenes and gave West and Hunter credibility nationally within our industry.`),
      t(`But winning didn't change what happens the following morning.`),
      t(`The doors still have to open. The first client still deserves an exceptional experience. The floor still needs sweeping. The phones still need answering. Your team still needs leading.`),
      t(`Awards are wonderful validation, but they can't become your standard.`)
    ),

    h2(`The part nobody warns you about`),
    p(t(`Every owner discovers that the job stops being the job. Asked for the least glamorous part, Ismail barely pauses.`)),
    q(
      t(`Everything that has absolutely nothing to do with cutting hair!`),
      t(`When you start, you imagine you're going to spend your life perfecting your craft and building this amazing environment. Then suddenly you're dealing with payroll, VAT, business rates, recruitment, stock, plumbing, software, cancellations, maintenance, marketing and a hundred other things before you've even picked up a pair of scissors.`),
      t(`Being a great barber doesn't automatically make you a great business owner or a great leader. I've had to learn all three, and I'm still learning.`)
    ),

    h2(`Deeper before wider`),
    p(t(`The obvious next move for a shop with this much brand behind it is a second site. Ismail is deliberately not doing that yet.`)),
    figure(inlineUrl, INLINE_ALT),
    q(
      t(`Deeper before wider.`),
      t(`People naturally ask me about opening another location, but right now I'm fascinated by how much further we can develop what we've already created at 125 Chiswick High Road.`)
    ),
    p(t(`A refurbishment is finished, the members' lounge is open, and the newest project is a podcast recorded in a studio built inside the shop.`)),
    q(
      t(`I've spent my career standing behind a barber's chair having incredible conversations with entrepreneurs, creatives, business leaders, fathers and people from all walks of life. There's something about the barber's chair that encourages people to talk openly.`),
      t(`The podcast is about taking some of those conversations and giving them a platform, talking about success, failure, family, mentorship, ambition and the experiences that shape people.`)
    ),
    p(t(`Growth is still the plan. It is just not being counted in shopfronts.`)),
    q(
      t(`Longer term, of course I have ambitions for West and Hunter to grow beyond Chiswick. But growth for me isn't simply measured by how many locations we can put our name above.`),
      t(`We started with a barber's chair in Chiswick. The exciting part is discovering how far we can take the world we've built around it.`)
    ),

    p(t(`<em><a href="${L.hub}">In the Chair</a> profiles the people running Britain's barbershops and grooming businesses. Answers have been lightly edited for punctuation.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

const hero = await sharp(HERO_FILE).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
const inline = await sharp(INLINE_FILE).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();

if (DRY) {
  const data = (buf) => `data:image/jpeg;base64,${buf.toString("base64")}`;
  const body = buildBody({ inlineUrl: data(inline) });
  if (/[—–]/.test(body)) throw new Error("dash in body");
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const proof = `<title>Proof: ${SEO_TITLE}</title>
<style>
:root{--brand:#8a3b1e;--ink:#15161a;--muted:#5b5e66;--bg:#faf8f5}
body{background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,"Times New Roman",serif;margin:0}
.wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px}
.note{font:13px/1.5 system-ui,sans-serif;background:#fff7e0;border:1px solid #e8d49a;border-radius:8px;padding:12px 14px;margin-bottom:28px;color:#5a4a12}
.note ul{margin:6px 0 0 18px;padding:0}
h1{font:700 34px/1.2 system-ui,sans-serif;margin:0 0 14px}
.franchise-eyebrow{color:var(--brand)}
.standfirst{font:19px/1.5 system-ui,sans-serif;color:var(--muted);margin:0 0 20px}
.hero{width:100%;height:auto;border-radius:6px;display:block;margin-bottom:28px}
h2{font:700 23px/1.3 system-ui,sans-serif;margin:34px 0 10px}
.interview-company{background:#fff;border-top:4px solid var(--brand);padding:20px 22px;margin:0 0 28px}
.interview-company-head h2{margin:0;font-size:21px}
.interview-company dl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 0;font:14px system-ui,sans-serif}
.interview-company dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.interview-company dd{margin:0;overflow-wrap:anywhere}
.interview-quote{background:#fff;border-left:3px solid var(--brand);border-radius:14px;margin:18px 0;padding:14px 20px;box-shadow:0 6px 18px rgba(138,59,30,.08)}
.interview-quote p{margin:.4em 0}
figure{margin:22px 0}figure img{max-width:100%;height:auto;border-radius:6px;display:block;margin:0 auto}
a{color:var(--brand)}
</style>
<div class="wrap">
<div class="note"><strong>Proof, not published.</strong> Styled to approximate the site; the real draft is in WordPress. About ${words} words. Category: Business and Money. URL: /${SLUG}/. Meta (${META.length} chars): ${META}
<ul>
<li>Quote edit to approve: his last answer had a dash in "giving them a platform - talking about success", which is now a comma. Everything else is his wording.</li>
<li>Lead photo is the shopfront team shot, because we cannot tell which face is Zamaine. He has promised a high-res image, and I will swap it in when it arrives.</li>
<li>No company logo on the card: their mark is white on black and would disappear on it.</li>
</ul>
</div>
<h1><span class="franchise-eyebrow">🪑 In the Chair:</span> ${TITLE_TEXT}</h1>
<p class="standfirst">${EXCERPT}</p>
<img class="hero" src="${data(hero)}" alt="${HERO_ALT}">
${body}
</div>`;
  const out = path.join(PHOTOS, "zamaine-proof.html");
  fs.writeFileSync(out, proof);
  console.log(`DRY RUN: ~${words} words\nproof: ${out}`);
  process.exit(0);
}

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=400 --fields=ID,post_title --format=json`))
  .filter((r) => /franchise-eyebrow/i.test(r.post_title) && /Zamaine/i.test(r.post_title));
if (existing.length) throw new Error(`an In the Chair piece for Zamaine already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`wh-hero-${stamp}.jpg`, hero);
put(`wh-inline-${stamp}.jpg`, inline);
const imp = (file, title, alt) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --caption=${sq("Picture: West and Hunter")} --porcelain`);
const heroId = imp(`wh-hero-${stamp}.jpg`, "West and Hunter, Chiswick High Road", HERO_ALT);
const inlineId = imp(`wh-inline-${stamp}.jpg`, "West and Hunter shop floor", INLINE_ALT);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ inlineUrl: url(inlineId) });
put(`wh-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/wh-body-${stamp}.html --post_type=post --post_status=draft --post_category=${CATEGORY_ID} ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/wh-hero-${stamp}.jpg /tmp/wh-inline-${stamp}.jpg /tmp/wh-body-${stamp}.html`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "westandhunter.com" } });
await db.interviewTarget.update({ where: { id: target.id }, data: { status: "drafted", headshotUrl: url(heroId) } });
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`media: hero ${heroId}, inline ${inlineId}`);
console.log(`preview: ${SITE}/?p=${postId}&preview=true`);
console.log(`edit:    ${SITE}/wp-admin/post.php?post=${postId}&action=edit`);
