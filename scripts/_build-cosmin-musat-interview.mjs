/**
 * Behind the Mask with Dr Cosmin-Andrei Musat, principal dentist and co-owner of
 * Moyle Dental Care in Larne, built from the answers he emailed on 13 Oct 2026.
 * JB: "Proof to me please". STAYS A DRAFT.
 *
 * IT REWORKS POST 278, which runInterviewSweep drafted on 13 October at 17:20,
 * an hour after his answers arrived. That draft is the David Drew failure again
 * and it is worth recording what it did, because QA passed it at 80 and called
 * it "strong, well-attributed":
 *
 *   - Put the practice in BALLYCASTLE. It is Larne. The engine appears to have
 *     reasoned from the name: Ballycastle sits in the old Moyle district.
 *   - Said he took over in 2019 and grew the list over SIX YEARS. He bought it
 *     in January 2026, nine months ago, which is the entire point of the story.
 *   - Invented all eight quotations. Not one appears in his email.
 *   - Named Dentally as his practice management system and Practice Plan as his
 *     patient plan provider. He named no software and mentioned no patient plan.
 *   - Invented a 60/40 NHS-private split, a £25,000 to £30,000 spend, a
 *     six-month recall campaign, 150 to 200 registrations a year, and a
 *     hygienist, associate and treatment coordinator hired in years two to four.
 *   - Built a four-row software comparison table (Dentally, SOE/Exact, Kiroku,
 *     Practice Plan) and sourced it "interview with Cosmin-Andrei Musat, 2026".
 *   - Added five FAQs restating the invented facts as answers.
 *
 * What QA actually objected to was an unattributed claim about rival plan
 * providers' fee models. It held the draft over a citation and waved through a
 * fabricated practice in the wrong town.
 *
 * Reusing post 278 rather than publishing a second article keeps
 * InterviewTarget.articleId honest and leaves one page, not two.
 *
 * EVERY QUOTE IS VERBATIM. The gate below proves it against his email, and
 * unlike the earlier builders it checks INLINE quotations too, not just
 * blockquotes, because a fabricated half-sentence inside our own paragraph is
 * the same offence in a smaller font.
 *
 * HIS PHOTOGRAPH, NOT A SEARCH. He attached it. After the Gillian Leng story
 * ran a stock picture of a stranger over a release that came with a photo, a
 * supplied image is the only image.
 *
 * NO LINK TO THE AWARDS. The Private Dentistry Awards are FMC's, and FMC
 * publishes the title this one competes with. The standard lets us report a
 * competitor's shortlist as news and stops us promoting the event.
 *
 * THE SHORTLIST IS STATED AS HIS COUNT. He says five categories and confirmed
 * New Practice and Most Improved by answering a question premised on them. Our
 * own outreach also claimed Practice Principal of the Year for him, and that is
 * left out: outreach got Harriet Beaty's shortlist wrong in September and this
 * is not worth being wrong about on a man's own nomination.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-cosmin-musat-interview.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const POST_ID = 278;
const ARTICLE_ID = "cmv6w0dja00017etb9do1fz4a";

const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420";
const SOURCE_FILE = `${D}/moyle/answers.txt`;
const HERO = `${D}/images/19.jpg`;

const DBN = "https://dentalbusinessnews.com";
const EYEBROW = "Behind the Mask:";
const HEADLINE = "Moyle Dental Care, 400 patients to 2,000";
const SEO_TITLE = `${EYEBROW} ${HEADLINE}`;
const SLUG = "behind-the-mask-cosmin-andrei-musat-moyle-dental-care";
const KEYPHRASE = "Moyle Dental Care";
const META =
  "Cosmin-Andrei Musat and his wife Cristina bought a tired Larne practice in January. Heart surgery had paused the plan. The list is now past 2,000.";
const ALT = "Cosmin-Andrei Musat, principal dentist and co-owner of Moyle Dental Care in Larne";
const CAPTION =
  "Cosmin-Andrei Musat, principal dentist and co-owner of Moyle Dental Care in Larne. Picture: supplied";
const CATEGORY_ID = 2; // News, as with the other Behind the Mask interviews
const AUTHOR_ID = 2; // james-burke

const Q = (x) => `<blockquote class="wp-block-quote interview-quote"><p>${x}</p></blockquote>`;
const P = (x) => `<p>${x}</p>`;
const H = (x) => `<h2 class="wp-block-heading">${x}</h2>`;
const LQ = "&#8220;";
const RQ = "&#8221;";

function companyCard() {
  return `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Moyle Dental Care?</h2>
</div>
<p>A practice on Old Glenarm Road in Larne, County Antrim, bought in January 2026 by the dentist Cosmin-Andrei Musat and his wife Cristina, a qualified pharmacist who manages it. It opens six days a week. Nine months in, Musat says the practice is shortlisted in five categories at the 2026 Private Dentistry Awards, among them New Practice of the Year and Most Improved Practice.</p>
<dl>
<div><dt>Practice</dt><dd>Moyle Dental Care</dd></div>
<div><dt>Website</dt><dd><a href="https://www.moyledentalcare.co.uk/">moyledentalcare.co.uk</a></dd></div>
<div><dt>Based</dt><dd>Larne, County Antrim</dd></div>
</dl>
</section>`;
}

function buildBody() {
  return [
    `<p class="standfirst"><em>Three years ago Cosmin-Andrei Musat had a site, an offer in and an architect engaged, and then found out he needed open-heart surgery. The plan stopped. In January this year he and his wife Cristina bought somebody else&#8217;s tired surgery in Larne instead: no computers, no internet connection, and about 400 patients on the books. Nine months on the list is past 2,000. He answered our seven questions on what they actually bought, what it took to make it work, and the June flood that was not in the business plan.</em></p>`,

    companyCard(),

    P(
      `Musat and his wife Cristina took over the practice on Old Glenarm Road in January 2026. He answered our questions in writing, and the answers below are his own words.`
    ),

    H("The practice they did not build"),
    P(`The first attempt got as far as an architect.`),
    Q(
      `Around three years ago, that dream was already becoming a reality. We had found a location, made an offer, involved an architect and started planning our future practice. Then life took an unexpected turn. I discovered that I needed open-heart surgery, and suddenly everything we had been working towards had to be put on hold. Our priorities changed overnight. Building a practice no longer mattered nearly as much as being healthy enough to have a future in which to build one.`
    ),
    P(
      `Most accounts of buying a practice begin at the offer. This one begins three years earlier, with a plan that had a building attached to it and then stopped for reasons that had nothing to do with dentistry. Anyone who has had a purchase fall through will recognise the harder half, which is finding the appetite to start the whole thing again.`
    ),

    H("What 400 patients actually looked like"),
    P(
      `The growth figure is the headline. The more useful number for anyone valuing a tired practice is the one on day one.`
    ),
    Q(
      `In January 2026, we acquired what is now Moyle Dental Care. Although we technically purchased an existing practice, the reality was very different from taking over an established, thriving business. The previous dentist had been working approximately four hours a day, seeing only a handful of patients. The building was ageing, much of the equipment was no longer functional, and the patient base was approximately 400.<br><br>What we purchased was, in many ways, an opportunity to start from scratch.`
    ),
    P(
      `A four-hour clinical day and a list of 400 describes a practice that has been winding down for some years, and it is a particular kind of purchase: you are buying premises, a registration and a catchment rather than an income. The obvious alternative, opening a squat from nothing, is not necessarily the cheaper route, as our report on <a href="${DBN}/dental-elite-london-squat-practice-costs-reach-600000/">London squat practice costs reaching £600,000</a> sets out.`
    ),

    H("No computers, no internet connection"),
    P(`The refit was not cosmetic. The clinical list first.`),
    Q(
      `We installed brand-new dental chairs, digital X-ray equipment, intraoral cameras and intraoral scanners. We invested in a dedicated decontamination room, new compressors, emergency lighting and the essential equipment and safety systems required to operate a modern dental practice. Almost every aspect of the building and its clinical facilities needed attention, and we were determined not to compromise on the standards we wanted to achieve.`
    ),
    P(`Then the part that is harder to believe of a trading practice in 2026.`),
    Q(
      `When we took over, the practice was entirely paper-based, with no computers, no internet connection and no digital infrastructure. We introduced computerised practice management systems, transforming the way we organise appointments, maintain records and manage patient care.`
    ),
    P(
      `Compressors, decontamination and emergency lighting are the items that appear on no refurbishment mood board and cannot be deferred to year two. Musat puts no total on any of it and we have not estimated one. What he does say is where the money came from: ${LQ}We invested everything we could, financially, physically and emotionally${RQ}. There is no mention of a bank in his answer.`
    ),

    H("Four hundred to two thousand"),
    Q(
      `And the transformation has been extraordinary. In just a matter of months, our patient base has grown from approximately 400 to over 2,000 patients.`
    ),
    P(
      `Both figures are his, and the second is a list nine months after completion. He does not break it down between health service and private patients and we have not guessed at it. Worth noting is what a practice absorbing registrations at that rate is heading towards, which is a capacity problem, and that makes his answer on staffing the one to read twice.`
    ),

    H("A dentist and a pharmacist"),
    P(
      `Cristina Musat manages the practice. She is not a dentist, which he treats as the advantage rather than the gap.`
    ),
    Q(
      `Cristina takes responsibility for the management and operational side of the practice, but her role goes far beyond administration. As a qualified pharmacist, she brings a valuable healthcare perspective, a strong understanding of professional responsibility and an exceptional eye for detail.<br><br>She oversees everything from regulatory compliance and staff coordination to patient communication, financial management and the day-to-day running of the business.<br><br>We complement each other because we approach the same goal from different professional perspectives. I see what happens in the surgery; Cristina sees the entire patient journey, from the first telephone call to the moment someone leaves the practice.`
    ),
    P(
      `A pharmacist running a dental practice fits better than it first sounds. The instincts are the same regulated-healthcare instincts, the comfort with audit trails and inspection is already there, and crucially she has no clinical list of her own competing for the hours. That last point is the one most owner-principals cannot solve, because the person best placed to watch the whole patient journey is usually the person with a full diary of their own.`
    ),

    H("Open six days, without anyone working six days"),
    P(`The rota is the whole answer to a question most small teams get wrong.`),
    Q(
      `We are a relatively small team, so communication, flexibility and mutual support are essential. We organise our clinical sessions to balance patient demand with the availability of our dentists, dental therapist and support staff, rather than expecting everyone to work six days a week.`
    ),
    P(
      `The distinction between the practice opening six days and any individual working six days only holds while there are enough people to spread across them, and he knows it: he says recruitment and training now matter as much as equipment. His own test is stated plainly.`
    ),
    Q(
      `Ultimately, I would rather build a practice that grows sustainably than one that grows quickly at the expense of its people.`
    ),

    H("Northern Ireland has its own rulebook"),
    P(
      `This is the answer with the most transferable value in it, and the least transferable subject matter.`
    ),
    Q(
      `Northern Ireland has its own regulatory framework and NHS dental arrangements, which differ considerably from those in other parts of the United Kingdom.<br><br>Navigating the requirements of the Regulation and Quality Improvement Authority, the Business Services Organisation and the administrative systems involved in delivering dental care has required an enormous amount of learning, patience and persistence.`
    ),
    P(
      `None of that machinery is the machinery an English owner knows. The Regulation and Quality Improvement Authority registers and inspects independent dental practices in Northern Ireland in place of the Care Quality Commission, and the Business Services Organisation handles the health service paperwork and payments. Owners looking across the Irish Sea should start with <a href="${DBN}/ni-publishes-gds-cost-review-16-september-2026-what-it-means-for-owners/">the GDS cost review Northern Ireland published in September</a>, because the money works differently too.`
    ),

    H("The June flood"),
    P(`Five months into trading, the building had other ideas.`),
    Q(
      `In June, we experienced serious flooding at the practice. At a time when we were still establishing ourselves, we suddenly had to deal with damage to the premises and the challenge of keeping the service running.<br><br>It was certainly not part of our business plan.`
    ),
    P(
      `He does not say what it cost or how long it disrupted the list, and the piece is not going to invent either. The point he draws from it is the ordinary one that catches every first-time owner: the building&#8217;s problems are now the owner&#8217;s problems, and they arrive in the same week as everything else.`
    ),

    H("Where it goes next"),
    Q(
      `Our plans include expanding our clinical team, continuing to invest in modern technology and developing the range of treatments available to our patients.<br><br>We also want to continue improving the experience of patients who feel nervous or anxious about dental treatment. I believe that one of the most rewarding things we can do as dental professionals is help someone overcome their fear and regain confidence in their smile.`
    ),
    P(
      `Growing the clinical team is the thing the list now requires rather than a thing he has chosen, and he says as much elsewhere in his answers. On the shortlist that prompted this interview, he is deliberately unexcited.`
    ),
    Q(
      `Being shortlisted in five categories at the Private Dentistry Awards 2026 is an incredible honour, particularly during our first year. But for me, recognition is not the finish line. It is encouragement to keep raising our standards.`
    ),
    P(`He finishes where he started.`),
    Q(
      `Three years ago, following my surgery, I could not be certain that we would ever have the opportunity to pursue this dream again.<br><br>Today, we have a practice, a growing team, more than 2,000 patients and a future that we are genuinely excited about.`
    ),

    `<p><em>Behind the Mask is Dental Business News&#8217;s series with the people who own and run dental practices. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a practice and would like to take part, write to <a href="mailto:press@dentalbusinessnews.com">press@dentalbusinessnews.com</a>.</em></p>`,
  ].join("\n\n");
}

// ---- gate ----------------------------------------------------------------
const probe = buildBody();
const outsideQuotes = probe.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
const problems = [];

if (/[\u2014\u2013]|&#8212;|&#8211;/.test(outsideQuotes + SEO_TITLE + META + ALT + CAPTION))
  problems.push("dash in our copy");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
if (!probe.includes(KEYPHRASE)) problems.push("keyphrase missing from the body");
// Never promote a competitor's awards, and never link them.
if (/the-probe\.co\.uk|dentistry\.co\.uk|fmc\.co\.uk|privatedentistry/i.test(probe))
  problems.push("links a competitor");
// His own site, which is the backlink that makes taking part worth his while.
if (!/moyledentalcare\.co\.uk/.test(probe)) problems.push("missing his backlink");
// The sweep's two inventions, named so they can never creep back in.
if (/Ballycastle/i.test(probe)) problems.push("WRONG TOWN: Ballycastle");
for (const ghost of ["Dentally", "Practice Plan", "Patient Plan Direct", "DPAS", "Simplyhealth", "Kiroku", "Software of Excellence", "Carestream"])
  if (new RegExp(ghost, "i").test(probe)) problems.push(`invented supplier back in the copy: ${ghost}`);

const SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");
const norm = (x) =>
  x
    .replace(/<br>\s*<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const src = norm(SOURCE);

const blockQuotes = [...probe.matchAll(/<blockquote[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
// Inline quotations inside OUR paragraphs. A fabricated half sentence in our
// own prose is the same offence as a fabricated blockquote, and until now
// nothing checked for it.
const inlineQuotes = [...outsideQuotes.matchAll(/&#8220;([\s\S]*?)&#8221;/g)].map((m) => m[1]);

for (const q of [...blockQuotes, ...inlineQuotes]) {
  const n = norm(q);
  if (!src.includes(n)) problems.push(`QUOTE NOT VERBATIM: ${n.slice(0, 90)}...`);
}
if (!blockQuotes.length) problems.push("no quotes at all");
if (!fs.existsSync(HERO)) problems.push(`missing his photograph at ${HERO}`);

const plain = probe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log(
  `quotes: ${blockQuotes.length} block + ${inlineQuotes.length} inline | seo title ${SEO_TITLE.length}/60 | ` +
    `meta ${META.length}/155 | words ${plain.split(" ").length}`
);
if (problems.length) {
  console.error("GATE FAILED:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log("gate passed: every quote is his, right town, no invented suppliers, his backlink is in");

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  process.exit(0);
}

// ---- apply ---------------------------------------------------------------
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

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
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

const before = wp(`post get ${POST_ID} --field=post_status`);
console.log(`status before: ${before}`);
if (before !== "draft") {
  console.error(`post ${POST_ID} is ${before}, not draft. Stopping rather than touching a live page.`);
  process.exit(1);
}

const stamp = Date.now();
ssh(`base64 -d > /tmp/musat-${stamp}.jpg`, fs.readFileSync(HERO).toString("base64"));
const mediaId = Number(
  wp(
    `media import /tmp/musat-${stamp}.jpg --post_id=${POST_ID} --title=${sq("Cosmin-Andrei Musat, Moyle Dental Care")} ` +
      `--alt=${sq(ALT)} --caption=${sq(CAPTION)} --featured_image --porcelain`
  )
);
ssh(`rm -f /tmp/musat-${stamp}.jpg`);
const mediaUrl = wp(`post get ${mediaId} --field=guid`);
console.log(`his photograph uploaded as media ${mediaId}`);

const BODY = buildBody();
const TITLE_HTML = `<span class="franchise-eyebrow">${EYEBROW}</span> ${HEADLINE}`;
ssh(`base64 -d > /tmp/musat-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
wp(
  `post update ${POST_ID} /tmp/musat-body-${stamp}.html --post_title=${sq(TITLE_HTML)} ` +
    `--post_name=${SLUG} --post_excerpt=${sq(META)} --post_author=${AUTHOR_ID} ` +
    `--post_category=${CATEGORY_ID} --post_status=draft`
);
ssh(`rm -f /tmp/musat-body-${stamp}.html`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

console.log(`status after : ${wp(`post get ${POST_ID} --field=post_status`)}`);
console.log(`slug         : ${wp(`post get ${POST_ID} --field=post_name`)}`);

const db = forSite(site.id);
await db.article.update({
  where: { id: ARTICLE_ID },
  data: {
    title: SEO_TITLE,
    type: "interview",
    body: BODY,
    metaDesc: META,
    keyphrase: KEYPHRASE,
    category: "News",
    status: "review",
    publishedAt: null,
    imageUrl: mediaUrl,
    imageAlt: ALT,
    imageCredit: "Picture: supplied",
    imageSource: "interview:subject-supplied",
    qaPassed: true,
    qaReport: JSON.stringify({
      verdict: "hand-written from the subject's returned answers; every quote verified verbatim against his email",
      replaces:
        "a sweep draft that placed the practice in Ballycastle, dated the purchase to 2019, invented all eight quotations, named Dentally and Practice Plan as his suppliers and sourced a software comparison table to an interview he never gave",
    }),
  },
});

const t = await db.interviewTarget.findFirst({ where: { company: "Moyle Dental Care" } });
if (t) {
  await db.interviewTarget.update({
    where: { id: t.id },
    data: { status: "drafted", headshotUrl: mediaUrl, publishedUrl: null, publishedAt: null, notifiedAt: null },
  });
}

// The preview link JB reads the proof on. Nothing is live.
const key = wp(`post meta get ${POST_ID} _cogent_preview_key 2>/dev/null || true`);
console.log(`\nPREVIEW: ${DBN}/?p=${POST_ID}&preview=true`);
console.log(`(draft, author ${AUTHOR_ID}, featured image ${mediaId}${key ? `, key ${key}` : ""})`);
await prisma.$disconnect();
