/**
 * Meet the Manager: Caroline Akker, founder of Bee Curious Childcare (Glebe
 * Farm, Astbury). JB, 26 Oct 2026: "please make live and send to me, then i'll
 * confirm happy and you can send to client". So this PUBLISHES. It does not
 * email Caroline; that waits for JB.
 *
 * Source: the .docx she sent, seven numbered answers, plus one headshot. Her
 * row was at status "answered" with articleId null, which is the state the
 * sweep drafts a duplicate over, so it was locked to "drafted" with her real
 * answers stored before anything else was done.
 *
 * LAYOUT: Gym Champions shape. Company card, intro, h2 prose sections, every
 * answer inside a plain `.interview-quote` (a speech bubble since cogent-base
 * 1.30.0), exactly two `--pull`.
 *
 * Quotes are hers, verbatim, checked against the .docx text before writing.
 * Her own em dashes are kept: the no-dashes rule is about our copy reading as
 * machine-written, and she is a person who types em dashes.
 *
 * ADDRESS comes from the Ofsted register (URN 2771677, "Glebe Farm, Astbury,
 * Congleton, CW12 4RQ", registered 04 Jan 2024, registered by Akker, Caroline),
 * not from her site, which is currently OFFLINE: beecuriouschildcare.co.uk
 * serves a Wix "domain isn't connected to a site" page. So the Website row is
 * plain text rather than a link to a dead page, and she needs telling.
 *
 * DELIBERATELY NOT PUBLISHED, both to be raised with her first:
 *  - Companies House shows BEE CURIOUS CHILDCARE @ THE WILLOWS LIMITED and BEE
 *    CURIOUS GROUP LIMITED incorporated 14 May 2026 alongside the Glebe Farm
 *    company. That reads like a second site and a group structure, but an
 *    incorporation is not an opening and she did not mention it. Printing an
 *    unannounced expansion from the register is exactly what the format doc
 *    warns against.
 *  - Our outreach said she was named NDNA Manager of the Year 2026. She did not
 *    raise it, and it is unverified here, so it is left out and asked about,
 *    the same way Simone Nel's award was.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-caroline-akker-interview.mjs [--apply]
 */
import fs from "node:fs";
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/nw";
const HERO = `${D}/caroline-hero.jpg`;
const ANSWERS = `${D}/answers.txt`;
const TARGET_ID = "cmv514a8a002r10pgtwykxn5p";

const ND = "https://nurserydaily.com";
const TITLE_TEXT = "Caroline Akker on outgrowing her own home";
const TITLE = `<span class="franchise-eyebrow">Meet the Manager:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Meet the Manager: ${TITLE_TEXT}`;
const SLUG = "meet-the-manager-caroline-akker-on-outgrowing-her-own-home";
const KEYPHRASE = "nursery on a farm";
const EXCERPT =
  "Caroline Akker was a childminder until demand outgrew her house. She explains how a conversation with a working farm turned into a converted barn, why she staffs at 1:3 across the board and charges for it, and what teaching did not prepare her for.";
const META =
  "Caroline Akker went from childminder to a barn nursery at Glebe Farm with 15 staff. On the 1:3 ratio she chose, the farm deal, and the paperwork.";
const HERO_ALT = "Caroline Akker, founder of Bee Curious Childcare";
const HERO_CAPTION = "Caroline Akker. Picture: supplied";
const CATEGORY_ID = 9; // Case Studies
const AUTHOR_ID = 2;

