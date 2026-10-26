/**
 * Meet the Manager: Simone Nel, operations manager at Colourbox Montessori
 * Schools (Suffolk). Built as a WordPress DRAFT for JB to preview.
 * Nothing publishes, nothing emails Simone.
 *
 * Source: her reply of 13 Oct 2026 11:23 UK, seven numbered answers plus one
 * photo. She sent it from operations.manager@colourboxmontessori.co.uk in a
 * NEW thread, while the InterviewTarget row carried businessmanager@ and the
 * original subject, which is why the hourly sweep never matched it and the row
 * still said "questioned" with an empty replyBody. The row has been locked to
 * "drafted" with her real answers stored, so the drafting stage cannot invent
 * one (see the Kesman and Zamaine scars).
 *
 * LAYOUT: the Gym Champions shape, not the drafter's Q&A. Company card, intro,
 * h2 prose sections, and EVERY answer inside a plain `.interview-quote`, which
 * the parent has drawn as a speech bubble since cogent-base 1.30.0 (live here,
 * confirmed 13 Oct). Exactly two `--pull` marks, for the two lines worth
 * enlarging, because --pull is now typography only.
 *
 * Quotes are hers, trimmed not reworded, and every one is checked against the
 * email text before anything is written.
 *
 * Photo is 800x800, which is small for a hero. She offered a better one; worth
 * asking before this publishes.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-simone-nel-interview.mjs [--apply]
 */
import fs from "node:fs";
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/simone";
// The supplied 800x800 cropped to 4:3 sat too tight: the theme covers the lead
// into 16/9 and the homepage hero into 5/4, and both took her forehead off.
// simone-hero-wide.jpg keeps the whole square at 940px inside a 1600x1200
// canvas, with a blurred enlargement of the same picture filling the surround,
// so she survives both crops with headroom. Nothing is invented, it is her own
// photo behind her.
const HERO = `${D}/simone-hero-wide.jpg`;
const ANSWERS = `${D}/answers.txt`;
const TARGET_ID = "cmv514abq002z10pg3di1yzgr";

const ND = "https://nurserydaily.com";
const SITE = "https://www.colourboxmontessori.co.uk/";
const TITLE_TEXT = "Simone Nel on what breaks when you grow";
const TITLE = `<span class="franchise-eyebrow">Meet the Manager:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Meet the Manager: ${TITLE_TEXT}`;
const SLUG = "meet-the-manager-simone-nel-on-what-breaks-when-you-grow";
const KEYPHRASE = "nursery group operations";
const EXCERPT =
  "Simone Nel oversees six Colourbox Montessori nurseries and two Forest School provisions across Suffolk. She explains what breaks first when one nursery becomes a group, why the group never uses agency staff, and what the unglamorous half of an operations job actually involves.";
const META =
  "Colourbox Montessori operations manager Simone Nel on six Suffolk nurseries, what breaks first when you add sites, and why she never uses agency staff.";
const HERO_ALT = "Simone Nel, operations manager at Colourbox Montessori";
const HERO_CAPTION = "Simone Nel. Picture: supplied";
const CATEGORY_ID = 9; // Case Studies
const AUTHOR_ID = 2; // james-burke

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const qp = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote interview-quote--pull">\n${paras
    .map((x) => `<p>${x}</p>`)
    .join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Colourbox Montessori?</h2>
