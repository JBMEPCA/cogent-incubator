/**
 * SME Leaders: Antony Draper, Antony Draper Advisory. Built as a DRAFT on Smart SME.
 *
 * JB, 21 Oct 2026: "show me a proof on wp". Nothing here publishes and
 * nothing emails Antony.
 *
 * Source: his emailed answers of 21 Oct 2026 06:30 UK, saved verbatim in
 * scripts/interviews/antony-draper-answers.txt. The InterviewTarget row was
 * locked to "drafted" first so the sweep cannot draft a second copy.
 * His answers needed no proof edits; every quote is word for word.
 *
 * Facts: Royal Navy 1994 to 2005 (his about page), aircraft engineer, then
 * HP, Capita and public sector. The client example is anonymised by him and
 * stays that way. No location on his site, so the card has no Based row.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-antony-draper-interview.mjs --photo=<file> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTO = (process.argv.find((a) => a.startsWith("--photo=")) || "").split("=").slice(1).join("=");
if (!PHOTO) throw new Error("--photo=<file>");
const SOURCE = fs.readFileSync("scripts/interviews/antony-draper-answers.txt", "utf8");

const SME = "https://smartsme.co.uk";
const SITE = "https://antonydraper.com/";
const HUB = `${SME}/sme-leaders/`;
const TARGET_ID = "cmvgdlc5e0001myfyn3t0joca";
const TITLE_TEXT = "Antony Draper on the payment that never came";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Antony Draper's first business, built after eleven years in the Royal Navy, failed when a client payment he had already spent never arrived. He now helps founder-led firms get decisions out of the owner's head, and explains the test he uses.";
const META =
  "Antony Draper's first business failed on a client payment he had already spent. Now he helps founders hand over decisions. The test he uses, and why.";
const KEYPHRASE = "founder dependency";
const SLUG = "sme-leaders-antony-draper-on-the-payment-that-never-came";
const HERO_ALT = "Antony Draper, founder of Antony Draper Advisory";
const CAPTION = "Antony Draper, founder of Antony Draper Advisory. Picture: supplied";

const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;");
const q = (...paras) => `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${t(x)}</p>`).join("\n")}\n</blockquote>`;
const pull = (...paras) => q(...paras).replace("interview-quote\"", "interview-quote interview-quote--pull\"");
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${t(s)}</p>`;

const BODY = [
  `<p class="standfirst"><em>${t(`Antony Draper left the Royal Navy in 2005 and built a business to help other people make the same move. It failed on one decision: spending money before a client had paid it. He carried the debt home, rebuilt, and now works with founder-led firms of 20 to 50 people on the problem he says he understands from the inside, a business that cannot move without one person's judgement. He answered our seven questions in writing.`)}</em></p>`,
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who is Antony Draper Advisory?</h2>
</div>
<p>${t(`An advisory practice helping established, founder-led service firms of around 20 to 50 staff reduce their dependence on the owner, by making clear who can decide what, who owns the outcome and when a problem needs to go back to the founder. Draper served in the Royal Navy from 1994 to 2005 as an aircraft engineer, then worked across HP, Capita and the public sector.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>Antony Draper Advisory</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${SITE}">antonydraper.com</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Business advisory</dd>
</div>
</dl>
</section>`,
  `<p>Most interviews in this series are about a decision that worked. This one starts with one that did not. <a href="${SITE}">Antony Draper</a> is candid about it, and the answers below are his own words.</p>`,

  h2(`The decision that sank it`),
  p(`We asked what sank the business he built after leaving the Navy, and when he knew.`),
  q(
    `Leaving the military was a much bigger adjustment than I expected. I had a career consultant help me prepare, and I wanted to build a business that supported other people making that transition.`,
    `The specific mistake was spending money in advance of a client payment. I was relying on that money arriving, and it didn't.`,
    `When the payment failed to come through, I knew the business didn't have enough money to survive. That was the point when the consequences of the decision became clear.`
  ),
  pull(`I understood the personal problem because I had lived it. But understanding a problem and building a commercially viable business around it are two different jobs.`),
  q(`The business failed, and the financial consequences came home with me. That experience changed how I look at business. I still care about the ambition, but I want to understand how the business makes money, what it costs to deliver and what happens if the assumptions are wrong.`),
  p(`Spending money you have been promised but not yet received is one of the commonest ways a small business runs out of cash, and one of the least visible until the day it happens. The order is in, the invoice is raised, and the cost goes out on the assumption the payment will follow. When it does not, there is no buffer.`),

  h2(`What rebuilding actually looked like`),
  q(
    `It meant dealing with debt and rebuilding my income. There wasn't a clever shortcut. I had to face the position, work through the obligations and keep moving.`,
    `The military had taught me to function under pressure. That helped, but it didn't make the situation painless. When a business fails, it can feel as though the verdict is on you as a person.`
  ),
  p(`His advice to an owner facing the same thing is practical rather than consoling.`),
  q(
    `My advice to another owner would be to get the facts out of your head and onto paper. What do you owe? What income is dependable? What needs dealing with first? Get help where you need it, and tell the people affected what is happening.`,
    `Then give yourself a manageable next action. You can spend so much energy judging yourself that you have none left to improve the position.`
  ),

  h2(`The test for whether a team can really act`),
  p(`Draper now tests whether the people in a business actually have the authority to make decisions, or only appear to. We asked what the test is.`),
  q(
    `Take a real decision from last week. Ask the founder and the manager separately: who could make that decision, what were their limits, and when should they have escalated it?`,
    `If you get different answers, there is work to do.`,
    `Then look at what actually happened. A manager might technically have authority but still wait for permission because the founder reversed their last decision. Or they might lack information that only the founder holds.`,
    `My own experience made me more demanding about the gap between what we believe is happening and what the evidence shows. A job title or an organisation chart tells you very little about whether someone can act.`
  ),
  p(`It is a test any owner can run this week, and it takes ten minutes. The point about the reversed decision is the sharp one: a manager who has been overruled once will wait to be asked the next time, whatever their job description says.`),

  h2(`What the Navy taught, and what HP and Capita added`),
  q(
    `As an aircraft engineer, you learn that standards, responsibility and clear communication have practical consequences. People need to know what they are responsible for, where their authority ends and when to raise a problem.`,
    `You also learn that you cannot supervise every action personally. You need competent people who understand their responsibilities.`,
    `HP, Capita and public sector work exposed me to a different kind of complexity: commercial pressures, competing priorities and decisions that cross several teams or organisations.`,
    `You can have a sound plan and still get nowhere if the people needed to deliver it have different incentives or understand the problem differently.`,
    `Both experiences matter in my work now. Clear authority helps people act. Understanding the wider organisation helps them act together.`
  ),

  h2(`When the founder is the operating system`),
  p(`We asked for one real example. He chose a client and kept it anonymous.`),
  q(
    `I worked with a financial education business with around 40 people. There was a team in place, but too much still came back to the founder. His judgement was effectively the operating system for the business.`,
    `The dependence sat in deciding who could act, who owned the outcome and which problems genuinely needed his involvement. Having people doing the work hadn't removed the need for him to keep making the decisions.`,
    `I worked with them to rebuild decision-making authority and accountability. We clarified who owned what, what they could decide and when something needed to come back to the founder. That made the boundaries explicit rather than leaving people to guess.`,
    `Within 60 days, escalations to the founder had dropped by more than half, and he got his weekends back.`
  ),
  p(`Hiring people is not the same as handing over decisions. A firm of 40 with a founder who still decides everything has the cost of a team and the capacity of one person.`),

  h2(`Independent, not absent`),
  p(`He works with firms of 20 to 50 staff and argues that founder independence does not mean founder absence. We asked where the line is.`),
  q(
    `The founder should still shape the direction of the business, set standards and make the major commitments. The problem comes when ordinary work cannot move without them.`,
    `If you employ an operations manager but still decide every delivery exception, you haven't really handed over the responsibility. You've handed over the administration.`,
    `The other extreme is stepping away before people have the authority, information or capability to carry the work. That leaves managers exposed and customers dealing with the consequences.`,
    `Look at what happens during an ordinary week when you are unavailable. Do decisions keep moving within agreed limits? Do serious problems reach you promptly? Can you see performance without asking six people for updates?`,
    `Those answers tell you more than how many tasks you have delegated.`
  ),
  p(`It matters beyond the founder's weekends. A business that cannot run without its owner is worth less to a buyer, because the buyer is not getting the thing that makes it work.`),

  h2(`What comes next`),
  q(
    `A more focused business helping established service firms reduce their dependence on the owner.`,
    `The work starts by identifying where decisions, customer relationships and delivery still rely too heavily on one person. Then it moves into implementation: clearer management responsibilities, better performance information and a practical rhythm for running the business.`,
    `I'm also building relationships with accountants, finance directors and corporate finance advisers. They often see the consequences of operational problems in the numbers or during sale preparation. I can help owners address what is happening inside the business.`,
    `I want to build a business that meets the same test I put to clients: clear about who it helps, disciplined about delivery and able to keep its promises.`
  ),

  `<p><em><a href="${HUB}">SME Leaders</a> is Smart SME&#8217;s series with the people who own and run UK small businesses. Answers are published in the subject&#8217;s own words, with cuts only for length. If you run a business and would like to take part, write to <a href="mailto:press@smartsme.co.uk">press@smartsme.co.uk</a>.</em></p>`,
].join("\n\n");

// ---- gate ----
const problems = [];
if (/[—–]/.test(BODY + TITLE + EXCERPT + META + HERO_ALT + CAPTION)) problems.push("dash somewhere");
if (SEO_TITLE.length > 60) problems.push(`seo title ${SEO_TITLE.length}`);
if (META.length > 155) problems.push(`meta ${META.length}`);
const norm = (x) => x.replace(/<[^>]+>/g, "").replace(/&#8217;|[‘’]/g, "'").replace(/&#8220;|&#8221;|[“”]/g, '"').replace(/\s+/g, " ").trim();
const src = norm(SOURCE);
for (const m of BODY.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)) {
  for (const para of m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const n = norm(para[1]);
    if (!src.includes(n)) problems.push(`NOT VERBATIM: ${n.slice(0, 90)}`);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const ours = BODY.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
console.log(`gate ok | seo ${SEO_TITLE.length} | meta ${META.length} | ~${ours} words of ours`);

// ---- hero: portrait headshot on a blurred 16:9 ----
const H = 900, W = 1600;
const fg = await sharp(PHOTO).rotate().resize({ height: H }).toBuffer();
const fgW = (await sharp(fg).metadata()).width;
// White studio backdrop, so extend with white rather than a blur.
const base = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
const hero = await sharp(base).composite([{ input: fg, left: Math.round((W - fgW) / 2), top: 0 }]).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
if (DRY) { fs.writeFileSync(PHOTO.replace(/\.\w+$/, "-hero.jpg"), hero); console.log("DRY: hero written"); process.exit(0); }

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
  .filter((r) => /Draper/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => r.ID).join(",")}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`draper-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/draper-hero-${stamp}.jpg --title=${sq("Antony Draper, Antony Draper Advisory")} --alt=${sq(HERO_ALT)} --caption=${sq(CAPTION)} --porcelain`);
put(`draper-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
const postId = wp(
  `post create /tmp/draper-body-${stamp}.html --post_type=post --post_status=draft --post_category=8 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/draper-hero-${stamp}.jpg /tmp/draper-body-${stamp}.html`);
const db = forSite(site.id);
await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { headshotUrl: wp(`post get ${heroId} --field=guid`) } });
await prisma.$disconnect();
console.log(`DRAFT ${postId} hero ${heroId}`);
console.log(`preview: ${SME}/?p=${postId}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${postId}&action=edit`);