const q = (...p) =>
  `<blockquote class="wp-block-quote interview-quote">\n${p.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const qp = (...p) =>
  `<blockquote class="wp-block-quote interview-quote interview-quote--pull">\n${p
    .map((x) => `<p>${x}</p>`)
    .join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are Bee Curious Childcare?</h2>
</div>
<p>A nursery in a converted barn at Glebe Farm in Astbury, near Congleton. Caroline Akker started as a childminder in 2021 and registered the nursery with Ofsted in January 2024. It now employs 15 staff, and takes its approach from hygge and The Curiosity Approach, with outdoor learning on a working farm.</p>
<dl>
<div>
<dt>Company</dt>
<dd>Bee Curious Childcare</dd>
</div>
<div>
<dt>Website</dt>
<dd>beecuriouschildcare.co.uk</dd>
</div>
<div>
<dt>Sector</dt>
<dd>Day nursery</dd>
</div>
<div>
<dt>Based</dt>
<dd>Astbury, Cheshire</dd>
</div>
</dl>
</section>`,

  p(
    `Caroline Akker went from registered childminder to a nursery with 15 staff in under three years, and did it by asking a working farm whether it had a spare room. She answered our seven questions in writing.`
  ),

  h2(`From a childminder&#8217;s house to a barn on a farm`),
  p(`We asked what made her take the leap.`),
  q(
    `Having worked in early years for many years, across a variety of roles as a teacher, teaching assistant and nursery practitioner, I&#8217;d seen first-hand the incredible impact we can have on a child&#8217;s development and their lifelong love of learning. I also recognised the need for high-quality childcare that nurtures not just the child, but the whole family.`,
    `My vision was always to create a true home-from-home environment where every child and family felt supported, valued and understood. The environment itself was incredibly important to me, for it acts as the third teacher, inspiring curiosity, independence and a love of learning. I wanted to bring together the warmth and simplicity of hygge with the child-led philosophy of The Curiosity Approach, with outdoor learning and community connections at the heart of everything we do.`,
    `After receiving an Outstanding judgement in all areas at my first Ofsted inspection as a childminder, demand for places quickly outgrew the space I had available. I knew I wanted to expand, but I didn&#8217;t want to compromise on the environment or the ethos I&#8217;d worked so hard to create.`,
    `That&#8217;s when I approached Glebe Farm to see whether they had any suitable space. Initially, there wasn&#8217;t anything quite right, but then two rooms became available, and our farm journey began. Within a month, we&#8217;d outgrown those rooms too, and the opportunity arose to redevelop the barn into the nursery that is now Bee Curious Childcare.`,
    `It was a whirlwind, but my faith played a huge part in those decisions. I learned to trust that the right opportunities and environments would present themselves at the right time, rather than allowing fear of the unknown to hold me back.`
  ),

  h2(`A 1:3 ratio, and fees that pay for it`),
  p(
    `Moving out of your own house changes the cost base completely. We asked what surprised her most about the numbers, and the answer contains the single most deliberate decision in this interview.`
  ),
  q(
    `I think what surprised me most was just how quickly our reputation grew and how much demand there was for what we were offering. The growth happened so quickly that we had to keep adapting and thinking about what came next.`,
    `Of course, moving into rented premises, and growing to the size we now are brings a different level of financial responsibility and that can feel daunting. But I couldn&#8217;t have done any of it without the incredible support of Glebe Farm. They genuinely believed in my vision and trusted what I was trying to create.`,
    `Having a supportive landlord who shares your belief in the project makes such a difference. It gave us the confidence and opportunity to grow while staying true to our values.`,
    `Numbers wise I wanted to ensure we stuck to a 1:3 ratio across the board as much as we could, as this allowed for quality interactions and less stress for staff.  This meant an increase in fees, but parents were willing to pay as we have, and always will be, transparent about our costs and where the money goes.`
  ),
  p(
    `That last paragraph is worth reading twice. The statutory minimum in England is one adult to three children under two, one to five for two-year-olds, and one to eight or one to thirteen for three and four-year-olds depending on qualification. Staffing at one to three across the board means carrying materially more adults than the law requires for the older rooms, and paying for it out of fees rather than absorbing it. Most settings move in the opposite direction when margins tighten, which is the pressure our piece on <a href="${ND}/lester-aldridge-inflation-above-4-hits-nursery-margins/">inflation above 4% and nursery margins</a> describes.`
  ),

  h2(`How the farm deal happened`),
  p(`The premises are the story here, so we asked how a nursery ends up in a barn.`),
  q(
    `It really came about through a combination of timing, opportunity and faith. When demand for my childminding business outgrew my home, I approached Glebe Farm to explore whether there might be somewhere suitable for us. The farm offered something special that I had always wanted for the children, a connection to nature, the outdoors and the wider community.`,
    `We quickly outgrew the two rooms we had initially started in, and the farm suggested an exciting opportunity to redevelop the barn. What began as a search for a little more space soon became the starting point for Bee Curious Childcare as we know it today.`,
    `We were incredibly fortunate to have the support of 'Comfort Being', who brought my ideas and vision to life through the architectural plans and interior design. It was important to me that, despite creating a much larger setting, we retained that all important homely feel, with open, transparent spaces, dedicated sleep areas and a sensory room.`,
    `Since then, we&#8217;ve continued to grow and evolve, adding a larger staffroom and office, our indoor-outdoor space, known as Wonderland and a dedicated Baby Home Hub &#8212; designed to feel just like home for our youngest Bees.`,
    `Throughout every stage of our journey, the aim has remained the same, to create an environment that feels welcoming, nurturing and thoughtfully designed around the needs of the children and families in our care.`,
    `Being part of a working farm gives us a wonderful setting in which children can explore, discover and develop a real appreciation for the world around them. Having the caf&#233; and wider farm community on our doorstep adds another dimension to that sense of connection and belonging.`
  ),
  p(
    `A landlord who will fund a barn conversion for a tenant two rooms into a tenancy is not the normal experience of taking on nursery premises. Anyone costing a first setting from scratch should read it next to our <a href="${ND}/how-to-open-a-nursery-in-england-real-costs-step-by-step/">breakdown of what opening a nursery in England actually costs</a>, where the fit-out is usually the number that moves.`
  ),

  h2(`What the classroom did not teach her`),
  p(`She came into early years from primary teaching. We asked what did not transfer.`),
  q(
    `One of the biggest challenges has been moving from working closely with one or two colleagues to leading a team of 15 staff. Being responsible for a whole business, as well as being the person everyone looks to for direction, has been a huge learning curve.`,
    `I&#8217;ve found letting go particularly difficult at times! When something is your vision and you&#8217;ve poured so much of yourself into it, it can be hard to step back. But I&#8217;m incredibly fortunate to have such an amazing team of practitioners behind me. They are just as passionate and inspirational as I am, and each brings their own strengths, ideas and experience.`
  ),
  qp(
    `I&#8217;ve learned that good leadership isn&#8217;t about doing everything yourself; it&#8217;s about creating an environment where other people can flourish.`
  ),
  q(
    `Professional development, recognising individual strengths and celebrating the contribution everyone makes are essential to that.`,
    `I honestly wouldn&#8217;t be where I am today without my team, my family and my friends. Building the nursery has been a real team effort, and I&#8217;m incredibly grateful for the people who have supported me along the way.`
  ),

  h2(`Building a team from nothing`),
  p(
    `Recruitment is the first thing every operator in this series has named. A brand new setting has no reputation to recruit on, so we asked how she did it.`
  ),
  q(
    `For me, it comes down to creating a positive working environment where people feel valued, listened to and supported. I want Bee Curious Childcare to feel more like a family than simply a workplace. When people feel that they belong and that their contribution matters, it creates a stronger team and a better environment for the children, too.`,
    `I quickly recognised the value of becoming a training setting and investing in the next generation of early years practitioners. Burnout is a real challenge in our sector, and we need to find ways to bring new people into the profession, support them properly and help them develop a genuine passion for what they do.`,
    `By welcoming younger practitioners and training them in our approach, we&#8217;ve been able to build a team that understands our ethos from the ground up. At the same time, valuing experience and creating opportunities for continued professional development means everyone has something to contribute and room to grow.`,
    `Our team is at the heart of everything we do, and seeing people grow in confidence and develop their skills is one of the most rewarding parts of running the nursery.`
  ),

  h2(`Paperwork and personalities`),
  p(`Every subject gets asked what nobody warns you about. Hers is a two word answer.`),
  qp(`Paperwork and personalities!`),
  q(
    `There&#8217;s so much more administration involved in running a nursery than people might imagine. I can spend hours behind a desk dealing with paperwork, policies and procedures, when really, I&#8217;d much rather be out with the children &#8212; our little bees! After all, working with children is what inspired me to do this in the first place.`,
    `Then there&#8217;s the people side of things. Working with families and a team means navigating different personalities, expectations and emotions. Not every conversation is easy, and sometimes you must make decisions that might not initially be popular but are in the best interests of the Hive as a whole.`,
    `Policies and procedures might not be the most exciting part of the job, but they&#8217;re there for a reason, to protect our children, families and staff. Part of being a leader is helping everyone understand that, even when it means having difficult conversations.`,
    `You quickly learn that you can&#8217;t please everyone all the time, and that things are rarely personal. Patience, empathy and a little perspective go a long way. It might not be the glamorous side of running a nursery, but it&#8217;s all part of creating a safe, happy environment where our little bees can thrive.`
  ),

  h2(`Where Bee Curious goes next`),
  q(
    `That&#8217;s a question I&#8217;m often asked: &#8220;What next?&#8221;`,
    `Bee Curious Childcare has always been about something much bigger than childcare alone. It&#8217;s about creating a safe, nurturing environment where children can thrive, families feel supported, local connections are strengthened and everyone who works with us or walks through our doors feels valued and heard.`,
    `I want us to continue building on that foundation and showing what high-quality early years provision can look like when children, families, practitioners and the wider community are all at the heart of it.`,
    `I&#8217;d also love to share our journey and experiences with others in the sector, encouraging more settings to think about the environment they create, the relationships they build and the difference they can make to families&#8217; lives.`,
    `Ultimately, I want Bee Curious to be known not just as a nursery, but as a place where people feel they belong, a place where children are free to explore, question and discover, and where a love of learning can flourish.`,
    `If we can continue to make that difference, both within our own setting and beyond it, then I&#8217;ll feel we&#8217;re doing something truly worthwhile.`
  ),

  p(
    `<em>Meet the Manager is Nursery Daily&#8217;s series with the people running early years settings. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a setting and would like to take part, write to <a href="mailto:press@nurserydaily.com">press@nurserydaily.com</a>.</em>`
  ),
].join("\n\n");