</div>
<p>Colourbox Montessori runs six nurseries and two Forest School provisions across Suffolk, at Barrow, Redwoods, Cherry Trees, Haverhill, Newmarket and Red Lodge, grown from a single village nursery. A seventh setting, Colourbox Kennett, opens in September 2027 and will be the group&#8217;s first outside the county.</p>
<dl>
<div>
<dt>Company</dt>
<dd>Colourbox Montessori School Ltd</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${SITE}">colourboxmontessori.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Montessori day nurseries</dd>
</div>
<div>
<dt>Based</dt>
<dd>Suffolk</dd>
</div>
</dl>
</section>`,

  p(
    `Simone Nel is operations manager at <a href="${SITE}">Colourbox Montessori</a>, which has grown from one village nursery into six settings and two Forest School provisions across Suffolk. She began her own career as a practitioner. She answered our seven questions by email.`
  ),

  h2(`A week with a plan, and a week that has read it`),
  p(`We asked what a normal week actually looks like when you are responsible for eight provisions at once.`),
  q(
    `A normal week has a plan. Whether the week has read it is another matter!`,
    `I oversee six nurseries and two Forest School provisions, so my role moves between safeguarding, staffing, quality of education, leadership development and operational performance. One morning might involve helping a manager navigate a sensitive conversation; that afternoon, I could be reviewing staffing budgets or observing how children experience the Montessori work cycle.`,
    `The challenge is knowing what needs my attention immediately and what needs a manager to grow in confidence. If every answer comes from me, I become the bottleneck. My job is to develop leaders who can make sound decisions while keeping a clear view of what is happening across the group.`
  ),

  h2(`Six settings, six local markets`),
  p(
    `Colourbox runs sites in towns and villages across the county. For any operator weighing a second or third location, how differently those markets behave is the question that decides the business plan.`
  ),
  q(
    `Each setting has its own rhythm. Families&#8217; working patterns, transport, local competition and the ages of children needing places all influence demand. A nursery can have strong overall occupancy and still have a mismatch between the sessions families want and the places available.`,
    `That is why I look beyond headline figures. Occupancy, staffing costs and enquiries need to be understood alongside the setting&#8217;s local circumstances.`,
    `The expectation of quality stays consistent, but the route to a sustainable nursery needs to reflect its community. Six settings cannot simply be six copies of the same business plan, and I love that they reflect cultures and communities, and support the family demographics individually.`
  ),
  p(
    `The mismatch she describes is the one that does not show up in a headline occupancy figure, and it is worth reading alongside what under-occupancy does to a valuation, which we covered in <a href="${ND}/owen-froebel-nursery-occupancy-of-80-still-cuts-sale-offers/">our interview with broker Owen Froebel</a>.`
  ),

  h2(`What breaks first when you add sites`),
  p(`This is the answer most worth the time of anyone running one setting and thinking about a second.`),
  qp(`Often, it is the assumption that everybody knows what everybody else knows.`),
  q(
    `In one nursery, information travels naturally. Someone hears a conversation, notices a change or catches the owner in the corridor. Add more sites and those informal systems start leaving gaps. An instruction can be perfectly clear to the person giving it and interpreted three different ways elsewhere.`,
    `Growth requires clearer responsibilities, reliable communication and systems that turn decisions into practice. It also changes leadership: being exceptionally good at running one nursery does not automatically prepare someone to lead several managers. This requires real skill and strategic oversight.`,
    `You have to preserve the relationships and values that made the original nursery special while building the structure that allows them to survive growth.`
  ),

  h2(`Consistency is not a completed action plan`),
  p(`We asked how she holds standards across eight provisions without running all of them herself.`),
  q(
    `By being present, asking better questions and checking what children actually experience.`,
    `A completed action plan is useful, but I want to see what has changed in the room. Are interactions warmer? Are children accessing a broader curriculum? Can staff explain a safeguarding concern and what they would do next?`,
    `We use supervision, visits, training and performance information to build that picture. Our training is layered: managers develop their leadership, deputies prepare for greater responsibility, and room leaders learn how to guide people as well as practice.`,
    `Consistency comes from shared understanding and follow-through. Managers need both the confidence to lead their setting and the accountability to demonstrate its impact. To me, as a leader, reflection is everything. When a manager recognises how their own response influences their team&#8217;s confidence, how their instinct to step in can affect someone else&#8217;s willingness to take ownership, or how the way they handle pressure can become the way their whole team handles it&#8230;those penny-drop moments become colossal drivers of change. My goal is to give my managers something they can recognise in themselves and act on long after the meetings end.`
  ),

  h2(`Where the best people come from`),
  p(
    `Recruitment is the first thing every operator names. Colourbox grows most of its own, and the group has made one structural choice that follows directly from having several settings.`
  ),
  q(
    `Some arrive with experience and qualifications, many are homegrown from apprentices right into leadership and management. Others reveal their potential once they are given the right support and opportunity through quality apprenticeships. We also pair up with all of our local secondary schools and educate our communities on the exceptional opportunities in early years careers available through settings like Colourbox.`,
    `My own career began as a practitioner, so I know how much progression can mean. We invest in development at different stages rather than waiting until somebody receives a leadership title. I am particularly interested in the people who are curious, receptive to feedback and thoughtful about children. Qualifications matter, but so does what someone does when a child needs patience, a colleague needs support, or a familiar approach needs questioning.`,
    `Recruitment gets people through the door. Feeling supported, challenged and able to build a future helps them stay. And, having multiple settings means we do not use agency staff to cover staffing gaps. This is a major step in safer provision. One vision, one shared priority for safeguarding, consistent quality, and care.`
  ),
  p(
    `That last point is the commercial case for a group stated plainly. Agency cover is one of the few costs a single setting cannot design out, and Colourbox has turned scale into an internal cover pool instead. It is also a safeguarding argument, which is the ground the sector tends to find more persuasive than the invoice.`
  ),

  h2(`The follow-through nobody photographs`),
  p(`Every subject gets asked what the job is really like. Few answer it this directly.`),
  qp(
    `The sheer amount of follow-through. Leadership photographs rarely feature somebody reconciling an incident chronology or checking whether an agreed action has actually happened.`
  ),
  q(
    `There are difficult conversations, absence pressures, complaints, records and decisions that cannot be postponed simply because the day is already full. You also have to remain calm enough to help other people think clearly.`,
    `Much of the work is invisible when it goes well. A staffing problem resolved before opening, a concern recognised early, a manager supported through a difficult decision: nobody applauds, but those things protect the conditions children need.`,
    `While there is considerable professional satisfaction in a thoroughly uneventful Tuesday, the operations role demands something more: a genuine appetite for the unexpected, a talent for turning complexity into clarity, and the composure to thrive when the pressure is on.`
  ),

  h2(`Kennett, and what growth has to mean`),
  p(`The next setting takes Colourbox out of Suffolk for the first time.`),
  q(
    `Colourbox Kennett is an exciting next chapter, opening in September 2027, alongside continuing to strengthen the settings we already have. This is our first little step into Cambridgeshire, having all of our settings and growth in Suffolk.`,
    `For me, growth means developing more capable leaders, deepening our Montessori practice and making sure training translates into exceptional experiences for children. It also means being financially thoughtful, because ambition needs a sustainable foundation.`,
    `I want our people to see a future within Colourbox and our generations of families to continue to experience the care, consistency and confidence that comes from a well-led nursery.`,
    `The most exciting measure of progress is what becomes possible for children: the independence they develop, the discoveries they make and the confidence they carry beyond our doors. We&#8217;re all living the company's model of &#8220;excited about learning; excited about life!&#8221; That is what makes the operational work worth doing.`
  ),

  p(
    `<em>Meet the Manager is Nursery Daily&#8217;s series with the people running early years settings. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a setting and would like to take part, write to <a href="mailto:press@nurserydaily.com">press@nurserydaily.com</a>.</em>`
  ),
].join("\n\n");

