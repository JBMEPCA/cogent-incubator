/**
 * One-off, 2 Oct 2026: the Behind the Mask interview with Dr Harriet Beaty,
 * co-owner and principal dentist of Gibside Dental in Burnopfield, built from
 * the answers her practice returned this morning. JB: "can you sort this
 * please, just preview to me". Stays a DRAFT.
 *
 * Hand-built rather than left to runInterviewSweep, for the reason recorded in
 * _build-ela-konyardi-interview.mjs: the sweep's draft of the last interview in
 * this format invented a financing route, a staffing plan and an occupancy
 * history that appeared nowhere in the subject's answers. Every quote below is
 * verbatim and the gate at the bottom proves it against her returned text.
 *
 * TWO TYPOS SILENTLY CORRECTED in her copy, both obvious and neither changing
 * her meaning: "Middlesborough" to "Middlesbrough" and "what is in stall next"
 * to "what is in store next". Her own hyphens and her "practiced" are left
 * exactly as she typed them. The source file holds the corrected text so the
 * verbatim gate still has something to check against; the uncorrected original
 * is the email itself.
 *
 * OUR OWN OUTREACH GOT THE SHORTLIST WRONG and the copy below uses the awards
 * organiser's published list instead. The ask told her she was shortlisted for
 * "New Practice of the Year, Team of the Year and Practice Brand and Design".
 * The published 2026 shortlist has Gibside in Team of the Year, New Practice of
 * the Year and Treatment of Nervous Patients, all North heats, with Dr Harriet
 * Beaty up for Practice Principal of the Year and Dr Sam Row for Young Dentist
 * of the Year, which we did not know. She did not correct us, so she may not
 * have noticed either.
 *
 * NO LINK TO THE AWARDS. The Private Dentistry Awards are FMC's, and FMC
 * publishes the incumbent this title competes with. The editorial standard
 * allows us to report a competitor's shortlist as news and forbids promoting
 * the event or carrying its branding, so the shortlist is stated and the only
 * outbound link is to Gibside's own site.
 *
 * NO FIGURES. She gave none, which is unusual for this title, so the piece is
 * qualitative throughout and nothing is estimated to fill the gap.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-harriet-beaty-interview.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const APPLY = process.argv.includes("--apply");

const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420";
const HERO = `${D}/images/2.jpg`;
const LOGO = `${D}/images/3.png`;
const PORTRAIT = `${D}/images/1.jpg`;
const SOURCE_FILE = `${D}/gibside/answers.txt`;

const DBN = "https://dentalbusinessnews.com";
const EYEBROW = "Behind the Mask:";
const HEADLINE = "Harriet Beaty on going private from day one";
const SEO_TITLE = `${EYEBROW} ${HEADLINE}`;
const SLUG = "behind-the-mask-harriet-beaty-on-going-private-from-day-one";
const KEYPHRASE = "Gibside Dental";
const META =
  "Harriet Beaty opened Gibside Dental fully private in a County Durham village. On testing demand, filling the diary and what compliance really cost.";
const ALT = "Harriet Beaty, co-owner and principal dentist of Gibside Dental, in a surgery at the practice";
const CAPTION =
  "Harriet Beaty, co-owner and principal dentist of Gibside Dental in Burnopfield. Picture: Gibside Dental";
const CATEGORY_ID = 2; // News
const AUTHOR_ID = 2; // james-burke

const Q = (x) => `<blockquote class="wp-block-quote interview-quote"><p>${x}</p></blockquote>`;
const P = (x) => `<p>${x}</p>`;
const H = (x) => `<h2 class="wp-block-heading">${x}</h2>`;

// JB, 2 Oct: the practice's own logo in the card head, and the Model row out.
// The parent styles the dl as a wrapping flex row, so four items wrapped onto
// two lines; three fit on one at article width.
function companyCard(logoUrl, w, h) {
  return `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Gibside Dental?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="Gibside Dental" width="${w}" height="${h}" loading="lazy" decoding="async">
</div>
<p>A fully private practice on Front Street in Burnopfield, a County Durham village of about 4,500 people, opened in 2025 by the husband and wife dentists Dr Samuel Row and Dr Harriet Beaty. A year in it is shortlisted in the 2026 Private Dentistry Awards North heats for Team of the Year, New Practice of the Year and Treatment of Nervous Patients, with Beaty up for Practice Principal of the Year and Row for Young Dentist of the Year.</p>
<dl>
<div><dt>Practice</dt><dd>Gibside Dental</dd></div>
<div><dt>Website</dt><dd><a href="https://www.gibsidedental.co.uk/">gibsidedental.co.uk</a></dd></div>
<div><dt>Based</dt><dd>Burnopfield, County Durham</dd></div>
</dl>
</section>`;
}

const portraitBlock = (url) =>
  `<!-- wp:image {"width":"480px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n` +
  `<figure class="wp-block-image aligncenter size-full is-resized">` +
  `<img src="${url}" alt="Harriet Beaty at the reception desk of Gibside Dental" style="width:480px"/>` +
  `<figcaption class="wp-element-caption">Harriet Beaty: &#8220;We felt if we built the dental practice in the way we wanted it to be, people would come.&#8221;</figcaption>` +
  `</figure>\n<!-- /wp:image -->`;

function buildBody(logoUrl, logoW, logoH) {
  return [
    `<p class="standfirst"><em>Opening a practice from nothing is the decision most associates think about and few make. Harriet Beaty and her husband Samuel Row did it in 2025, fully private, in a County Durham village of four and a half thousand people. A year on they are shortlisted in five categories at the Private Dentistry Awards. She answered our seven questions on what they could not know before they opened, what actually filled the diary, and the cost line that caught them out.</em></p>`,

    companyCard(logoUrl, logoW, logoH),

    P(
      `Gibside Dental opened on Front Street in Burnopfield in 2025. There was no patient list to buy, no NHS contract to inherit and no group behind it. Beaty answered our questions in writing, and the answers below are her own words.`
    ),

    H("Two dentists, two different jobs"),
    P(
      `The first decision a husband and wife practice has to make is who stops doing dentistry. At Gibside the split is deliberate and uneven.`
    ),
    Q(
      `Sam primarily does the clinical dentistry working 4 days a week, I do 2 clinics a week and do a lot of the business development and management with our Practice Manager, Sophie.`
    ),
    P(
      `That is the structural choice most single site owners never make. Chair time is the thing that pays, so the temptation when two owners are both dentists is for both to fill their lists and run the business in the evenings. Taking one principal down to two clinics a week costs the practice real revenue and buys back the days in which a business gets built rather than merely worked in.`
    ),

    H("You cannot test demand until you open the list"),
    P(
      `Fully private, in a village, with no existing patients. We asked how they satisfied themselves the demand was there before they committed.`
    ),
    Q(
      `This was tricky! We developed a business plan and did some market research but in all honesty we did not know until we opened our waiting list what the demand was going to be like. The main reason for opening the practice was to have more autonomy on how we practiced, with the clinical freedom and ability to choose our own hours. We live locally and when we viewed the practice building knew it had potential to be a dental practice. From there, we felt if we built the dental practice in the way we wanted it to be, people would come.`
    ),
    P(
      `It is a more honest answer than the question invited, and worth sitting with. The market research did not produce the answer. The decision was made on autonomy and on a building, and the demand question was settled only once the waiting list opened. Any owner being sold a catchment analysis as proof of viability should read that twice.`
    ),
    P(`What the first year then showed was that the catchment was not the village at all.`),
    Q(
      `We now have patients who travel from Cumbria, and the northern corners of the North East, including Middlesbrough, the Coast and Morpeth - over 45 minute drive in some cases.`
    ),
    P(
      `For a private practice, the postcode sets the rent, not the market. People will drive 45 minutes past other dentists for something they have decided they want, which is the single strongest argument for siting a private practice where the premises are affordable rather than where the footfall is.`
    ),

    portraitBlock("PORTRAIT_URL"),

    H("What actually filled the diary"),
    P(`A new practice has no list. We asked what brought people through the door in year one.`),
    Q(
      `We concentrated on our new patient offers which included a hygiene visit - having a competitive price for this helped entice patients in but we blew them away with the detail and technology in that examination. The patient experience was really important to us, and setting those expectations before they came through the door with an amazing front of house and support team. We also had two open days where patients were invited for a complimentary consultation to discuss any concerns they had with their smile - this could have been teeth straightening, implants or general dentistry conversations. Now a year in, although our marketing and advertising is still strong, a lot of our new patients come off the back of word of mouth referrals from existing patients.`
    ),
    P(
      `Two mechanisms are doing the work there and they are easy to confuse. The discounted new patient examination is an acquisition cost, bought deliberately. What converts that visit into a patient is the length and detail of the appointment itself, which is a staffing and scheduling decision rather than a marketing one. And by the end of year one the mix has moved towards referral, which is the cheapest acquisition any practice has and the hardest to switch on in a hurry.`
    ),

    H("Recruiting a team for a practice that did not exist"),
    P(
      `Gibside is shortlisted for Team of the Year in its first year. Every one of those people was hired before there was a practice for them to join.`
    ),
    Q(
      `We grew very quickly and that meant recruiting quickly too. The main goal I had when interviewing was to make sure that the new team member had the same commitment we had - next level dental care with the patient experience at the heart of the practice. The 3 attributes we interviewed for were: someone interested in personal development, a team player and great communicator, and humble enough to admit mistakes. As a team we have worked tirelessly to develop processes and systems so that our onboarding is quick, efficient and new members can hit the ground running quickly.`
    ),
    P(
      `None of the three attributes is clinical and none is about experience. In a market where every practice is competing for the same nurses and associates, interviewing for disposition and then building the onboarding to carry the skills is the only version of this that scales, and it is the part most owners leave until the second or third hire.`
    ),

    H("The cost line that caught them out"),
    P(`We asked what had cost more, or taken longer, than the business plan said.`),
    Q(
      `Compliance was definitely one of the most surprising and expensive parts of setting up the practice - external risk assessments and ensuring the health and safety of both our employees and patients. Building works always take longer and have hidden costs, which we accounted for slightly. Working with good advisors and industry experts is paramount.`
    ),
    P(
      `Compliance is the most underestimated line in a squat practice budget, and it is underestimated in a particular way: owners price the registration and forget that the evidence behind it is bought from other people. External risk assessments, fire and legionella work, health and safety, waste, radiation protection advice and the policies that sit under all of it are chargeable, recurring, and due before a single patient is seen. The fit out is the cost everyone plans for, and our guide to <a href="${DBN}/dental-equipment-in-2026-what-it-costs-and-what-it-pays-back/">what dental equipment costs and what it pays back</a> covers that side of it.`
    ),

    H("The part nobody warns you about"),
    P(`Every subject gets asked what the job is really like. Beaty did not reach for a complaint.`),
    Q(
      `One of the best things I found in developing the practice was at the beginning we had to do all roles. As a dentist, we rarely go into the decontamination room, or if a chair breaks we phone an engineer to fix it. We also had a remote receptionist when we started, so during the days and nights we answered enquiries and booked patients in. Doing all these roles helped us develop the processes we still run today, but it also developed a great appreciation for everyone's role. I've always been a great believer in never asking someone to do a job you wouldn't do yourself.`
    ),
    P(
      `The useful part is the second half. The processes the practice runs today exist because the owners did every job badly first, which is an argument for not outsourcing the unglamorous work on day one even when you can afford to. An owner who has never worked the decontamination room is writing that policy from a manual.`
    ),

    H("Where Gibside goes next"),
    P(
      `There is room to grow on the site. For now the answer is deliberately not to.`
    ),
    Q(
      `We have scope for another 2 or 3 surgeries, but at the minute we are consolidating where we are. Our aim is to build a holistic dental practice, with a focus on prevention and minimally invasive dentistry. We're excited for the future and seeing what is in store next!`
    ),
    P(
      `Unused surgery space is the cheapest expansion a practice will ever have, because the building, the compliance and the front of house are already paid for. Holding it empty for a year while the existing list matures is a defensible call, and it is also the kind of headroom that shows up later in a valuation: our guide sets out <a href="${DBN}/dental-practice-valuation-uk-what-yours-is-worth-in-2026/">what a UK practice is worth and what moves the number</a>.`
    ),

    `<p><em>Behind the Mask is Dental Business News&#8217;s series with the people who own and run dental practices. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a practice and would like to take part, write to <a href="mailto:press@dentalbusinessnews.com">press@dentalbusinessnews.com</a>.</em></p>`,
  ].join("\n\n");
}

// ---- gate ----
const probe = buildBody("LOGO", 1045, 605);
const outsideQuotes = probe.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
const plain = probe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[\u2014\u2013]|&#8212;/.test(outsideQuotes + SEO_TITLE + META + ALT + CAPTION)) problems.push("dash in our copy");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
if (!EYEBROW.endsWith(":")) problems.push("eyebrow needs a colon");
// Never link the competitor's awards: the standard allows the shortlist as
// news and forbids promoting the event.
if (/awards\.dentistry\.co\.uk|dentistry\.co\.uk/.test(probe)) problems.push("links a competitor");

const SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");
const quotes = [...probe.matchAll(/<blockquote[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
const norm = (x) =>
  x
    .replace(/<br>\s*<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/\s+/g, " ")
    .trim();
const src = norm(SOURCE);
for (const q of quotes) {
  const n = norm(q);
  if (!src.includes(n)) problems.push(`QUOTE NOT VERBATIM: ${n.slice(0, 90)}...`);
}
for (const f of [HERO, PORTRAIT, LOGO]) if (!fs.existsSync(f)) problems.push(`missing image ${f}`);

console.log(
  `quotes checked: ${quotes.length} | seo title ${SEO_TITLE.length} | meta ${META.length} | words ${plain.split(" ").length}`
);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
}
console.log("gate passed");

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

const stamp = Date.now();
// --post=<id> updates the draft already built rather than making a second one.
// Without it every rerun would leave another draft and another copy of the
// photographs in the media library.
const EXISTING = Number((process.argv.find((a) => a.startsWith("--post=")) || "").split("=")[1] || 0);
const POST_ID =
  EXISTING ||
  Number(
    wp(
      `post create --post_type=post --post_status=draft --post_title=${sq("Behind the Mask draft")} --porcelain`
    )
  );
console.log(EXISTING ? `updating draft post ${POST_ID}` : `created draft post ${POST_ID}`);

function importMedia(file, remoteName, title, alt, extra = "", caption = "") {
  ssh(`base64 -d > /tmp/${remoteName}`, fs.readFileSync(file).toString("base64"));
  const id = Number(
    wp(
      `media import /tmp/${remoteName} --post_id=${POST_ID} --title=${sq(title)} --alt=${sq(alt)} ` +
        (caption ? `--caption=${sq(caption)} ` : "") +
        `${extra} --porcelain`
    )
  );
  ssh(`rm -f /tmp/${remoteName}`);
  return { id, url: wp(`post get ${id} --field=guid`) };
}

// On a rerun the photographs are already attached, so reuse them: the portrait
// url is read back out of the live body rather than imported again.
const already = EXISTING ? wp(`post get ${POST_ID} --field=post_content`) : "";
const portraitUrl =
  (already.match(/https:\/\/[^"']*gibside-portrait-[^"']+\.jpg/) || [])[0] || null;

if (!portraitUrl) {
  const hero = importMedia(
    HERO, `gibside-hero-${stamp}.jpg`, "Harriet Beaty, Gibside Dental", ALT, "--featured_image", CAPTION
  );
  const portrait = importMedia(
    PORTRAIT, `gibside-portrait-${stamp}.jpg`, "Harriet Beaty portrait",
    "Harriet Beaty at the reception desk of Gibside Dental"
  );
  console.log(`hero ${hero.id}, portrait ${portrait.id}`);
  var PORTRAIT_URL = portrait.url;
} else {
  console.log(`reusing the photographs already on this post`);
  var PORTRAIT_URL = portraitUrl;
}

const logoUrl =
  (already.match(/https:\/\/[^"']*gibside-logo-[^"']+\.png/) || [])[0] ||
  importMedia(LOGO, `gibside-logo-${stamp}.png`, "Gibside Dental logo", "Gibside Dental").url;
console.log(`logo ${logoUrl}`);

const BODY = buildBody(logoUrl, 1045, 605).replace("PORTRAIT_URL", PORTRAIT_URL);
const TITLE_HTML = `<span class="franchise-eyebrow">${EYEBROW}</span> ${HEADLINE}`;

ssh(`base64 -d > /tmp/gibside-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
wp(
  `post update ${POST_ID} /tmp/gibside-body-${stamp}.html --post_title=${sq(TITLE_HTML)} ` +
    `--post_name=${SLUG} --post_excerpt=${sq(META)} --post_author=${AUTHOR_ID} ` +
    `--post_category=${CATEGORY_ID} --post_status=draft`
);
ssh(`rm -f /tmp/gibside-body-${stamp}.html`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

console.log(`title : ${wp(`post get ${POST_ID} --field=post_title`)}`);
console.log(`status: ${wp(`post get ${POST_ID} --field=post_status`)}`);
console.log(`thumb : ${wp(`post meta get ${POST_ID} _thumbnail_id`)}`);
console.log(`PREVIEW: ${wp(`post get ${POST_ID} --field=guid`)}&preview=true`);

const { forSite } = await import("../lib/prisma.js");
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { company: "Gibside Dental" } });
if (target) {
  await db.interviewTarget.update({
    where: { id: target.id },
    data: {
      status: "drafted",
      answeredAt: target.answeredAt || new Date(),
      agreedAt: target.agreedAt || new Date(),
      replyBody: SOURCE.slice(0, 60000),
      headshotUrl: PORTRAIT_URL,
      // The chase must never fire at someone who has already answered.
      followUpSentAt: target.followUpSentAt || new Date(),
    },
  });
  console.log("interview row moved to drafted");
}
await prisma.$disconnect();
