/**
 * Behind the Mask with Dr Sheena A Tanna, principal dentist at Billericay
 * Dental Care in Essex, built from the answers returned on 14 Oct 2026 as a
 * Word document. JB: "can you make a proof for this please". STAYS A DRAFT.
 *
 * Creates a NEW WordPress draft and a NEW Article row, because nothing has been
 * drafted for her yet: the InterviewTarget is still at "answered" with no
 * articleId. The sweep has left it alone for a day, almost certainly because
 * her answers arrived as a .docx attachment and the empty-replyBody guard held
 * it. Setting articleId below takes the row out of the sweep's query
 * (status "answered", articleId null) so it cannot draft a second version
 * underneath this one.
 *
 * THE ARTICLE ROW IS LEFT AT "idea" WITH qaPassed FALSE, DELIBERATELY.
 * publish-due and fill-schedule both select status in (review, approved) AND
 * qaPassed true. Marking the Musat piece review + qaPassed yesterday to stage
 * it for JB is exactly what made the scheduler publish it an hour early on a
 * second url. A proof waiting on a human must not sit in the publisher's query.
 *
 * EVERY QUOTE IS VERBATIM, proven below against the text extracted from her
 * document, blockquotes and inline quotations alike.
 *
 * HER PHOTOGRAPH. Supplied as a 612x918 webp, converted to JPEG for the hero so
 * the share card is not a webp. It is small for a hero and worth asking her for
 * the original.
 *
 * NO LINK TO THE AWARDS. The Private Dentistry Awards shortlist lives on
 * awards.dentistry.co.uk, which is FMC, who publish the title this one competes
 * with. Our own outreach linked it; the article does not.
 *
 * Her name is checked against the practice's own team page rather than our
 * outreach: Dr Sheena A Tanna, Principal Dentist, GDC 178019.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-sheena-tanna-interview.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const TARGET_ID = "cmv5149du001310pg0ra0bcf2";

const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420";
const SOURCE_FILE = `${D}/billericay/answers.txt`;
const HERO = `${D}/billericay/sheena-tanna.jpg`;

const DBN = "https://dentalbusinessnews.com";
const EYEBROW = "Behind the Mask:";
const HEADLINE = "Sheena Tanna on employing two managers";
const SEO_TITLE = `${EYEBROW} ${HEADLINE}`;
const SLUG = "behind-the-mask-sheena-tanna-billericay-dental-care";
const KEYPHRASE = "Billericay Dental Care";
const META =
  "Sheena Tanna hired a business manager and a practice manager in week one, and was told it was unnecessary. Billericay Dental Care now runs six surgeries.";
const ALT = "Dr Sheena A Tanna, principal dentist at Billericay Dental Care";
const CAPTION = "Dr Sheena A Tanna, principal dentist at Billericay Dental Care in Essex. Picture: supplied";
const CATEGORY_ID = 2; // News
const AUTHOR_ID = 2; // james-burke

const Q = (x) => `<blockquote class="wp-block-quote interview-quote"><p>${x}</p></blockquote>`;
const P = (x) => `<p>${x}</p>`;
const H = (x) => `<h2 class="wp-block-heading">${x}</h2>`;
const LQ = "&#8220;";
const RQ = "&#8221;";

function companyCard() {
  return `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Billericay Dental Care?</h2>
</div>
<p>A high street practice in Billericay, Essex, trading for more than two decades and led by Dr Sheena A Tanna for well over ten years. It has grown from three surgeries to six, employs more than twenty-five people, and publishes its NHS and private fee lists side by side. It is shortlisted in the 2026 Private Dentistry Awards for Most Improved Practice and Digital Practice of the Year, with Tanna up for Practice Principal of the Year in the South East.</p>
<dl>
<div><dt>Practice</dt><dd>Billericay Dental Care</dd></div>
<div><dt>Website</dt><dd><a href="https://www.billericaydentalcare.co.uk/">billericaydentalcare.co.uk</a></dd></div>
<div><dt>Based</dt><dd>Billericay, Essex</dd></div>
</dl>
</section>`;
}

function buildBody() {
  return [
    `<p class="standfirst"><em>In her first few weeks as principal, Sheena Tanna hired a business manager and a practice manager, and was told by her peers that it was unnecessary. More than a decade on, Billericay Dental Care has gone from three surgeries to six, employs more than twenty-five people, publishes both its fee lists in public, and is shortlisted in three categories at the Private Dentistry Awards. She answered our seven questions on the structure she was criticised for, the kit that paid for itself quickest, and what passing twenty-five staff does to a culture.</em></p>`,

    companyCard(),

    P(
      `Tanna took over an established practice on the high street in Billericay and has run it for well over a decade. She answered our questions in writing, and the answers below are her own words.`
    ),

    H("The hire she was told not to make"),
    P(
      `Most single site practices have one manager, and the principal absorbs whatever will not fit in that person&#8217;s week. Tanna split the job before she had the size to justify it.`
    ),
    Q(
      `Having both a business manager and a practice manager was a structure I introduced within the first few weeks of taking over the practice. At the time, I received quite a lot of criticism from peers who felt it was unnecessary, but it has paid dividends over the years.<br><br>Running a dental practice involves an enormous amount beyond clinical dentistry, from compliance and team management to finance, marketing and long-term planning. I do not think it is realistic or fair to place responsibility for all of that on one person. When people are spread too thinly, important areas inevitably do not receive the attention they deserve.`
    ),
    P(
      `The criticism is the interesting part, because the objection was almost certainly about cost. A second manager&#8217;s salary is a visible number in the accounts from month one. What it buys is invisible: the compliance file that stays current, the recall list that gets worked, the marketing that happens in a quiet month rather than a panicked one. Those do not show up as a line item, which is why the second manager is usually the hire that does not get made.`
    ),

    H("What the split actually frees a principal to do"),
    Q(
      `Our practice manager and business manager each have clearly defined responsibilities, while still being able to collaborate on larger projects and periods of growth. I am also a great believer in developing and elevating people within the team. We invest heavily in training and encourage team members to broaden their skills and take on greater responsibility. This creates resilience and continuity, ensuring the practice can continue running effectively during periods of absence or change.<br><br>The role of principal is to hold the overall vision, protect the culture and standards, and continue driving the practice forward. Having a strong management team around me has reduced the pressure, allowed me to focus on where I add the most value and, ultimately, enabled me to lead the practice successfully for well over a decade.`
    ),
    P(
      `Note what she is describing as the principal&#8217;s job: vision, culture and standards, and nothing operational. That is only available to an owner who has somewhere to put the operations. Most principals describe the same job and then spend the week doing rotas, because there is nobody else to do them.`
    ),

    H("Both fee lists, in public"),
    P(
      `Billericay publishes its NHS and private prices together. That is a choice, and it stages a comparison a mixed practice can otherwise leave a patient to ask for.`
    ),
    Q(
      `Private dentistry gives patients additional choice. This may include cosmetic treatment that is not available through the NHS, as well as a wider selection of materials, techniques or treatment options. It does not mean that the NHS option is inadequate; both routes are intended to protect oral health, but private care can offer choices beyond clinical need.<br><br>We publish both our NHS and private fees because we believe patients should have clear information from the outset. Our role is to explain the available options honestly, including the differences and costs, so that each patient can make an informed decision based on their needs, preferences and budget. We are equally proud of the care and patient experience we provide to both our NHS and private patients.`
    ),
    P(
      `The sentence doing the work is the one about the NHS option not being inadequate. A published price gap invites the patient to read the cheaper option as the lesser one, and the answer to that is not to hide the gap but to say what the extra money actually buys, which here is choice rather than clinical necessity. Owners weighing how much of the week to give the contract can read our guide to <a href="${DBN}/how-much-is-an-nhs-dental-contract-actually-worth/">what an NHS dental contract is actually worth</a>.`
    ),

    H("The scanner that paid for itself, and what it really bought"),
    P(`We asked which investment returned fastest. She named one, then argued against the question.`),
    Q(
      `Our digital scanners have probably paid for themselves the fastest, but their greatest value has been the difference they have made to communication.<br><br>They allow us to show patients their own mouths in full 3D. Patients can see exactly what we can see, whether that is tooth wear, a crack, gum recession or changes occurring over time. Gone are the days when the dentist simply dictated what treatment a patient needed and expected them to accept it. Dentistry is now far more collaborative. We can look at the scan together, discuss what it shows and involve the patient properly in decisions about their care.`
    ),
    P(`And then the part that is easy to leave out of a business case.`),
    Q(
      `However, the equipment alone is not what makes a practice digital. We have invested significantly in training our team and helping them understand how technology can improve the patient journey. The return has not just been financial; it has been better communication, greater patient understanding and a more consistent and collaborative standard of care.`
    ),
    P(
      `This is the honest version of a digital business case. The scanner shortens the conversation in which a patient decides, which is why it pays back, and the training is what makes the shortened conversation happen consistently across six surgeries rather than in the hands of whoever likes the machine. For the capital side of that decision, our guide sets out <a href="${DBN}/dental-equipment-in-2026-what-it-costs-and-what-it-pays-back/">what dental equipment costs in 2026 and what it pays back</a>.`
    ),

    H("Culture does not grow by itself"),
    P(`The hardest staffing lesson, and it is not about recruitment.`),
    Q(
      `The hardest lesson has been realising that culture does not automatically grow with the size of the team; you have to work continuously to protect it.<br><br>When we were a smaller practice, everyone knew one another closely, communication happened naturally and it was easier for the whole team to remain connected to our mission and vision. As we have grown to more than twenty-five people, one of the greatest challenges has been maintaining that same sense of belonging and ensuring that every team member understands what we stand for and the part they play in the patient journey.`
    ),
    P(`What she does about it has a price attached.`),
    Q(
      `We have invested significantly in keeping the team connected. We close the practice for quarterly training, create opportunities for people to learn together and make time for social events outside work. These are not simply team-building exercises; they help strengthen relationships, improve communication and keep our values present within the day-to-day running of the practice.`
    ),
    P(
      `Closing six surgeries for training, four times a year, is not a perk. It is lost chair time in the accounts, chosen deliberately and repeatedly. That is the part worth copying: the practices that say they value training and never close are the ones that have decided, without saying so, that a day of production is worth more than a day of alignment across twenty-five people.`
    ),

    H("Three surgeries to six"),
    P(`On what actually keeps a twenty-year-old practice from ageing.`),
    Q(
      `We have adapted to the way patients now communicate and access information. Social media has become an important way for us to educate, engage with and listen to our community. Our investment in digital dentistry and our expansion from three to six surgeries have also enabled us to provide a wider range of care in a more modern and efficient way.<br><br>For me, making an established practice feel new is not simply about renovating the building or purchasing the latest technology. It is about never becoming complacent: continuing to listen, being prepared to change and growing alongside both your patients and your team, while protecting the values that made the practice successful in the first place.`
    ),

    H("The part nobody warns you about"),
    Q(
      `The least glamorous part is knowing that, as principal, you are ultimately responsible for the practice. Even when I am away, I remain available to the management team to offer advice or make important decisions when needed. That responsibility does not disappear simply because the working day has ended or you are on holiday.<br><br>Over the years, I have continued to lead the practice alongside raising a family and navigating the unexpected challenges that life inevitably brings. The business does not pause when circumstances become difficult, so you learn to juggle different responsibilities and keep things moving even when the timing is far from ideal.`
    ),
    P(
      `Worth sitting with, given where the piece started. Tanna built a two-manager structure specifically so the practice could run without her, invested in elevating people so it has ${LQ}resilience and continuity${RQ}, and is still the person reachable on holiday. The structure buys back the week. It does not buy back the responsibility, and no structure does.`
    ),

    H("Where it goes next"),
    P(`The ambition is not a seventh surgery.`),
    Q(
      `Billericay Dental Care is already thriving, and we are incredibly proud of what we have built. We already provide comprehensive care, from family and preventative dentistry through to cosmetic treatment and full-mouth rehabilitation. The next stage is ensuring that our local community fully recognises the breadth and quality of care already available here.<br><br>We want Billericay Dental Care to be the place where patients can access all aspects of their dental care under one roof, supported by a team they know and trust. Our mission has always been to create beautiful, healthy smiles, and we will continue developing the practice around that purpose.`
    ),
    P(
      `A practice whose next phase is telling its existing patients what it already does is in an unusual position, and a common one. Full-mouth rehabilitation sitting unadvertised behind a family dentistry sign is the most under-sold asset on a lot of high streets.`
    ),
    Q(
      `Most importantly, growth must never come at the expense of who we are. We are both a family and cosmetic dental practice, and many of our patients already feel part of our extended family. We care for several generations of the same families, and those long-standing relationships are at the heart of the practice.`
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
if (/awards\.dentistry\.co\.uk|the-probe\.co\.uk|fmc\.co\.uk/i.test(probe)) problems.push("links a competitor");
if (!/billericaydentalcare\.co\.uk/.test(probe)) problems.push("missing her backlink");
if (!/Sheena A Tanna/.test(probe)) problems.push("her name as the register has it is missing");

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
const inlineQuotes = [...outsideQuotes.matchAll(/&#8220;([\s\S]*?)&#8221;/g)].map((m) => m[1]);
for (const q of [...blockQuotes, ...inlineQuotes]) {
  const n = norm(q);
  if (!src.includes(n)) problems.push(`QUOTE NOT VERBATIM: ${n.slice(0, 90)}...`);
}
if (!blockQuotes.length) problems.push("no quotes at all");
if (!fs.existsSync(HERO)) problems.push(`missing her photograph at ${HERO}`);

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
console.log("gate passed: every quote is hers, no competitor link, her backlink is in");

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  process.exit(0);
}

// ---- apply ---------------------------------------------------------------
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const db = forSite(site.id);
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

// Nothing may already exist under this slug, or this creates a second copy of
// the same interview, which is how yesterday went wrong.
const clash = wp(`post list --post_type=post --post_status=any --name=${SLUG} --field=ID --format=csv`);
if (clash) {
  console.error(`post ${clash} already uses the slug ${SLUG}. Stopping.`);
  process.exit(1);
}

const BODY = buildBody();
const TITLE_HTML = `<span class="franchise-eyebrow">${EYEBROW}</span> ${HEADLINE}`;
const stamp = Date.now();
ssh(`base64 -d > /tmp/tanna-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
const postId = Number(
  wp(
    `post create /tmp/tanna-body-${stamp}.html --post_title=${sq(TITLE_HTML)} --post_name=${SLUG} ` +
      `--post_excerpt=${sq(META)} --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_status=draft --porcelain`
  )
);
ssh(`rm -f /tmp/tanna-body-${stamp}.html`);
console.log(`draft created as post ${postId}`);

ssh(`base64 -d > /tmp/tanna-${stamp}.jpg`, fs.readFileSync(HERO).toString("base64"));
const mediaId = Number(
  wp(
    `media import /tmp/tanna-${stamp}.jpg --post_id=${postId} --title=${sq("Dr Sheena A Tanna, Billericay Dental Care")} ` +
      `--alt=${sq(ALT)} --caption=${sq(CAPTION)} --featured_image --porcelain`
  )
);
ssh(`rm -f /tmp/tanna-${stamp}.jpg`);
const mediaUrl = wp(`post get ${mediaId} --field=guid`);
console.log(`her photograph uploaded as media ${mediaId}`);

wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

// status "idea" and qaPassed false: OUT of publish-due's and fill-schedule's
// query, which both want status in (review, approved) AND qaPassed true.
// This waits for a person, so it must not look ready to a cron.
const article = await db.article.create({
  data: {
    title: SEO_TITLE,
    type: "case_study",
    status: "idea",
    body: BODY,
    metaDesc: META,
    keyphrase: KEYPHRASE,
    category: "News",
    wpPostId: postId,
    imageUrl: mediaUrl,
    imageAlt: ALT,
    imageCredit: "Picture: supplied",
    imageSource: "interview:subject-supplied",
    subjectKind: "person",
    subjectName: "Sheena Tanna",
    subjectRole: "Principal Dentist",
    subjectOrg: "Billericay Dental Care",
    qaPassed: false,
    qaReport: JSON.stringify({
      verdict: "hand-written from her returned document; every quote verified verbatim",
      holding: "left at idea on purpose so the scheduler cannot publish it before JB has read it",
    }),
  },
});
console.log(`article row ${article.id}`);

// Claiming the row takes it out of the sweep's (status answered, articleId
// null) query, so it cannot draft a competing version.
await db.interviewTarget.update({
  where: { id: TARGET_ID },
  data: { status: "drafted", articleId: article.id, headshotUrl: mediaUrl },
});
console.log("interview row claimed, the sweep will not draft over this");

console.log(`\nPREVIEW: ${DBN}/?p=${postId}&preview=true`);
await prisma.$disconnect();
