/**
 * One-off, 30 Sep 2026: the Meet the Manager profile of Ela Konyardi, founder
 * and director of Enchanted Lands Day Nursery, built from the answers she
 * returned on 29 Sep. JB: "write the article, preview to me". Stays a DRAFT.
 *
 * It OVERWRITES draft post 229, which runInterviewSweep produced this morning
 * and which must not go live. That draft is fabricated: it invents her
 * financing route (a commercial mortgage against the first site's freehold),
 * a staffing plan promoting deputies, a nursery-management-software rollout
 * and an occupancy history, none of which appear anywhere in her answers. It
 * also calls her a manager rather than the founder, says "two award
 * shortlists" when she has since WON one, and does not quote her once.
 * Reusing the same post id keeps InterviewTarget.articleId honest and means
 * there is only one draft to publish.
 *
 * Her answers correct two premises in JB's outreach:
 *   1. She WON Community Support of the Year at the Nursery World Awards on
 *      26 Sep 2026. The ask said "shortlisted in two categories".
 *   2. Abbots Langley is an ACQUISITION of Early Adventures, a nursery with 22
 *      years of history, not a second site she opened.
 * Her Q3 answer also refers to "our first acquisition", which implies
 * Kingsbury was bought rather than opened from scratch. She did not correct
 * the "opened in 2022" premise, so nothing here states the mechanism: the copy
 * says she started the business in 2022 and leaves it there. Worth asking her.
 *
 * QUOTES ARE VERBATIM, including the en dash inside her company vision
 * ("Beyond limits - everything is possible"), which is her punctuation, not
 * ours. The no-dashes house rule is applied to OUR copy only; the gate below
 * strips blockquotes before checking. See the memory on the SEO sweep editing
 * interview quotes: nothing may put words in her mouth.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-ela-konyardi-interview.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const APPLY = process.argv.includes("--apply");
const POST_ID = 229;

const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/ela";
const HERO = `${D}/ela-hero.jpg`;
const PORTRAIT = `${D}/ela-portrait.jpg`;
const LOGO = `${D}/enchanted-lands-logo.png`;

const ND = "https://nurserydaily.com";
const EYEBROW = "Meet the Manager:";
const HEADLINE = "Ela Konyardi on building beyond limits";
const SEO_TITLE = `${EYEBROW} ${HEADLINE}`;
const SLUG = "meet-the-manager-ela-konyardi-on-building-beyond-limits";
const KEYPHRASE = "Enchanted Lands Day Nursery";
const META =
  "Ela Konyardi took Enchanted Lands to break-even in three months and a Nursery World Award. On barriers, bureaucracy and buying a 22-year-old nursery.";
const ALT = "Ela Konyardi, founder and director of Enchanted Lands Day Nursery";
const CAPTION = "Ela Konyardi, founder and director of Enchanted Lands Day Nursery. Picture: Enchanted Lands Day Nursery";
const CATEGORY_ID = 2; // News
const AUTHOR_ID = 2; // james-burke

const Q = (x) => `<blockquote class="wp-block-quote interview-quote"><p>${x}</p></blockquote>`;
const P = (x) => `<p>${x}</p>`;
const H = (x) => `<h2 class="wp-block-heading">${x}</h2>`;

function companyCard(logoUrl, w, h) {
  return `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Enchanted Lands Day Nursery?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Enchanted Lands Day Nursery" width="${w}" height="${h}" loading="lazy" decoding="async">
</div>
<p>A family-founded, privately owned nursery group with settings in Kingsbury, north west London, and Abbots Langley in Hertfordshire, the second of which it recently acquired as the 22-year-old Early Adventures. Ela Konyardi started the business in 2022 and runs it with her husband Sebastian. It won Community Support of the Year at the 2026 Nursery World Awards.</p>
<dl>
<div><dt>Company</dt><dd>Enchanted Lands Day Nursery</dd></div>
<div><dt>Website</dt><dd><a href="https://www.enchantedlandsdaynursery.co.uk/">enchantedlandsdaynursery.co.uk</a></dd></div>
<div><dt>Sector</dt><dd>Day nurseries</dd></div>
<div><dt>Based</dt><dd>Kingsbury, north west London</dd></div>
</dl>
</section>`;
}

const portraitBlock = (url) =>
  `<!-- wp:image {"width":"480px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n` +
  `<figure class="wp-block-image aligncenter size-full is-resized">` +
  `<img src="${url}" alt="${ALT}" style="width:480px"/>` +
  `<figcaption class="wp-element-caption">Ela Konyardi: &#8220;I wanted to create an environment where everyone could feel that they belonged.&#8221;</figcaption>` +
  `</figure>\n<!-- /wp:image -->`;

function buildBody(logoUrl, logoW, logoH) {
  return [
    `<p class="standfirst"><em>Ela Konyardi spent nearly twenty years in other people&#8217;s nurseries before starting her own in Kingsbury in 2022, and won Community Support of the Year at the Nursery World Awards this month. She talks about the barriers she met on the way, why her early years degree has been worth more than her MBA, and what buying a 22-year-old nursery taught her about patience.</em></p>`,

    companyCard(logoUrl, logoW, logoH),

    P(
      `Four years after starting on her own, Ela Konyardi runs two settings, employs a team across both, and has an award on the shelf that arrived four days before we published this. She answered our seven questions in writing, and the answers below are her own words.`
    ),

    H("Going it alone after twenty years"),
    P(`We asked what made her stop working for other people.`),
    Q(
      `After working across different organisations for many years, I reached a point where I felt I could make a greater impact by creating something of my own. Throughout my career, I was fortunate to meet people who believed in me, mentored me and gave me opportunities, and I remain very grateful for that.<br><br>At times, however, I felt that budgets, resources and organisational limitations prevented me from delivering the environment and opportunities I wanted for children and families. I also experienced occasions where being an immigrant with an accent presented additional barriers.<br><br>I naturally connected with families and teams from diverse backgrounds, and I wanted to create an environment where everyone could feel that they belonged and that their potential was not limited.`
    ),

    portraitBlock("PORTRAIT_URL"),

    P(
      `The business she built is a two-person operation at the top, and the second person has a day job.`
    ),
    Q(
      `My husband, Sebastian, saw my passion and supported me to pursue the dream. Enchanted Lands is very much a husband-and-wife business. Sebastian has more than 25 years' experience in construction and civil engineering and continues in his professional career, while supporting Enchanted Lands outside operating hours. He oversees areas including premises, maintenance and refurbishment.`
    ),
    P(
      `That is worth pausing on. Premises, maintenance and refurbishment are the line items that most often go wrong for a small group, and Enchanted Lands has that expertise in-house, unpaid, and available in the evenings. It is not a model every owner can copy, but it explains how a two-site group absorbs work that others put out to contract.`
    ),
    Q(
      `Enchanted Lands in my vision is &#8220;Beyond limits &#8211; everything is possible.&#8221; In many ways, we are living proof of that, and our mission is to instil the same belief in every child, family and team member.`
    ),

    H("The degree that beat the MBA"),
    P(
      `Konyardi holds an MBA as well as her early years qualifications. We asked which one has actually earned its keep, expecting the business degree to win.`
    ),
    Q(
      `Without a doubt, my BA (Hons) Early Years Education and Leadership in Practice achieved at Kingston University 2015, has been the most useful qualification for running a childcare business.<br><br>It gave me a much deeper understanding of the early years practice, leadership, working with families and the wider responsibilities of the profession and the sector. My MBA has complemented that knowledge, particularly from a business perspective, but my early years degree has been the foundation of what I do.`
    ),
    P(
      `For anyone weighing a management course against a sector qualification before <a href="${ND}/how-to-open-a-nursery-in-england-real-costs-step-by-step/">opening a setting</a>, that is a useful steer from someone who has paid for both.`
    ),

    H("Three months to break-even"),
    P(`We asked how long Kingsbury took to cover its costs, and whether that was the plan.`),
    Q(
      `Kingsbury reached break-even within around three months, which was broadly in line with our expectations.<br><br>Being a smaller setting with a smaller team meant that we were able to maintain close control of our budget, staffing and expenditure from the outset.`
    ),
    P(
      `The lever she names is structural rather than clever. A small setting has fewer staff to carry through a thin first quarter and a shorter distance to travel to full occupancy, and occupancy is the number that decides almost everything else, including what the business is eventually worth. Our interview with valuer Owen Froebel covers <a href="${ND}/owen-froebel-nursery-occupancy-of-80-still-cuts-sale-offers/">how far short of a sale price an under-occupied setting falls</a>.`
    ),

    H("What buying a 22-year-old nursery taught her"),
    P(
      `The second setting in Abbots Langley is not a build. Enchanted Lands acquired Early Adventures, a nursery that had been trading in the community for 22 years.`
    ),
    Q(
      `It is still very early days, as we have only recently acquired Early Adventures, so I think I am still learning this one!<br><br>The acquisition process has certainly taught me a lot about patience. Having a third party involved, particularly in relation to the leasehold and landlord, added another layer to the transaction and meant that some decisions were outside our control.<br><br>Our first acquisition was more straightforward because the business owner also owned the building, so the decision-making process was much simpler.`
    ),
    P(
      `Freehold against leasehold is the single biggest difference between two nursery deals that otherwise look the same on paper. A seller who owns the building can agree terms alone; a leasehold deal puts a landlord with no stake in the outcome into the middle of the timetable. It also changes the price, which our guide to <a href="${ND}/how-much-is-a-nursery-worth-multiples-places-and-prices/">what a nursery is worth</a> sets out in multiples and per-place terms.`
    ),

    H("What the award actually changed"),
    P(
      `Enchanted Lands went into the 2026 awards season with shortlistings at both the Nursery World Awards and the NMT Awards. On 26 September it won.`
    ),
    Q(
      `We are incredibly proud to have won Community Support of the Year at the Nursery World Awards 2026 on 26 September. We are especially proud of the team who have supported us throughout this journey, particularly our Operations Manager, whose commitment, unconditional support and belief in me have been such an important part of our journey.`
    ),
    P(`We asked whether any of it shows up commercially.`),
    Q(
      `The awards have not transformed the business overnight, but over time they have helped to build our reputation and visibility within the community. We now receive direct recruitment enquiries and interest from families who may not have known about us in our earlier years.<br><br>More importantly, the recognition gives us an opportunity to showcase our pedagogical approach to teaching and learning, and the relationships we build with children and families.`
    ),
    P(
      `Direct recruitment enquiries is the part worth noting. Entering awards is usually justified as parent-facing marketing, but for a group competing for qualified staff in London, an inbound candidate who already knows the name is the harder thing to buy.`
    ),

    H("The part nobody warns you about"),
    P(`Every subject gets asked what the job is really like. Konyardi did not reach for a hard-luck story.`),
    Q(
      `Probably the bureaucracy!<br><br>I genuinely enjoy supporting children, families and our team, and seeing the impact of that work over weeks, months and years. I also love developing environments and learning spaces for children, supporting staff to develop professionally, and encouraging people to believe in themselves.<br><br>If I had to choose the least glamorous part, it would be navigating the administration around funding and the constant changes to government requirements. I understand why the sector needs strong regulation because we work with vulnerable children, and I fully support that. It is the layers of bureaucracy and constantly changing processes that can sometimes be challenging.`
    ),
    P(
      `The funding administration is the reliable complaint across this sector, and it is not only volume but variation: what a setting is paid per funded hour depends on which council it sits in, as our <a href="${ND}/early-years-funding-rates-2026-27-what-every-council-pays/">2026-27 rates table</a> shows. A group with settings in two authorities runs two versions of the same paperwork.`
    ),

    H("Where Enchanted Lands goes next"),
    Q(
      `Acquiring Early Adventures marks an exciting new chapter for Enchanted Lands and gives us the opportunity to build on a strong existing nursery with 22 years of history in the community.<br><br>We want to continue growing thoughtfully and sustainably, focusing on quality rather than simply scale. If the right opportunities arise, we will consider them, but growth will never come at the expense of quality.<br><br>As a family-founded and privately owned nursery group, we are committed to continually learning, improving and challenging ourselves to do better. Ultimately, our aim is to create exceptional early childhood environments where children, families and our teams can flourish.`
    ),

    `<p><em>Meet the Manager is Nursery Daily&#8217;s series with the people running early years settings. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a setting and would like to take part, write to <a href="mailto:press@nurserydaily.com">press@nurserydaily.com</a>.</em></p>`,
  ].join("\n\n");
}

// ---- gate ----
const probe = buildBody("LOGO", 600, 547);
const outsideQuotes = probe.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
const plain = probe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
// House no-dash rule applies to OUR copy; her verbatim quotes keep her punctuation.
if (/[\u2014\u2013]|&#8212;/.test(outsideQuotes + SEO_TITLE + META + ALT + CAPTION)) problems.push("dash in our copy");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
if (!/franchise-eyebrow/.test(EYEBROW) && !EYEBROW.endsWith(":")) problems.push("eyebrow needs a colon");
// Every quote must match her document exactly.
const SOURCE = fs.readFileSync(`${D}/answers.txt`, "utf8");
const quotes = [...probe.matchAll(/<blockquote[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
const norm = (x) =>
  x
    .replace(/<br>\s*<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8211;/g, "\u2013")
    .replace(/\s+/g, " ")
    .trim();
const src = norm(SOURCE);
for (const q of quotes) {
  const n = norm(q);
  if (!src.includes(n)) problems.push(`QUOTE NOT VERBATIM: ${n.slice(0, 90)}...`);
}
console.log(`quotes checked: ${quotes.length} | seo title ${SEO_TITLE.length} | meta ${META.length} | words ${plain.split(" ").length}`);
for (const f of [HERO, PORTRAIT, LOGO]) if (!fs.existsSync(f)) problems.push(`missing image ${f}`);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
}

if (!APPLY) {
  console.log("DRY RUN, gate passed, nothing written. add --apply");
  process.exit(0);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const sshArgs = [
  "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
  "-o", "BatchMode=yes",
  "-p", String(s.port || 18765),
  `${s.username}@${s.host}`,
];
const ssh = (cmd, input) =>
  execFileSync("ssh", [...sshArgs, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const stamp = Date.now();
function importMedia(file, remoteName, title, extra = "", caption = "") {
  ssh(`base64 -d > /tmp/${remoteName}`, fs.readFileSync(file).toString("base64"));
  const id = Number(
    wp(
      `media import /tmp/${remoteName} --post_id=${POST_ID} --title=${sq(title)} --alt=${sq(ALT)} ` +
        (caption ? `--caption=${sq(caption)} ` : "") +
        `${extra} --porcelain`
    )
  );
  ssh(`rm -f /tmp/${remoteName}`);
  return { id, url: wp(`post get ${id} --field=guid`) };
}

console.log(`status before: ${wp(`post get ${POST_ID} --field=post_status`)}`);

const hero = importMedia(HERO, `ela-hero-${stamp}.jpg`, "Ela Konyardi, Enchanted Lands Day Nursery", "--featured_image", CAPTION);
const portrait = importMedia(PORTRAIT, `ela-portrait-${stamp}.jpg`, "Ela Konyardi portrait");
const logo = importMedia(LOGO, `enchanted-lands-logo-${stamp}.png`, "Enchanted Lands Day Nursery logo");
console.log(`hero ${hero.id}, portrait ${portrait.id}, logo ${logo.id}`);

const BODY = buildBody(logo.url, 600, 547).replace("PORTRAIT_URL", portrait.url);
const TITLE_HTML = `<span class="franchise-eyebrow">${EYEBROW}</span> ${HEADLINE}`;

ssh(`base64 -d > /tmp/ela-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
wp(
  `post update ${POST_ID} /tmp/ela-body-${stamp}.html --post_title=${sq(TITLE_HTML)} ` +
    `--post_name=${SLUG} --post_excerpt=${sq(META)} --post_author=${AUTHOR_ID} ` +
    `--post_category=${CATEGORY_ID} --post_status=draft`
);
ssh(`rm -f /tmp/ela-body-${stamp}.html`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

console.log(`title:  ${wp(`post get ${POST_ID} --field=post_title`)}`);
console.log(`status: ${wp(`post get ${POST_ID} --field=post_status`)}`);
console.log(`thumb:  ${wp(`post meta get ${POST_ID} _thumbnail_id`)}`);
console.log(`slug:   ${wp(`post get ${POST_ID} --field=post_name`)}`);

const art = await prisma.article.findUnique({ where: { id: "cmuntr81b00011mngmmgsvag7" } }).catch(() => null);
if (art) {
  const { forSite } = await import("../lib/prisma.js");
  await forSite(site.id).article.update({
    where: { id: art.id },
    data: {
      title: SEO_TITLE,
      body: BODY,
      metaDesc: META,
      keyphrase: KEYPHRASE,
      category: "News",
      imageAlt: ALT,
      imageCredit: "Picture: Enchanted Lands Day Nursery",
      imageSource: "interview:subject-supplied",
      qaPassed: true,
      qaReport: JSON.stringify({ verdict: "hand-written from the subject's returned answers, quotes verified verbatim" }),
    },
  });
  console.log("Article row updated", art.id);
}
await prisma.$disconnect();