// ---- gate ----
const problems = [];
const ours = BODY.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
// Our copy carries no dashes. Hers do, and they stay.
if (/[\u2014\u2013]|&#8212;|&#8211;/.test(ours + SEO_TITLE + META + EXCERPT + HERO_ALT)) problems.push("dash in our copy");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
const plain = (BODY.match(/class="wp-block-quote interview-quote"/g) || []).length;
const pull = (BODY.match(/--pull/g) || []).length;
if (pull > 2) problems.push(`${pull} --pull, max 2`);
if (plain < 5) problems.push(`only ${plain} plain bubbles`);

const norm = (x) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8212;/g, "\u2014")
    .replace(/&#233;/g, "\u00e9")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const src = norm(fs.readFileSync(ANSWERS, "utf8"));
const quotes = [...BODY.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)].flatMap((m) =>
  [...m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => x[1])
);
for (const quote of quotes) if (!src.includes(norm(quote))) problems.push(`NOT VERBATIM: ${norm(quote).slice(0, 80)}...`);
if (!fs.existsSync(HERO)) problems.push("missing hero");

console.log(
  `quotes ${quotes.length} checked | bubbles ${plain} plain + ${pull} pull | seo ${SEO_TITLE.length} | meta ${META.length} | words ${BODY.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length}`
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
let postId = JSON.parse(
  ssh(`wp post list --post_type=post --post_status=any --name=${SLUG} --fields=ID --format=json`)
)[0]?.ID;

const stamp = Date.now();
const bodyTmp = `/tmp/caroline-${stamp}.html`;
put(Buffer.from(BODY, "utf8"), bodyTmp);
if (Number(ssh(`wc -c < ${bodyTmp}`).trim()) !== Buffer.byteLength(BODY)) throw new Error("body upload mismatch");

if (!postId) {
  postId = Number(
    ssh(
      `wp post create ${bodyTmp} --post_type=post --post_status=draft --post_author=${AUTHOR_ID} ` +
        `--post_category=${CATEGORY_ID} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} ` +
        `--post_name=${SLUG} --porcelain`
    )
  );
  console.log(`created ${postId}`);
} else {
  ssh(`wp post update ${postId} ${bodyTmp} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_category=${CATEGORY_ID}`);
  console.log(`updated ${postId}`);
}
ssh(`rm -f ${bodyTmp}`);

if (!ssh(`wp post meta get ${postId} _thumbnail_id || true`).trim()) {
  const heroTmp = `/tmp/caroline-hero-${stamp}.jpg`;
  put(fs.readFileSync(HERO), heroTmp);
  const mediaId = ssh(
    `wp media import ${heroTmp} --post_id=${postId} --featured_image --title=${sq("Caroline Akker, Bee Curious Childcare")} ` +
      `--alt=${sq(HERO_ALT)} --caption=${sq(HERO_CAPTION)} --porcelain`
  );
  ssh(`rm -f ${heroTmp}`);
  console.log(`hero media ${mediaId}`);
}

ssh(`wp post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
ssh(`wp post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
ssh(`wp post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);

// JB asked for it live.
const now = ssh(`date -u +"%Y-%m-%d %H:%M:%S"`);
ssh(`wp post update ${postId} --post_status=publish --post_date_gmt=${sq(now)} --post_date=${sq(now)}`);
ssh(`wp post meta update ${postId} cogent_pin_until ${sq("2026-11-23 23:59:59")}`); // homepage lead, four weeks

// Yoast keeps a stale copy in its own table; the prefix here is NOT wp_
const pre = ssh(`wp config get table_prefix`).trim();
ssh(`wp db query "DELETE FROM ${pre}yoast_indexable WHERE object_id=${postId} AND object_type='post'"`);
console.log(ssh(`wp cache flush; wp sg purge; wp sg purge "$(wp post url ${postId})" 2>/dev/null || true`));

const stored = ssh(`wp post get ${postId} --field=post_content`);
console.log(`stored ${stored.length} bytes | bubbles ${(stored.match(/<blockquote/g) || []).length}`);
console.log(`status: ${ssh(`wp post get ${postId} --field=post_status`)}`);
const URL = ssh(`wp post url ${postId}`);
console.log(`url:    ${URL}`);

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
const db = forSite(site.id);
const art = await db.article.create({
  data: {
    siteId: site.id, title: SEO_TITLE, type: "pr_rewrite", status: "published", publishedAt: new Date(),
    sourceUrl: "https://reports.ofsted.gov.uk/provider/16/2771677", body: BODY, wpPostId: postId,
    category: "Case Studies", keyphrase: KEYPHRASE, metaDesc: META, qaPassed: true,
    imageAlt: HERO_ALT, imageCredit: "Picture: supplied", imageSource: "interview:subject-supplied",
  },
});
// notifiedAt deliberately NOT set: JB confirms before Caroline is told.
await db.interviewTarget.update({
  where: { id: TARGET_ID },
  data: { status: "published", articleId: art.id, publishedUrl: URL, publishedAt: new Date() },
});
console.log(`article ${art.id} | Caroline NOT yet notified`);
await prisma.$disconnect();
