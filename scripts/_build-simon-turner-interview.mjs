/**
 * Fleet Professional: Simon Turner, Driving for Better Business. Built as a
 * DRAFT on The Fleet Magazine, plus a local proof page for JB.
 *
 * JB, 21 Sep 2026: "write the interview, proof to me before sending them
 * anything". Nothing here publishes and nothing emails Simon.
 *
 * Source: Simon's Word document "2026-09 DfBB Article for The Fleet Magazine
 * Simon Turner.docx", answering "Seven questions for Driving for Better
 * Business". He answered "What trends are you seeing?" in place of our Q7.
 * The answers arrived as an attachment the sweep cannot read, so the row was
 * locked to "drafted" before the hourly sweep could draft from the covering
 * note alone.
 *
 * Quotes are his own sentences. Edits are punctuation only: his two en dashes
 * become a full stop (house rule), one missing comma ("hurt, which"), and
 * "12 months time" gains its apostrophe. The closing line's "lightly edited
 * for clarity" covers those. Every figure in the piece is his and sits inside
 * or directly attributed to his words; none is ours.
 *
 * Images: the headshot and logo he sent. The headshot is square, and the
 * theme crops heroes to 16:9, so it is cut to 16:9 here from near the top so
 * the crop cannot take his head off.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-simon-turner-interview.mjs --photos=<dir with simon.jpg, dfbb-logo.png> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir with simon.jpg and dfbb-logo.png>");
const HERO_FILE = path.join(PHOTOS, "simon.jpg");
const LOGO_FILE = path.join(PHOTOS, "dfbb-logo.png");
const HERO_ALT = "Simon Turner, Engagement Manager at Driving for Better Business";

const FLEET = "https://thefleetmagazine.co.uk";
const L = {
  dfbb: "https://www.drivingforbetterbusiness.com/",
  hub: `${FLEET}/fleet-professional/`,
  greyFleet: `${FLEET}/grey-fleet-the-duty-of-care-employers-keep-ignoring/`,
  hswa: "https://www.legislation.gov.uk/ukpga/1974/37/section/37",
};

const TITLE_TEXT = "Simon Turner on the road risk nobody owns";
const TITLE = `<span class="franchise-eyebrow">🚚 Fleet Professional:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Fleet Professional: ${TITLE_TEXT}`;
const EXCERPT =
  "Simon Turner leads Driving for Better Business, the free National Highways programme named Fleet Supplier of the Year. He explains why insurance and a licence check are not a road risk policy, how to fix grey fleet, and what finally moves a board.";
const META =
  "Simon Turner of Driving for Better Business on grey fleet, directors' liability and what makes a board act on work-related road risk.";
const KEYPHRASE = "work-related road risk";
const SLUG = "fleet-professional-simon-turner-on-the-road-risk-nobody-owns";
const CATEGORY_ID = 10; // Case Studies

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");

function buildBody({ logoUrl, logoW, logoH }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Driving for Better Business?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Driving for Better Business" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>${t(`Driving for Better Business is a free programme from National Highways that helps employers manage the risk of their staff driving for work. It publishes tools, guidance and case studies, from a driving for work policy builder to van and car driver toolkits, for anyone from a handful of company vehicles to a large mixed fleet.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Driving for Better Business</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.dfbb}">drivingforbetterbusiness.com</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Work-related road safety</dd>
</div>
<div>
<dt>Run by</dt>
<dd>National Highways</dd>
</div>
</dl>
</section>`,

    p(t(`Simon Turner has spent more than 20 years on work-related road risk, and since 2015 has led <a href="${L.dfbb}">Driving for Better Business</a>, the free National Highways programme named Fleet Supplier of the Year at the Fleet News Awards. He is also a trustee and former chair of the Association for Road Risk Management. His view of where the industry has got to is generous about progress and blunt about what has not changed.`)),

    p(t(`The award, he says, recognised a gap that most employers will admit to.`)),
    q(t(`Most employers already know road risk matters. What they lack is the time, budget or expertise to act on it. So everything on our resources page is built to be used on a Monday morning: a Driving for Work Policy Builder, a gap analysis, collision-rate benchmarking, van and car driver toolkits, an incident investigation guide, and newer material on young van drivers, eyesight, diabetes and fleet data.`)),

    h2(`Who actually owns driver safety?`),
    p(t(`Asked what has improved over twenty years, Turner starts with motive. The business case used to be the only way in.`)),
    q(t(`When I started in this area twenty years ago, the business case was how you got most directors and business owners to take notice. Safety had to be dressed up as savings. Today more organisations will say plainly that they do it because they don't want their people hurt, which I think is real progress.`)),
    p(t(`Telematics has moved from tracking vehicles to coaching drivers, he says, grey fleet is at least acknowledged, and driver health is finally on the agenda. What has not moved is ownership.`)),
    q(t(`Ask who owns driver safety in most organisations and the honest answer is often several people partially, nobody fully, and one person when something goes wrong.`)),
    p(t(`Close behind it is the gap between having a programme and running one. Most serious fleets have the policy, the telematics and the induction, he says. Far fewer have the coaching conversations, data reviews, named accountability and board reporting that turn those documents into fewer incidents.`)),

    h2(`Insurance pays for damage`),
    p(t(`Most employers think driving for work is covered by an insurance policy and a licence check. Turner takes both apart.`)),
    q(
      t(`Insurance pays for damage. It doesn't discharge a legal duty. The Health and Safety at Work Act applies to driving just as it does to a factory, office or warehouse: The company has a duty of care to its own drivers and to other road users. Directors are personally liable if appropriate policies and procedures aren't in place.`),
      t(`A licence check confirms entitlement. It tells you nothing about whether someone is competent in the vehicle you've given them, fit to drive today, or working to a schedule that pushes them to speed.`)
    ),
    p(t(`When his team maps a typical van driver's day, they find risk in the driver, their fitness, the vehicle, the load, the work instructions, the journey and the destination.`)),
    q(t(`Only one of them is the act of driving. The rest are all managed through management processes.`)),

    h2(`Grey fleet: ownership is irrelevant`),
    p(t(`Grey fleet, staff driving their own cars on company business, is the question he is asked first at events. How bad is it?`)),
    q(t(`Bad, and largely invisible. The long-standing estimate is around 14 million vehicles, and with so many people now home-based, I'm not sure anyone genuinely knows the scale today.`)),
    p(t(`The misconception he meets most is that an employee's own car is the employee's problem, a point we made in <a href="${L.greyFleet}">our own look at grey fleet and duty of care</a>.`)),
    q(t(`That's simply wrong; ownership is largely irrelevant to your duty of care. And the basics are routinely missed. Roughly one in five grey fleet insurance certificates checked each year lack business use cover. Driving without the right insurance is an offence for the employee, and permitting it is an offence for the employer.`)),
    p(t(`His fix costs nothing, and a fleet manager could introduce it this week.`)),
    q(t(`Treat grey fleet drivers exactly like company car drivers, and add a tick box to every mileage claim confirming MOT, tax, business insurance and maintenance. No tick, no payment.`)),

    h2(`What finally moves a board`),
    p(t(`Turner gives three arguments. The first is personal: a director who fails to put appropriate policies in place can be prosecuted as an individual under <a href="${L.hswa}">section 37</a> of the Health and Safety at Work Act. The second is cost, from insurance and damage repair to fuel and maintenance. The third, he says, is increasingly the strongest.`)),
    q(t(`When a major client writes road risk into a tender, asks to see your driving for work policy, or requires an audited standard before your vans can work on their contract, the conversation moves from the safety manager's desk to the boardroom immediately.`)),
    p(t(`He expects that pressure to grow.`)),
    q(t(`The government's new Road Safety Strategy, launched in January, commits them to piloting a national work-related road safety charter, with regulation on the table if voluntary engagement falls short. Boards that wait will be playing catch-up.`)),

    h2(`Nothing to sell`),
    p(t(`Driving for Better Business is funded by National Highways rather than by the industry, and Turner says that changes what he can say.`)),
    q(t(`We have nothing to sell, so I can tell an employer they don't need to buy anything to get started. A policy, a gap analysis and an honest conversation with their drivers will take most organisations a long way.`)),
    p(t(`It also lets him say the uncomfortable things.`)),
    q(t(`That technology alone isn't the transformation; what you do with the data is. That most standard inductions aren't reducing collisions among young drivers. That the biggest gap in fleet safety isn't kit or guidance, it's management discipline.`)),

    h2(`Three trends to watch`),
    p(t(`The first is supply chain accountability. Clients increasingly want evidence of how their suppliers manage driver risk, from one-page tender specifications to audited standards for contractors working in London and on the railways, and Turner expects the charter pilot to speed that up. The second is how young drivers are brought in.`)),
    q(t(`Drivers aged 17 to 24 are involved in around one in five collisions where someone is killed or seriously injured, and a day's induction followed by the keys to a three-tonne van isn't enough. SP Electricity North West moved to four half-day sessions spread over several weeks and recorded zero collisions in the following 11 months.`)),
    p(t(`The third is driver health. He points to Loughborough University analysis of more than 87,000 driver medical records, which found one in five drivers aged 31 to 45 already has high blood pressure.`)),
    q(t(`We check vehicles daily, yet an HGV driver who passes their test at 20 will not face another medical until 45.`), t(`There are many drivers being declared medically fit now, who won't be in 12 months' time. That should make everyone sit up and take notice.`)),

    p(t(`Driving for Better Business's tools, including the driving for work policy builder, gap analysis and driver toolkits, are free at <a href="${L.dfbb}">drivingforbetterbusiness.com</a>.`)),

    p(t(`<em><a href="${L.hub}">Fleet Professional</a> profiles the people behind the businesses we cover. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

// Logo: check the ink is dark enough to survive the white company card.
const logoBuf = await sharp(LOGO_FILE).trim({ threshold: 12 }).resize({ height: 240, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
{
  const { data, info } = await sharp(logoBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] > 128) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  const lum = n ? sum / n : 255;
  console.log(`logo ${logoMeta.width}x${logoMeta.height}, mean ink luminance ${lum.toFixed(0)}`);
  if (lum > 200) throw new Error("logo ink too pale for the white card");
}

// Hero: square headshot cut to 16:9 from near the top.
const src = await sharp(HERO_FILE).rotate().metadata();
const heroH = Math.round((src.width * 9) / 16);
const heroTop = Math.round(src.height * 0.025);
const hero = await sharp(HERO_FILE).rotate().extract({ left: 0, top: heroTop, width: src.width, height: heroH }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
console.log(`hero ${src.width}x${src.height} -> ${src.width}x${heroH} from y=${heroTop}`);

if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({ logoUrl: data(logoBuf, "image/png"), logoW: logoMeta.width, logoH: logoMeta.height });
  const plain = body.replace(/<[^>]+>/g, " ").replace(/&#8217;/g, "'").replace(/\s+/g, " ");
  console.log(`DRY RUN: ~${plain.split(" ").length} words, dashes in body: ${/[—–]/.test(body)}`);
  const proof = `<title>Proof: ${TITLE_TEXT}</title>
<style>
body{font:17px/1.6 Georgia,serif;color:#1d2326;background:#f6f5f2;margin:0}
main{max-width:760px;margin:0 auto;padding:32px 20px 80px;background:#fff}
.meta{font:13px/1.4 Arial,sans-serif;color:#555;background:#fff8e6;border:1px solid #f0d98a;padding:12px 14px;margin-bottom:28px}
.meta b{color:#0B5563}
h1{font:700 34px/1.2 Arial,sans-serif;margin:8px 0 12px}
.franchise-eyebrow{display:block;font:700 13px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B45309;margin-bottom:10px}
.excerpt{font:19px/1.5 Arial,sans-serif;color:#444;margin:0 0 20px}
.hero{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;margin:0 0 28px}
h2{font:700 23px/1.3 Arial,sans-serif;color:#0B5563;margin:34px 0 10px}
.interview-company{border:1px solid #dde3e6;border-left:4px solid #0B5563;padding:18px 20px;margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px}
.interview-company-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
.interview-company-head h2{margin:0;font-size:18px}
.interview-company-logo{max-height:44px;width:auto}
.interview-company dl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px;margin:12px 0 0}
.interview-company dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#777}
.interview-company dd{margin:0;font-weight:600}
blockquote{margin:18px 0;padding:4px 0 4px 20px;border-left:4px solid #B45309;font-style:italic;color:#243034}
a{color:#0B5563}
</style>
<main>
<div class="meta"><b>PROOF, not published.</b> WordPress title: ${SEO_TITLE} &middot; URL: /${SLUG}/ &middot; Category: Case Studies &middot; Meta (${META.length}): ${META} &middot; Keyphrase: ${KEYPHRASE}</div>
<h1><span class="franchise-eyebrow">🚚 Fleet Professional</span>${TITLE_TEXT}</h1>
<p class="excerpt">${EXCERPT}</p>
<img class="hero" src="${data(hero, "image/jpeg")}" alt="${HERO_ALT}">
${body}
</main>`;
  const out = path.join(PHOTOS, "simon-turner-proof.html");
  fs.writeFileSync(out, proof);
  console.log(`proof: ${out}`);
  process.exit(0);
}

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

// One piece per person.
const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=400 --fields=ID,post_title --format=json`))
  .filter((r) => /franchise-eyebrow/i.test(r.post_title) && /Simon Turner/i.test(r.post_title));
if (existing.length) throw new Error(`a Fleet Professional piece for Simon Turner already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`dfbb-logo-${stamp}.png`, logoBuf);
put(`simon-turner-hero-${stamp}.jpg`, hero);
const imp = (file, title, alt) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --caption=${sq("Picture: supplied")} --porcelain`);
const logoId = imp(`dfbb-logo-${stamp}.png`, "Driving for Better Business logo", "Driving for Better Business");
const heroId = imp(`simon-turner-hero-${stamp}.jpg`, "Simon Turner, Driving for Better Business", HERO_ALT);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logoMeta.width, logoH: logoMeta.height });
put(`simon-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/simon-body-${stamp}.html --post_type=post --post_status=draft --post_author=4 --post_category=${CATEGORY_ID} ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/dfbb-logo-${stamp}.png /tmp/simon-turner-hero-${stamp}.jpg /tmp/simon-body-${stamp}.html`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "drivingforbetterbusiness.com" } });
const answers = fs.existsSync(path.join(PHOTOS, "answers.txt")) ? fs.readFileSync(path.join(PHOTOS, "answers.txt"), "utf8") : null;
const qs = String(target.questions).split("\n");
qs[6] = "What trends are you seeing?";
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "drafted", headshotUrl: url(heroId), questions: qs.join("\n"), ...(answers ? { replyBody: answers } : {}) },
});
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}`);
console.log(`preview: ${FLEET}/?p=${postId}&preview=true`);
console.log(`edit:    ${FLEET}/wp-admin/post.php?post=${postId}&action=edit`);
