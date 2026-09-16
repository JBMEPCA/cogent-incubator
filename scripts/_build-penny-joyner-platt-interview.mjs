/**
 * SME Leaders: Penny Joyner-Platt, The Plattform. Rebuilds Smart SME draft 1295.
 *
 * The sweep read Penny's reply on 15 Sep 2026 and the auto-drafter made post
 * 1295 that evening, but from a truncated reply: replyBody is sliced to 8,000
 * characters and her answers run to about 9,700, so the draft never saw the end
 * of her seventh answer. Nobody was told the draft existed either, so JB found
 * out by forwarding the email.
 *
 * This rewrites 1295 in place, from the full email, in the locked format and
 * matching the live Martyn Barklett-Judge piece (post 951). It stays a draft.
 *
 * Every quote is her own sentences, selected and ordered as she wrote them.
 * The only edits are punctuation: her spaced dashes become commas, because the
 * house rule is no dashes anywhere. verify-quotes checks each sentence against
 * the email on letters alone, so a word change cannot slip through.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-penny-joyner-platt-interview.mjs --photos=<dir> [--dry]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
if (!PHOTOS) throw new Error("--photos=<dir containing IMG_1513.JPG, IMG_1515.JPG and penny-email.json>");
const HERO_FILE = path.join(PHOTOS, "IMG_1513.JPG"); // landscape 1024x683
const PORTRAIT_FILE = path.join(PHOTOS, "IMG_1515.JPG"); // portrait 1024x1536
const POST_ID = 1295;

const SME = "https://smartsme.co.uk";
const L = {
  plattform: "https://the-plattform.com/",
  list: "https://f-entrepreneur.com/female-founders-list-2025/",
  womenFounders: `${SME}/innovate-uk-backs-100-women-founders-how-your-small-business-can-apply-for-support/`,
  fourHours: `${SME}/marketing-four-hours-a-week/`,
  localSeo: `${SME}/local-seo-for-small-business-how-to-win-googles-map-pack/`,
};

const TITLE_TEXT = "Penny Joyner-Platt on finding the real story";
const TITLE = `<span class="franchise-eyebrow">SME Leaders:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `SME Leaders: ${TITLE_TEXT}`;
const EXCERPT =
  "Penny Joyner-Platt learnt what makes news on the floor of the Press Association before founding The Plattform, and was named on the f:Entrepreneur female founders list. She explains what small businesses pay for that does nothing, the pitch mistake she sees most, and how she tells a client their story is not a story.";
const META =
  "Penny Joyner-Platt of The Plattform on the PR small businesses pay for that does nothing, and how to find the story a journalist actually wants.";
const KEYPHRASE = "small business PR";
const SLUG = "sme-leaders-penny-joyner-platt-on-finding-the-real-story";

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((p) => `<p>${p}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const figure = (src, alt) =>
  `<figure class="wp-block-image size-full"><img src="${src}" alt="${alt}" loading="lazy" decoding="async"></figure>`;
// Curly quotes and apostrophes as entities, the way WordPress stores them.
const t = (s) => s.replace(/'/g, "&#8217;").replace(/“/g, "&#8220;").replace(/”/g, "&#8221;").replace(/…/g, "&#8230;");

function buildBody({ logoUrl, logoW, logoH, portraitUrl }) {
  return [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are The Plattform?</h2>
<img class="interview-company-logo" src="${logoUrl}" alt="The Plattform" width="${logoW}" height="${logoH}" loading="lazy" decoding="async">
</div>
<p>The Plattform is a Hertfordshire business and marketing development agency founded by Penny Joyner-Platt, working with founder-led businesses on PR, content, social media, awards and business coaching. It works from what she calls The Plattform Method, which starts with what is stopping a business growing rather than which marketing to buy.</p>
<dl>
<div>
<dt>Company</dt>
<dd>The Plattform</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.plattform}">the-plattform.com</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>PR and marketing</dd>
</div>
<div>
<dt>Based</dt>
<dd>Hertfordshire</dd>
</div>
</dl>
</section>`,

    p(t(`Most small businesses meet PR from the buying side. Penny Joyner-Platt learnt it from the other side of the desk, where the press release lands and, more often than not, goes nowhere.`)),

    q(t(`It taught me very early on that what matters enormously to a business doesn't necessarily matter to a journalist, or their audience. Nobody in a newsroom is sitting there thinking, “How can I promote this company today?” They're asking: Is there a story? Why does it matter? Why now? Who cares?`)),

    p(t(`Joyner-Platt started her career at GCap Media, now part of Global, moved to ITV, and then into PR at the Press Association, working on the news floor. After a spell at an integrated marketing agency she founded <a href="${L.plattform}">The Plattform</a>, and she was named on the <a href="${L.list}">f:Entrepreneur female founders list</a>, one of a growing number of routes to recognition and support for women founders alongside <a href="${L.womenFounders}">Innovate UK's backing for 100 women founders</a>.`)),

    q(t(`And you learn very quickly that a beautifully written press release can't rescue a story that simply isn't interesting.`)),

    h2(`The question she still starts with`),
    p(t(`The newsroom test is still the first thing she applies to a client.`)),
    q(
      t(`Even now, my starting point isn't, “What does the client want to say?”`),
      t(`It's, “Why should somebody who has never heard of this business care?”`),
      t(`If we can't answer that, we haven't found the story yet.`)
    ),

    h2(`What small businesses pay for that does nothing`),
    p(t(`Small businesses are sold PR constantly. Asked what most of them are paying for that achieves nothing, she needed three words.`)),
    q(
      t(`Activity without purpose.`),
      t(`Press releases because “we should do some PR”. Generic thought-leadership articles nobody has anything interesting to say in. Huge distribution lists where relevance has been sacrificed for volume. Coverage reports full of impressive-looking numbers that nobody connects back to what the business is actually trying to achieve.`)
    ),
    p(t(`She sees the same pattern across the whole marketing budget, and it will be familiar to any owner trying to run <a href="${L.fourHours}">marketing on four hours a week</a>.`)),
    q(t(`Businesses are paying somebody to post on social media, somebody else to do SEO, another company to run ads, somebody to build a website, and nobody has stopped to ask why all these things exist or whether they're working together.`)),
    p(t(`Which is why she will not sell a client PR by default.`)),
    q(t(`I think good consultants have to be prepared to tell a client when the thing they think they need isn't actually the thing they need.`)),

    h2(`Being local is not the story`),
    p(t(`For a local business the temptation is to treat any milestone as news. Local visibility is what <a href="${L.localSeo}">winning Google's map pack</a> is for. A newsroom wants something else.`)),
    q(
      t(`Being local isn't the story.`),
      t(`Opening a business, launching a new website, hiring someone or celebrating your third anniversary might be hugely important to you, but that doesn't automatically make it news.`),
      t(`What I look for is the human story behind the business.`)
    ),
    p(t(`That is where she thinks small firms hold an advantage they rarely use.`)),
    q(
      t(`One of the biggest opportunities small businesses have is actually something larger companies spend fortunes trying to manufacture: real people and real stories.`),
      t(`Founders have opinions, struggles, personalities, customers, communities and lived experience.`),
      t(`Don't try to sound like a corporation. That's often the least interesting thing you can do.`)
    ),

    h2(`Less noise, not more`),
    p(t(`Newsrooms have shrunk while the PR industry has grown, and she thinks the industry's response has made things worse.`)),
    q(
      t(`The worst possible response from PR has been to compensate by sending more.`),
      t(`More releases. Bigger databases. More automated pitching. More follow-ups.`),
      t(`That's created an enormous amount of noise.`),
      t(`I think our job is increasingly to reduce that noise.`),
      t(`Know who you're approaching. Understand what they cover. Give them something genuinely useful. Make it easy for them to see the story. Have good assets ready. Be available. And if it's not right for them, don't keep pestering them until they block your number!`)
    ),

    h2(t(`“We're delighted to announce”`)),
    p(t(`The pitch mistake she sees most often is one most founders will recognise.`)),
    q(
      t(`Leading with the company instead of the story.`),
      t(`“We're delighted to announce…”`),
      t(`You've probably lost me already.`)
    ),
    p(t(`What she asks instead is the newsroom test again.`)),
    q(
      t(`What's changed? Why does it matter? Who does it affect? Why now?`),
      t(`The business belongs inside the story. It doesn't automatically make the story.`)
    ),

    h2(`Telling a client it is not a story`),
    q(
      t(`I tell them.`),
      t(`Nicely, but I tell them.`),
      t(`One of the promises I've made with The Plattform is that I'll tell clients what they need to hear, not simply what they want to hear.`)
    ),
    p(t(`Saying no is only half the job.`)),
    q(t(`My response is usually: “That's not the story, but let's find the story.”`)),
    p(t(`That means asking questions until the real story turns up.`)),
    q(
      t(`Quite often the interesting story is sitting three questions underneath the thing the client originally wanted to announce.`),
      t(`And finding that is one of my favourite parts of the job.`)
    ),

    h2(`Where The Plattform goes from here`),
    figure(portraitUrl, "Penny Joyner-Platt, founder of The Plattform, at a podcast microphone"),
    q(
      t(`What I've realised is that most founder-led businesses I meet don't actually have a marketing problem. They have a clarity problem.`),
      t(`PR is over here. Social media is over there. Somebody else built the website. Another supplier is running ads. Sales are doing their own thing, and the founder is stuck in the middle carrying the vision and trying to join everything together.`)
    ),
    p(t(`Her answer is to stop selling individual services. The Plattform is becoming a strategic marketing partner for founder-led businesses, built around The Plattform Method: discover, define, develop, deliver and grow. A shorter strategic deep dive, The Plattform Reset, is for founders who suspect the business could be doing more.`)),
    q(
      t(`I don't start by asking, “What marketing do you need?”`),
      t(`I ask, “What is stopping your business growing?”`),
      t(`Because ultimately, that's what The Plattform is about.`),
      t(`We don't build marketing campaigns. We build businesses that people believe in.`)
    ),
    p(t(`It is the newsroom question in a different form. Before anyone writes a press release, posts on social media or buys an ad, somebody has to work out why it matters. For most small businesses, that is the step that gets skipped.`)),

    p(t(`<em>SME Leaders profiles the people building Britain's best small businesses. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");
}

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`seo title: ${SEO_TITLE.length} chars | meta: ${META.length} chars`);

async function logoPng() {
  const src = "https://the-plattform.com/wp-content/uploads/2024/06/The-Plattform-2.0-Logo-Suite_The_Main-copy.png";
  const r = await fetch(src, { headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" } });
  if (!r.ok) throw new Error(`logo fetch ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const trimmed = await sharp(buf).trim({ threshold: 12 }).resize({ width: 800, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
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
const hero = fs.readFileSync(HERO_FILE);
const portrait = fs.readFileSync(PORTRAIT_FILE);

if (DRY) {
  const data = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
  const body = buildBody({ logoUrl: data(logo.buf, "image/png"), logoW: logo.width, logoH: logo.height, portraitUrl: data(portrait, "image/jpeg") });
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const proof = `<title>Proof: ${SEO_TITLE}</title>
<style>
  :root{--brand:#2E3EEE;--ink:#0A0C16;--muted:#5A5E75;--bg:#F4F5FA}
  body{background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,"Times New Roman",serif;margin:0}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px}
  .note{font:13px/1.5 system-ui,sans-serif;background:#fff7e0;border:1px solid #e8d49a;border-radius:8px;padding:12px 14px;margin-bottom:28px;color:#5a4a12}
  h1{font:700 34px/1.2 system-ui,sans-serif;margin:0 0 14px}
  .franchise-eyebrow{color:var(--brand)}
  .standfirst{font:19px/1.5 system-ui,sans-serif;color:var(--muted);margin:0 0 20px}
  .hero{width:100%;height:auto;border-radius:6px;display:block;margin-bottom:28px}
  h2{font:700 23px/1.3 system-ui,sans-serif;margin:34px 0 10px}
  .interview-company{background:#fff;border-top:4px solid var(--brand);padding:20px 22px;margin:0 0 28px}
  .interview-company-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
  .interview-company-head h2{margin:0;font-size:21px}
  .interview-company-logo{max-width:200px;max-height:48px;width:auto;height:auto;object-fit:contain}
  .interview-company dl{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 0;font:14px system-ui,sans-serif}
  .interview-company dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .interview-company dd{margin:0;overflow-wrap:anywhere}
  .interview-quote{background:#fff;border-left:3px solid var(--brand);border-radius:14px;margin:18px 0;padding:14px 20px;box-shadow:0 1px 2px rgba(46,62,238,.12),0 6px 18px rgba(46,62,238,.08)}
  .interview-quote p{margin:.4em 0}
  figure{margin:22px 0}figure img{max-width:100%;height:auto;border-radius:6px;display:block}
  a{color:var(--brand)}
</style>
<div class="wrap">
  <div class="note"><strong>Proof, not published.</strong> Local preview approximating Smart SME. The real draft is post ${POST_ID}. About ${words} words. Every quote is Penny's own sentences; the only edits are her dashes changed to commas.</div>
  <h1>${TITLE}</h1>
  <p class="standfirst">${EXCERPT}</p>
  <img class="hero" src="${data(hero, "image/jpeg")}" alt="Penny Joyner-Platt, founder of The Plattform">
  ${body}
</div>`;
  const out = path.join(PHOTOS, "penny-joyner-platt-proof.html");
  fs.writeFileSync(out, proof);
  console.log(`DRY RUN: ~${words} words, dashes in body: ${/[—–]/.test(body)}\nproof: ${out}`);
  process.exit(0);
}

// ---------- rewrite post 1295 in place, over SSH --------------------------------
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { stripQuotedReply } = await import("../lib/interviews.js");
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

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, expected draft`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`plattform-logo-${stamp}.png`, logo.buf);
put(`penny-hero-${stamp}.jpg`, hero);
put(`penny-portrait-${stamp}.jpg`, portrait);
const imp = (file, title, alt) => wp(`media import /tmp/${file} --title=${sq(title)} --alt=${sq(alt)} --porcelain`);
const logoId = imp(`plattform-logo-${stamp}.png`, "The Plattform logo", "The Plattform");
const heroId = imp(`penny-hero-${stamp}.jpg`, "Penny Joyner-Platt, The Plattform", "Penny Joyner-Platt, founder of The Plattform");
const portraitId = imp(`penny-portrait-${stamp}.jpg`, "Penny Joyner-Platt, The Plattform (portrait)", "Penny Joyner-Platt, founder of The Plattform, at a podcast microphone");
const url = (id) => wp(`post get ${id} --field=guid`);
const body = buildBody({ logoUrl: url(logoId), logoW: logo.width, logoH: logo.height, portraitUrl: url(portraitId) });
put(`penny-body-${stamp}.html`, Buffer.from(body, "utf8"));

wp(`post update ${POST_ID} /tmp/penny-body-${stamp}.html --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --post_name=${SLUG} --post_category=8`);
wp(`post meta update ${POST_ID} _thumbnail_id ${heroId}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${POST_ID} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
ssh(`rm -f /tmp/plattform-logo-${stamp}.png /tmp/penny-hero-${stamp}.jpg /tmp/penny-portrait-${stamp}.jpg /tmp/penny-body-${stamp}.html`);

// Store the whole reply, which the sweep had cut at 8,000 characters, and keep
// the Article row describing the draft that actually exists.
const email = JSON.parse(fs.readFileSync(path.join(PHOTOS, "penny-email.json"), "utf8"));
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { personName: { contains: "Penny Joyner-Platt" } } });
await db.interviewTarget.update({ where: { id: target.id }, data: { replyBody: stripQuotedReply(email.body), headshotUrl: url(heroId) } });
if (target.articleId) {
  await db.article.update({ where: { id: target.articleId }, data: { title: SEO_TITLE, metaDesc: META, keyphrase: KEYPHRASE } });
}
await prisma.$disconnect();

console.log(wp(`post get ${POST_ID} --fields=ID,post_status,post_name --format=json`));
console.log(`media: logo ${logoId}, hero ${heroId}, portrait ${portraitId}`);
console.log(`preview: ${SME}/?p=${POST_ID}&preview=true`);
console.log(`edit:    ${SME}/wp-admin/post.php?post=${POST_ID}&action=edit`);
