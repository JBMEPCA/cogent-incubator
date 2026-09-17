/**
 * SME Leaders: Arran Turner, Sorbus Finance. Built as a DRAFT on Smart SME.
 *
 * JB, 17 Sep 2026: "Can you write this and draft please". Nothing here
 * publishes and nothing emails Arran.
 *
 * Source: Arran's reply of 17 Sep 2026 10:57 to "Seven questions for Sorbus
 * Finance" (arranged by Lucas Payne). The row was locked to "drafted" before
 * the hourly sweep read the reply, so the auto-drafter will not make a second
 * copy.
 *
 * Photo: the one he attached, a 1600x1066 landscape shot at his desk, used
 * whole as the lead image.
 *
 * Quotes are his own sentences, in his order. Edits are typing slips only
 * ("known there business" to "know their business", "We have see" to "We
 * have seen", "it's element" to "its element", a doubled "a complete a whole
 * picture"), which the closing line's "lightly edited for clarity" covers.
 *
 * Sorbus is an FCA appointed representative. The piece reports what he says
 * about borrowing; it does not recommend Sorbus or any product, and nothing in
 * our own prose tells a reader what to borrow.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-arran-turner-interview.mjs --photos=<dir with Arran-1.jpg> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir with Arran-1.jpg>");
const HERO_FILE = path.join(PHOTOS, "Arran-1.jpg");
const HERO_ALT = "Arran Turner, director of Sorbus Finance, at his desk in the Sorbus Finance office";

const SME = "https://smartsme.co.uk";
const L = {
  sorbus: "https://sorbusfinance.co.uk/",
  hub: `${SME}/sme-leaders/`,
  confidence: `${SME}/why-weak-sme-lending-confidence-stops-small-firms-asking-for-the-finance-they-need/`,
  forecast: `${SME}/cash-flow-forecasting-for-small-business-the-13-week-method/`,
  assetFinance: `${SME}/asset-finance-explained-funding-vehicles-diggers-and-equipment-for-uk-trades/`,
};

const TITLE_TEXT = "Arran Turner on getting ready to borrow";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Arran Turner set up Sorbus Finance, a commercial finance brokerage in Chesterfield, in 2022. He explains what owners miss by going straight to their bank, why fundable businesses get turned down, and what to do six months before you borrow.";
const META =
  "Arran Turner of Sorbus Finance on why fundable businesses get turned down, what owners miss at their own bank, and preparing six months before borrowing.";
const KEYPHRASE = "business finance broker";
const SLUG = "sme-leaders-arran-turner-on-getting-ready-to-borrow";

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((p) => `<p>${p}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");

function buildBody({ logoUrl, logoW, logoH }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Sorbus Finance?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Sorbus Finance" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>${t(`Sorbus Finance is an independent commercial finance brokerage based in Chesterfield, Derbyshire. It arranges asset finance, business loans and vehicle leasing for businesses locally and nationally, introducing them to a range of lenders rather than lending itself, with specialists in fleet, construction and prestige assets.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Sorbus Finance Ltd</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.sorbus}">sorbusfinance.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Commercial finance broker</dd>
</div>
<div>
<dt>Based</dt>
<dd>Chesterfield, Derbyshire</dd>
</div>
</dl>
</section>`,

    p(t(`Arran Turner set up <a href="${L.sorbus}">Sorbus Finance</a> in Chesterfield in 2022, after managing large teams for big corporations. His pitch to owners is less about finding them a lender and more about teaching them how lenders think.`)),

    q(
      t(`Traditional banking still provide these services however many users find them slow and restricting and faceless, the tradition of having a relationship with the bank manager doesn't exist anymore, there isn't an opportunity to 'tell your story'.`),
      t(`My driving force, from 2022 and still now, is that we can connect business owners to finance solutions and educate them on how to structure finance, how to get better funding deals, how to access finance where it might have been restricted before.`),
      t(`That is what we have to fight for, being part of the clients journey and being part of their top team that drives them to build a better future.`)
    ),

    p(t(`He is candid about the rest of his own trade. Brokers and alternative lenders who "sell finance" get results, he says, but clients can be left wondering whose side the financer is on.`)),
    q(t(`Don't get me wrong, those two elements can co-exist in harmony, but there is a careful line.`)),

    h2(`Your bank is part of the plan, not all of it`),
    p(t(`Plenty of owners never look further than their own bank, and plenty more, as we have <a href="${L.confidence}">reported before</a>, never ask for finance at all. Turner does not tell them to avoid the high street.`)),
    q(
      t(`Being clear, there are plenty of occasions where going to a high street bank can be the best solution, in fact there are plenty of clients we direct to high street banks because they fit their lending criteria.`),
      t(`A high street bank should be part of a business owners strategy, not their complete strategy.`)
    ),
    p(t(`What the bank often cannot do is the harder cases.`)),
    q(t(`High street banks often have high lending credit acceptance thresholds, can be slower than alternative lending and don't often have in-house specialist divisions. Where alternative lending comes into its element is where a lender can achieve a facility for a new start business, a business with complex lending requirements, a quick turnaround or structure a lending facility based on specific requirements in agriculture, manufacturing, fleet operations, engineering etc.`)),

    h2(`Why fundable businesses get turned down`),
    p(t(`Asked what turns a perfectly fundable business into a no, Turner starts with the owner rather than the numbers.`)),
    q(
      t(`Business owners know their business inside out, they nurture it every day and quite often have invested huge amounts of their time and capital into it and have made significant sacrifices along the way. As such, it can sometimes be hard to step back and take an analytic view of your business and view it as a credit underwriter would view it.`),
      t(`This is why I believe whole heartedly in teaching business owners how to build better applications not just securing facilities.`)
    ),
    p(t(`His answer is to put the weak spots in the application rather than hope nobody finds them: debtor days, old credit problems, and a <a href="${L.forecast}">cash flow forecast</a> that holds up.`)),
    q(t(`An application that analyses its own weakness and can demonstrate confidence is stronger than one that doesn't talk about them.`)),

    h2(`What the health check turns up`),
    p(t(`Sorbus runs a free finance health check for owners. What it most often finds is the work nobody gets round to.`)),
    q(
      t(`Business owners run hard to grow their business and they are used to thinking on their feet. With that being the case, it means that long term objectives can often be overlooked or something that doesn't feel urgent gets put to the back of the queue.`),
      t(`Business owners who are exposing themselves to debt, should make sure they have the right strategies and policies in place to ensure they don't feel the maximum burden themselves.`)
    ),

    h2(`Specialists, not generalists`),
    p(t(`Rather than hire generalists, Sorbus has built its team around specialists in fleet, construction and prestige assets, the kind of borrowing our guide to <a href="${L.assetFinance}">asset finance for vehicles and equipment</a> covers. Turner's reasoning is that borrowing is rarely routine for the borrower.`)),
    q(
      t(`Taking on debt is a big event for a lot of businesses. Even for well established businesses this can be a big occasion such as an acquisition or milestone.`),
      t(`Being a finance broker is not about 'finding finance' or 'getting an acceptance'. We have seen some of our customers biggest wins and lowest falls, we stand by them throughout that and advise through a team that are motivated by becoming well known specialists in their business.`)
    ),

    h2(`The hardest part of growing`),
    p(t(`Sorbus moved into a new office this summer after outgrowing the last one. The hard part, Turner says, was not the move.`)),
    q(
      t(`Honestly, for me, and this is a personal experience, letting go and giving away control of something you have nurtured from inception is tough!`),
      t(`I have managed large teams in the past for big corporations, but when it's your business it feels different. You know the theory that you have to put systems in place, train excellent and ambitious people but you still have to let go.`),
      t(`It has been supported through hiring excellent people who are looking to strive in this industry and build rewarding careers.`)
    ),

    h2(`Six months before you borrow`),
    q(
      t(`Don't be impulsive, with the growing number of tools available to you, really spend time getting your house in order before making that application. It will impact so many elements of your lending journey.`),
      t(`It will help you identify what might be available, the right lending type and even if you need to borrow money at all!`)
    ),
    p(t(`He points owners back to the people they already pay.`)),
    q(t(`Utilise experts around you, most business owners will have a relationship with their accountant, potentially a finance broker, an IFA, all of these people are part of your network and can support you and utilise them where you can!`)),
    p(t(`It is an unusual message from someone whose business is arranging finance: that the best preparation might show you do not need to borrow at all.`)),

    p(t(`<em><a href="${L.hub}">SME Leaders</a> profiles the people building Britain's best small businesses. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

// Their nav logo, a webp. Checked for near-white ink, which would vanish on
// the white company card.
async function logoPng() {
  const r = await fetch("https://sorbusfinance.co.uk/assets/sorbus_logo_optimized-KKvnKpvb.webp", { headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" } });
  if (!r.ok) throw new Error(`logo fetch ${r.status}`);
  const src = Buffer.from(await r.arrayBuffer());
  const trimmed = await sharp(src).trim({ threshold: 12 }).resize({ height: 240, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
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

const logo = await logoPng();
const hero = await sharp(HERO_FILE).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();

if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({ logoUrl: data(logo.buf, "image/png"), logoW: logo.width, logoH: logo.height });
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  fs.writeFileSync(path.join(PHOTOS, "arran-body.html"), body);
  fs.writeFileSync(path.join(PHOTOS, "arran-logo.png"), logo.buf);
  console.log(`DRY RUN: ~${words} words, dashes in body: ${/[—–]/.test(body)}`);
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

// One piece per person.
const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`))
  .filter((r) => /SME Leaders/i.test(r.post_title) && /Arran Turner/i.test(r.post_title));
if (existing.length) throw new Error(`an SME Leaders piece for Arran Turner already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`sorbus-logo-${stamp}.png`, logo.buf);
put(`arran-hero-${stamp}.jpg`, hero);
const imp = (file, title, alt) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --porcelain`);
const logoId = imp(`sorbus-logo-${stamp}.png`, "Sorbus Finance logo", "Sorbus Finance");
const heroId = imp(`arran-hero-${stamp}.jpg`, "Arran Turner, Sorbus Finance", HERO_ALT);
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logo.width, logoH: logo.height });
put(`arran-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/arran-body-${stamp}.html --post_type=post --post_status=draft --post_category=8 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/sorbus-logo-${stamp}.png /tmp/arran-hero-${stamp}.jpg /tmp/arran-body-${stamp}.html`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "sorbusfinance.co.uk" } });
await db.interviewTarget.update({ where: { id: target.id }, data: { status: "drafted", headshotUrl: url(heroId) } });
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}`);
console.log(`preview: ${SME}/?p=${postId}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${postId}&action=edit`);
