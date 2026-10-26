/**
 * SME Leaders: Lisa Morris, Wye Knot. Built as a DRAFT on Smart SME.
 *
 * JB, 26 Oct 2026: asked for the photos from Ian's ZIP, then the proof.
 * Nothing here publishes and nothing emails Lisa or Ian.
 *
 * Source: her answers, sent by Ian Morris on her behalf on 26 Oct 2026 10:58
 * UK, saved verbatim in scripts/interviews/wye-knot-answers.txt. The sweep had
 * already marked the row "answered"; it was locked to "drafted" before it
 * drafted anything. No proof edits needed; every quote is word for word.
 *
 * Photos from Ian's ZIP (wye-knot.co.uk, 18 images, shot in the shop on
 * 29 Sep 2026): the hero is 20260929_150219 (Lisa holding a Highland cow among
 * the Highland cow range, which is the story), cropped 16:9; inline is
 * 20260929_142130, Lisa at the shop front. Both checked full size for edit
 * artefacts; the filenames say "polished" but nothing looked altered.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-lisa-morris-interview.mjs --photos=<dir> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=").slice(1).join("=");
if (!PHOTOS) throw new Error("--photos=<dir with the unzipped images>");
const HERO_FILE = `${PHOTOS}/20260929_150219_polished.jpg`;
const SHOP_FILE = `${PHOTOS}/20260929_142130_polished.jpg`;
const SOURCE = fs.readFileSync("scripts/interviews/wye-knot-answers.txt", "utf8");

const SME = "https://smartsme.co.uk";
const SITE = "https://wye-knot.co.uk/";
const HUB = `${SME}/sme-leaders/`;
const TARGET_DOMAIN = "wye-knot.co.uk";
const TITLE_TEXT = "Lisa Morris on the Highland cows that won";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Lisa Morris opened Wye Knot, a gift and card shop in Builth Wells, in June with no retail experience. She expected Welsh sheep and dragons to sell best. Her customers chose Highland cows, and she let them.";
const META =
  "Lisa Morris opened Wye Knot in Builth Wells with no retail experience. On Highland cows outselling dragons, holding cash back, and 65 Welsh cards.";
const KEYPHRASE = "opening a gift shop";
const SLUG = "sme-leaders-lisa-morris-wye-knot";
const HERO_ALT = "Lisa Morris, owner of Wye Knot, holding a Highland cow among the shop's Highland cow range";
const HERO_CAPTION = "Lisa Morris in Wye Knot, Builth Wells. Picture: Wye Knot";
const SHOP_ALT = "Lisa Morris outside Wye Knot on the High Street in Builth Wells";
const SHOP_CAPTION = "Wye Knot opened on the High Street in Builth Wells on 29 June 2026. Picture: Wye Knot";

const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");
const q = (...paras) => `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${t(x)}</p>`).join("\n")}\n</blockquote>`;
const pull = (...paras) => q(...paras).replace("interview-quote\"", "interview-quote interview-quote--pull\"");
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${t(s)}</p>`;

function buildBody({ shopId, shopUrl }) {
  const shop = `<!-- wp:image {"id":${shopId},"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="${shopUrl}" alt="${SHOP_ALT}" class="wp-image-${shopId}"/><figcaption class="wp-element-caption">${SHOP_CAPTION}</figcaption></figure>
<!-- /wp:image -->`;
  return [
    `<p class="standfirst"><em>${t(`Lisa Morris opened Wye Knot, an independent gift and card shop on the High Street in Builth Wells, on 29 June, with no previous retail experience. She stocked up expecting Welsh sheep and dragons to lead. Her customers picked Highland cows instead. She answered our seven questions on what four months of real sales have taught her about buying stock, keeping cash back, and listening to the people who come through the door.`)}</em></p>`,
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who is Wye Knot?</h2>
</div>
<p>${t(`An independent gift and card shop on the High Street in Builth Wells, Powys, selling gifts, home decor, collectables and cards, including Welsh-language birthday cards. Lisa Morris opened it on 29 June 2026 and launched an online shop in mid-August, with UK delivery and free collection on eligible orders.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Wye Knot</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${SITE}">wye-knot.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Independent retail</dd>
</div>
<div>
<dt>Based</dt>
<dd>Builth Wells, Powys</dd>
</div>
</dl>
</section>`,
    `<p><a href="${SITE}">Lisa Morris</a> answered our questions in writing, and the answers below are her own words.</p>`,

    h2(`From school cleaner to shop owner`),
    q(`Living in Wales had been a dream since childhood, and I had wanted to own a gift shop for around six years. Ian and I had visited the Builth Wells area regularly before we moved here in November 2025. When premises on the High Street became available, I already knew the owners, and the chance to open a shop felt like the right moment to bring those two hopes together. I had worked as a school cleaner at Sundorne Academy in Shrewsbury, so retail was a completely new direction. With help from family and friends, we transformed the shop in two weeks. I wanted it to have personality and to be full of things that might make someone smile or start a conversation. I was surprised by how quickly customers challenged my assumptions and how warmly neighbouring businesses welcomed us.`),
    shop,

    h2(`The Highland cows nobody planned for`),
    p(`A shop in mid Wales stocking Welsh sheep and dragons is the obvious bet. It was not the one her customers made.`),
    q(
      `I started to notice the difference once customers began choosing from the opening range. I had expected Welsh sheep and dragon gifts to be our strongest themes, but Highland cow products performed better than I anticipated.`,
    ),
    pull(`It was a useful reminder that my own ideas are only a starting point; the people coming through the door show me what resonates.`),
    q(`I am using those early sales to guide what I consider reordering, while looking for demand that continues rather than reacting to one busy day. I still want Wye Knot to reflect its Welsh setting, but I am learning to keep the mix open and let customers’ choices shape it.`),
    p(`This is the lesson most new retailers learn the expensive way. The opening range is a guess built on what the owner thinks will sell, and the till is the first honest feedback. What matters is how quickly the stock follows the evidence, and how much money is left to follow it with.`),

    h2(`What to reorder, try and drop`),
    q(`I look at what people actually buy, how quickly a product sells, whether demand continues and what is still on the shelf. I try not to make a decision based on a single comment or one busy day. When I consider something new, I think about quality, value, presentation and personality, as well as supplier minimum orders and delivery times. If a product is not moving, I need to consider how much stock remains and whether it makes sense to reorder before deciding what to do next. Wye Knot is still a new shop, so I am learning which ranges have lasting demand. My aim is to use customer feedback alongside purchases, and keep some money available for reordering products people have shown they want.`),

    h2(`Holding cash back for the reorder`),
    p(`Every new shop faces the same trade-off between a full-looking opening range and the money it will need to restock what sells. We asked how she handled it.`),
    q(`I began with smaller quantities across different ranges, so I could offer variety without tying too much money up in one assumption. Supplier minimum orders affect how small some tests can be, so there is a balance between having enough choice and protecting cash. As the first sales came in, I saw how important it is to keep working capital available for the products customers show they want. Looking back, I would keep more of the initial budget back for reordering once I had evidence from real purchases. With no previous year’s figures, I could not know exactly what would sell before opening. I now see the first order as a starting point: buy thoughtfully, watch what happens, and leave enough room to respond.`),
    p(`Supplier minimum orders are the trap she is describing. A new shop wants to test twenty ranges in small numbers; the suppliers want it to commit to a few in bulk. Every pound spent on a range that does not sell is a pound that cannot be spent restocking the Highland cows.`),

    h2(`Sixty-five cards, because customers asked`),
    q(`Cards have become an important part of Wye Knot because customers asked for them and then showed us what they wanted. Requests for Welsh-language birthday cards prompted us to add 65 designs. I have also found that many people prefer cards that are blank inside, because they want to write a message in their own words. I like that a card can feel personal, and I wanted the shop to offer things that might make someone smile or start a conversation. The response has helped us build a range that reflects what customers are actually looking for, rather than just my own taste. It has also made me think about whether, in the longer term, a broader greetings selection might need more space. That remains an ambition, not a confirmed move.`),

    h2(`The online shop, honestly`),
    q(`The High Street shop lets people pick things up, browse in person and ask me about a gift. Online, customers need clear information and photographs to help them decide, along with straightforward delivery or collection details. The website gives people another way to browse our selection, with UK delivery and free collection available on eligible orders. We launched in mid-August, so the online shop is still new and I am developing it alongside the physical one. I think it is worth continuing because it gives people another way to find Wye Knot, including those who cannot visit Builth Wells. I do not yet have a full year of results, so I am not making claims about its sales impact; I am learning what works as we go.`),
    p(`It is a refreshingly straight answer. Two months is not long enough to know whether an online shop pays its way, and she does not pretend otherwise.`),

    h2(`Advice for next year's first-timers`),
    q(`I would tell them that it is all right to learn as you go. Choose your opening range thoughtfully, but do not expect to know exactly what customers will want until they have had the chance to show you. Start with quantities that leave room to adjust, pay attention to what people actually buy, and remember that supplier minimums and delivery times affect how quickly you can respond. I have also learned how much practical help matters: family and friends helped us prepare the shop, and neighbouring businesses have recommended us and sent customers our way. For Wye Knot, the immediate focus is our first Christmas, while continuing to develop the online shop. A larger premises with more room for cards is something I may explore in future, but there is no confirmed move.`),

    `<p><em><a href="${HUB}">SME Leaders</a> is Smart SME&#8217;s series with the people who own and run UK small businesses. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a business and would like to take part, write to <a href="mailto:press@smartsme.co.uk">press@smartsme.co.uk</a>.</em></p>`,
  ].join("\n\n");
}

// ---- gate ----
const probe = buildBody({ shopId: 1, shopUrl: "x" });
const problems = [];
if (/[—–]/.test(probe + TITLE + EXCERPT + META + HERO_ALT + HERO_CAPTION + SHOP_ALT + SHOP_CAPTION)) problems.push("dash somewhere");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length}`);
if (META.length > 155) problems.push(`meta ${META.length}`);
const norm = (x) => x.replace(/<[^>]+>/g, "").replace(/&#8217;|[‘’]/g, "'").replace(/&#8220;|&#8221;|[“”]/g, '"').replace(/\s+/g, " ").trim();
const src = norm(SOURCE);
for (const m of probe.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)) {
  for (const para of m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const n = norm(para[1]);
    if (!src.includes(n)) problems.push(`NOT VERBATIM: ${n.slice(0, 90)}`);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const ours = probe.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
console.log(`gate ok | seo ${SEO_TITLE.length} | meta ${META.length} | ~${ours} words of ours`);

// ---- images ----
const W = 1600, H = 900;
const hm = await sharp(HERO_FILE).rotate().metadata();
const bandH = Math.round((hm.width * 9) / 16);
const top = Math.min(hm.height - bandH, Math.round(hm.height * 0.08));
const hero = await sharp(HERO_FILE).rotate().extract({ left: 0, top, width: hm.width, height: bandH }).resize(W, H).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
const shopImg = await sharp(SHOP_FILE).rotate().resize({ width: 1200 }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
if (DRY) { fs.writeFileSync(`${PHOTOS}/../lisa-hero.jpg`, hero); console.log("DRY: hero written"); process.exit(0); }

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
  .filter((r) => /Lisa Morris|Wye Knot/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`lisa-hero-${stamp}.jpg`, hero);
put(`lisa-shop-${stamp}.jpg`, shopImg);
const heroId = wp(`media import /tmp/lisa-hero-${stamp}.jpg --title=${sq("Lisa Morris, Wye Knot")} --alt=${sq(HERO_ALT)} --caption=${sq(HERO_CAPTION)} --porcelain`);
const shopId = wp(`media import /tmp/lisa-shop-${stamp}.jpg --title=${sq("Wye Knot shop front, Builth Wells")} --alt=${sq(SHOP_ALT)} --caption=${sq(SHOP_CAPTION)} --porcelain`);
const shopUrl = wp(`post get ${shopId} --field=guid`);
put(`lisa-body-${stamp}.html`, Buffer.from(buildBody({ shopId, shopUrl }), "utf8"));
const postId = wp(
  `post create /tmp/lisa-body-${stamp}.html --post_type=post --post_status=draft --post_category=8 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/lisa-hero-${stamp}.jpg /tmp/lisa-shop-${stamp}.jpg /tmp/lisa-body-${stamp}.html`);
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: TARGET_DOMAIN } });
await db.interviewTarget.update({ where: { id: target.id }, data: { headshotUrl: wp(`post get ${heroId} --field=guid`) } });
await prisma.$disconnect();
console.log(`DRAFT ${postId} hero ${heroId} shop ${shopId}`);
console.log(`preview: ${SME}/?p=${postId}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${postId}&action=edit`);
