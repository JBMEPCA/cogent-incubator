/**
 * The Behind the Mask interview with David Drew, owner and co-founder of The
 * Dental Barns, built from the answers he emailed on 2 October 2026.
 *
 * IT OVERWRITES POST 211 AND SETS IT BACK TO DRAFT, which is the urgent part.
 *
 * Post 211 is live now and it is invented. runInterviewSweep drafted it on 2
 * October at 18:07, about an hour after his answers arrived, used almost none
 * of them, and it published itself on 4 October at 07:35. Every one of its
 * twelve quotations was checked against his email and not one appears there.
 * It also puts the practice in Hampshire rather than Lichfield, calls him the
 * principal dentist, and says he "has never employed a practice manager" when
 * he IS the practice manager. It names four software products he never
 * mentioned and links out to two of them.
 *
 * Reusing the same post id rather than publishing a second article keeps
 * InterviewTarget.articleId honest and means there is one page, not two. The
 * slug changes because the old one asserts the false premise.
 *
 * EVERY QUOTE IS VERBATIM and the gate below proves it against his email,
 * including the em dashes inside his answer to question three, which are his
 * punctuation and not ours. The no-dash house rule is applied to OUR copy only.
 *
 * Facts checked against the practice's own site rather than our outreach,
 * because our outreach has been wrong before and that is how this started:
 *   - Dr Keely Thorne is the Principal Dentist; David Drew is Owner and
 *     Co-Founder, and by his own account the practice manager.
 *   - Blackbrook Barns, London Road, Lichfield, Staffordshire. Private only.
 *   - He is the only man on the team page, which is how the supplied
 *     photograph was identified as him.
 *
 * NO LINK TO THE AWARDS. The Dental Awards are The Probe's and the Dentistry
 * Awards are FMC's, who publish the incumbent. The standard lets us report a
 * competitor's shortlist as news and stops us promoting the event.
 *
 * HE ASKED FOR A BACKLINK and the company card carries one to
 * thedentalbarns.co.uk, which is our normal practice anyway.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-david-drew-interview.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const APPLY = process.argv.includes("--apply");
const POST_ID = 211;
const ARTICLE_ID = "cmur7v4tq0001t33vjkanlgqw";

const D = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/ab747c79-736f-42fc-8062-1a21d89ca420";
const SOURCE_FILE = `${D}/drew/answers.txt`;
const HERO = `${D}/images/17.jpg`;

const DBN = "https://dentalbusinessnews.com";
const EYEBROW = "Behind the Mask:";
const HEADLINE = "David Drew on what £55,000 of kit bought";
const SEO_TITLE = `${EYEBROW} ${HEADLINE}`;
const SLUG = "behind-the-mask-david-drew-the-dental-barns";
const KEYPHRASE = "The Dental Barns";
const META =
  "David Drew co-owns The Dental Barns and manages it. On a £55,000 doc station, a listed barn running on Starlink, and the hire you let go anyway.";
const ALT = "David Drew, owner and co-founder of The Dental Barns in Lichfield";
const CAPTION = "David Drew, owner and co-founder of The Dental Barns. Picture: The Dental Barns";
const CATEGORY_ID = 2; // News
const AUTHOR_ID = 2; // james-burke

const Q = (x) => `<blockquote class="wp-block-quote interview-quote"><p>${x}</p></blockquote>`;
const P = (x) => `<p>${x}</p>`;
const H = (x) => `<h2 class="wp-block-heading">${x}</h2>`;

function companyCard() {
  return `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are The Dental Barns?</h2>
</div>
<p>A private practice in converted Grade II listed barns at Blackbrook, on the London Road outside Lichfield, co-founded by David Drew and the principal dentist Dr Keely Thorne. No NHS contract. Drew was highly commended as Practice Manager of the Year at the 2026 Dental Awards, having been named the UK's best practice manager the year before.</p>
<dl>
<div><dt>Practice</dt><dd>The Dental Barns</dd></div>
<div><dt>Website</dt><dd><a href="https://www.thedentalbarns.co.uk/">thedentalbarns.co.uk</a></dd></div>
<div><dt>Based</dt><dd>Lichfield, Staffordshire</dd></div>
</dl>
</section>`;
}

function buildBody() {
  return [
    `<p class="standfirst"><em>Most practices are run by a principal who also owns them. The Dental Barns splits the job: Dr Keely Thorne does the dentistry, David Drew owns it with her and manages it, and he has been named the UK's best practice manager for doing so. He answered our seven questions on what a manager sees that a principal cannot, what a listed barn costs to make work, and the single purchase that had to earn a new practice its patients&#8217; trust.</em></p>`,

    companyCard(),

    P(
      `Drew came to dentistry from managing people in corporate settings, and co-founded The Dental Barns with Dr Keely Thorne in converted barns outside Lichfield. He answered our questions in writing, and the answers below are his own words.`
    ),

    H("Owning it and running it are two jobs"),
    P(
      `We asked how he switches between the two. His answer is about deliberately removing himself from things.`
    ),
    Q(
      `For me, it comes down to delegation and genuinely trusting the team. When something isn&#8217;t done quite as I would have done it, I have to resist the urge to step in and fix it. With everyday operational tasks, giving someone space to learn, then supporting them with feedback, is often more valuable than taking over.<br><br>In the early years, I deliberately looked for my own bottlenecks: what kept taking up my time, and could a better process, a system or delegation resolve it? Creating that space has allowed me to spend more time thinking about where the business is going. If every decision still needs me, there is more work to do.`
    ),
    P(
      `That last line is the test, and it is a harder one than it sounds. Hunting your own bottlenecks means accepting that the thing slowing the practice down is often you, and an owner who is also the busiest person in the building rarely has the distance to notice.`
    ),

    H("What a manager sees that a principal cannot"),
    P(
      `This is the part that makes the split worth it, and it is the clearest argument we have heard for employing a manager rather than absorbing the job.`
    ),
    Q(
      `I can only speak from my own experience, but I think the biggest contribution is perspective. A principal delivering clinical care has patients, clinical decisions and the pressures of that day competing for their attention. A practice manager has the opportunity—and responsibility—to step back and look across the whole business.<br><br>That distance helps me separate an isolated difficult moment from a recurring problem that needs a wider solution. It also creates room to think about the next six or twelve months. Keely and I bring different perspectives, and the quality of our decisions comes from putting those together.`
    ),
    P(
      `The distinction he draws, between a bad day and a pattern, is the one most single-handed owners get wrong, because between patients everything looks like a bad day. A principal with a full list is not avoiding that thinking out of laziness. There is simply nowhere in the day it can happen.`
    ),

    H("A listed barn, on Starlink"),
    P(
      `The setting is the practice&#8217;s best-known feature. It is also a building that had to be made to work.`
    ),
    Q(
      `A Grade II listed barn brings practical challenges. We needed power upgrades, reliable connectivity and ways to heat and cool an older building effectively. We now have Starlink and 5G working together, for example, to give us resilience if one connection fails.<br><br>We started with an empty space, which gave us the opportunity to plan ahead and build many of those solutions into the fit-out.<br><br>For patients, the setting has become one of our biggest strengths: easy parking, privacy, peace and quiet. All of that contributes to how people feel about coming to see us. The experience starts when they arrive on site, before they have even stepped through the door.`
    ),
    P(
      `Two satellite and mobile connections running together is not a rural eccentricity. A modern practice with digital scanning, imaging and cloud software stops entirely when the line drops, and a listed building in open countryside cannot simply order a second fibre circuit. The cost of that redundancy belongs in the fit-out budget of anyone looking at a conversion rather than a high street unit.`
    ),

    H("The £55,000 that had to earn trust"),
    P(`We asked which investment has paid back most clearly. He named a figure.`),
    Q(
      `Our &#8220;doc station&#8221;, which cost approximately £55,000, stands out. It has become the cornerstone of our consultations and has played a significant role in building patient trust.<br><br>As a new practice, we had to earn that confidence from the outset, particularly when people were considering substantial treatment plans. The station supports the time we spend explaining findings and discussing options, helping patients understand what we are recommending and why.<br><br>We have seen a high level of commitment from new patients. I would not attribute that to one piece of equipment alone, but it has been central to our consultation approach.`
    ),
    P(
      `Worth noting what he does not claim. He stops short of crediting the kit with the conversion rate, and says so explicitly. What he is describing is a consultation that takes longer and shows the patient more, which the equipment makes possible rather than causes. For an owner weighing a capital purchase of that size on a treatment-plan business, the question it raises is how much of the payback is the machine and how much is the chair time around it.`
    ),

    H("The hire you let go anyway"),
    P(`The hardest staffing decision, and it is not the one about underperformance.`),
    Q(
      `The hardest decisions involve people who are exceptionally capable at their job but whose attitude or values do not align with the business.<br><br>I managed people in corporate settings before dentistry, and that challenge is familiar across both. Strong performance can make you hesitate to address behaviour, particularly when someone has skills you would find difficult to replace. But the effect on the wider team still matters.<br><br>You have to be clear about expectations and give people a fair opportunity to respond. Sometimes, though, protecting the team and the culture means accepting the loss of a very skilled person.`
    ),
    P(
      `In a sector where every practice is competing for the same nurses, hygienists and associates, letting a skilled one go is a materially more expensive decision than it is in most businesses. That is precisely why it gets avoided.`
    ),

    H("Cleaning the toilets is management information"),
    P(`Every subject gets asked what the job is really like. Drew rejected the question.`),
    Q(
      `I have never really divided the job into glamorous and unglamorous parts. My leadership style is fairly hands-on, with a flat hierarchy, and I think getting involved is one of the best ways to understand how a business actually works.<br><br>That might mean working out a better process for cleaning the toilets, trying it yourself and then training someone else to do it consistently. There is useful management information in those everyday jobs: unclear responsibilities, missing equipment, gaps in training.<br><br>Being willing to do the work yourself helps you set realistic expectations for everyone else.`
    ),
    P(
      `The reframing is the useful bit. He is not describing muck-in willingness as a virtue, he is describing it as a diagnostic: the jobs nobody owns are where you find the unclear responsibilities and the missing kit.`
    ),

    H("Where The Dental Barns goes next"),
    P(`Growth, but the specific ambition is not another building.`),
    Q(
      `We have growth ambitions, but the pace has to protect the quality of care and the patient experience.<br><br>Our immediate focus is automation: taking repetitive administration off the team so we can do more with the people we already have. I am a big believer that people should spend their time with people. Systems should help create that time.<br><br>Longer term, I would love to develop a Dental Barns playbook: a clear, tested way of running the practice that another team could use to deliver the same experience elsewhere. That might eventually lead to further locations or some form of franchising. The next step is making sure what we have built can be taught, repeated and sustained.`
    ),
    P(
      `A documented, teachable way of running the place is what separates a practice that can be replicated from one that depends on the two people who built it. It is also, incidentally, what a buyer pays a premium for: our guide sets out <a href="${DBN}/dental-practice-valuation-uk-what-yours-is-worth-in-2026/">what a UK practice is worth and what moves the number</a>.`
    ),

    `<p><em>Behind the Mask is Dental Business News&#8217;s series with the people who own and run dental practices. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a practice and would like to take part, write to <a href="mailto:press@dentalbusinessnews.com">press@dentalbusinessnews.com</a>.</em></p>`,
  ].join("\n\n");
}

// ---- gate ----
const probe = buildBody();
const outsideQuotes = probe.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
const problems = [];
if (/[\u2014\u2013]|&#8212;/.test(outsideQuotes + SEO_TITLE + META + ALT + CAPTION)) problems.push("dash in our copy");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
// Never promote a competitor's awards, and never link them.
if (/the-probe\.co\.uk|dentistry\.co\.uk/.test(probe)) problems.push("links a competitor");
// The backlink he asked for.
if (!/thedentalbarns\.co\.uk/.test(probe)) problems.push("missing the backlink he asked for");

const SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");
const quotes = [...probe.matchAll(/<blockquote[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
const norm = (x) =>
  x
    .replace(/<br>\s*<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const src = norm(SOURCE);
for (const q of quotes) {
  const n = norm(q);
  if (!src.includes(n)) problems.push(`QUOTE NOT VERBATIM: ${n.slice(0, 80)}...`);
}
if (!fs.existsSync(HERO)) problems.push(`missing photograph ${HERO}`);

const plain = probe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log(
  `quotes checked: ${quotes.length} | seo title ${SEO_TITLE.length} | meta ${META.length} | words ${plain.split(" ").length}`
);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
}
console.log("gate passed: every quote is his, nothing links a competitor, his backlink is in");

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  process.exit(0);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
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

console.log(`status before: ${wp(`post get ${POST_ID} --field=post_status`)}`);

const stamp = Date.now();
ssh(`base64 -d > /tmp/drew-${stamp}.jpg`, fs.readFileSync(HERO).toString("base64"));
const mediaId = Number(
  wp(
    `media import /tmp/drew-${stamp}.jpg --post_id=${POST_ID} --title=${sq("David Drew, The Dental Barns")} ` +
      `--alt=${sq(ALT)} --caption=${sq(CAPTION)} --featured_image --porcelain`
  )
);
ssh(`rm -f /tmp/drew-${stamp}.jpg`);
const mediaUrl = wp(`post get ${mediaId} --field=guid`);
console.log(`photograph uploaded as media ${mediaId}`);

const BODY = buildBody();
const TITLE_HTML = `<span class="franchise-eyebrow">${EYEBROW}</span> ${HEADLINE}`;
ssh(`base64 -d > /tmp/drew-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
// Back to draft: the live version is invented and must come down now.
wp(
  `post update ${POST_ID} /tmp/drew-body-${stamp}.html --post_title=${sq(TITLE_HTML)} ` +
    `--post_name=${SLUG} --post_excerpt=${sq(META)} --post_author=${AUTHOR_ID} ` +
    `--post_category=${CATEGORY_ID} --post_status=draft`
);
ssh(`rm -f /tmp/drew-body-${stamp}.html`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

console.log(`status after : ${wp(`post get ${POST_ID} --field=post_status`)}`);
console.log(`title        : ${wp(`post get ${POST_ID} --field=post_title`)}`);
console.log(`slug         : ${wp(`post get ${POST_ID} --field=post_name`)}`);

const { forSite } = await import("../lib/prisma.js");
const db = forSite(site.id);
await db.article.update({
  where: { id: ARTICLE_ID },
  data: {
    title: SEO_TITLE,
    body: BODY,
    metaDesc: META,
    keyphrase: KEYPHRASE,
    category: "News",
    status: "review",
    publishedAt: null,
    imageUrl: mediaUrl,
    imageAlt: ALT,
    imageCredit: "Picture: The Dental Barns",
    imageSource: "interview:subject-supplied",
    qaPassed: true,
    qaReport: JSON.stringify({
      verdict: "hand-written from the subject's returned answers; every quote verified verbatim",
      replaces: "a fabricated auto-draft that published itself on 4 Oct with 12 invented quotations",
    }),
  },
});
const t = await db.interviewTarget.findFirst({ where: { company: "The Dental Barns" } });
if (t) {
  await db.interviewTarget.update({
    where: { id: t.id },
    data: { status: "drafted", headshotUrl: mediaUrl, publishedUrl: null, publishedAt: null, notifiedAt: null },
  });
}
console.log("article and interview rows reset; nothing is live");
await prisma.$disconnect();