// ---- gate ----
const problems = [];
const ours = BODY.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[\u2014\u2013]/.test(ours + SEO_TITLE + META + EXCERPT + HERO_ALT)) problems.push("dash in our copy");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);

const plainCount = (BODY.match(/class="wp-block-quote interview-quote"/g) || []).length;
const pullCount = (BODY.match(/--pull/g) || []).length;
if (pullCount > 2) problems.push(`${pullCount} --pull marks, max 2`);
if (plainCount < 5) problems.push(`only ${plainCount} plain bubbles`);

// Every quote must be her own words.
const norm = (x) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const source = norm(fs.readFileSync(ANSWERS, "utf8"));
const quotes = [...BODY.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)].flatMap((m) =>
  [...m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => x[1])
);
for (const quote of quotes) {
  if (!source.includes(norm(quote))) problems.push(`NOT VERBATIM: ${norm(quote).slice(0, 80)}...`);
}
if (!fs.existsSync(HERO)) problems.push("missing hero");

console.log(
  `quotes ${quotes.length} checked | bubbles ${plainCount} plain + ${pullCount} pull | seo ${SEO_TITLE.length} | meta ${META.length} | words ${BODY.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length}`
);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
}
if (!APPLY) {
  console.log("DRY RUN, gate passed, nothing written. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const { ssh, put } = await nurserySsh();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;

// Reuse the draft if this has been run before, so there is only ever one.
let postId = JSON.parse(
  ssh(`wp post list --post_type=post --post_status=any --name=${SLUG} --fields=ID --format=json`)
)[0]?.ID;

const stamp = Date.now();
const bodyTmp = `/tmp/simone-${stamp}.html`;
put(Buffer.from(BODY, "utf8"), bodyTmp);
const uploaded = Number(ssh(`wc -c < ${bodyTmp}`).trim());
if (uploaded !== Buffer.byteLength(BODY)) throw new Error(`upload ${uploaded} bytes, expected ${Buffer.byteLength(BODY)}`);

if (!postId) {
  postId = Number(
    ssh(
      `wp post create ${bodyTmp} --post_type=post --post_status=draft --post_author=${AUTHOR_ID} ` +
        `--post_category=${CATEGORY_ID} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} ` +
        `--post_name=${SLUG} --porcelain`
    )
  );
  console.log(`created draft ${postId}`);
} else {
  ssh(
    `wp post update ${postId} ${bodyTmp} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} ` +
      `--post_category=${CATEGORY_ID} --post_status=draft`
  );
  console.log(`updated existing draft ${postId}`);
}
ssh(`rm -f ${bodyTmp}`);

if (!ssh(`wp post meta get ${postId} _thumbnail_id || true`).trim()) {
  const heroTmp = `/tmp/simone-hero-${stamp}.jpg`;
  put(fs.readFileSync(HERO), heroTmp);
  const mediaId = ssh(
    `wp media import ${heroTmp} --post_id=${postId} --featured_image --title=${sq("Simone Nel, Colourbox Montessori")} ` +
      `--alt=${sq(HERO_ALT)} --caption=${sq(HERO_CAPTION)} --porcelain`
  );
  ssh(`rm -f ${heroTmp}`);
  console.log(`hero media ${mediaId}`);
}

ssh(`wp post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
ssh(`wp post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
ssh(`wp post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

const stored = ssh(`wp post get ${postId} --field=post_content`);
console.log(`stored ${stored.length} bytes | bubbles ${(stored.match(/interview-quote/g) || []).length}`);
console.log(`status:  ${ssh(`wp post get ${postId} --field=post_status`)}`);
console.log(`preview: ${ND}/?p=${postId}&preview=true`);
console.log(`edit:    ${ND}/wp-admin/post.php?post=${postId}&action=edit`);

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
await forSite(site.id).interviewTarget.update({ where: { id: TARGET_ID }, data: { status: "drafted" } });
await prisma.$disconnect();
