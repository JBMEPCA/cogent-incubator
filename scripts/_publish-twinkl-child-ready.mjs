/**
 * One-off, 25 Sep 2026: Twinkl's contributed piece by Tracie Butterfill on
 * building a "child-ready" setting, published on Nursery Daily, then a reply
 * to Marouso Menegou at Twinkl. JB: "Please upload to Nursery and email her
 * back".
 *
 * Route: Marouso pitched Lucas Payne on 23 Sep ("Re: Press List"); Lucas
 * forwarded it to press@ and jb@nurserydaily.com at 08:00 UK today. Her mail
 * is not in any mailbox of ours, so the reply is a NEW message to her with
 * Lucas copied, not a threaded reply.
 *
 * Her covering note offers to write the article and asks for a word count and
 * deadline, but the .docx attached IS the finished article, references and bio
 * included, so it is run as sent and the reply answers her questions for next
 * time.
 *
 * This is a contributed byline, not a press release, so it keeps Tracie's
 * words and argument. Editing is limited to house style: en dashes out, a few
 * hanging hyphens fixed, subheads regularised.
 *
 * TWO COMMERCIAL LINKS REMOVED. The bio seeded followed links on "Early Years"
 * (https://www.twinkl.co.uk/r/9ui4g, a tracking redirect) and "Families"
 * (https://www.twinkl.co.uk/parents, a consumer page; this title's reader runs
 * a setting, never a parent). Replaced with one plain followed link to
 * twinkl.co.uk in the bio. The reply says so rather than letting them find out.
 *
 * IMAGES: the .docx carried three. image2.png is a CGI render of a nursery
 * room and image3.png is a stock photo of an empty room with Cyrillic titles
 * on the bookshelf, so neither is run. Featured is Tracie's own headshot
 * (image1.jpg, 1230x2048) cropped to the top 4:3 slice so the 16/9 card crop
 * does not take her chin off, and the same shot at 400px in the author bio.
 *
 * NOTE FOR JB: Nursery Daily has NO guest-perspective burial hook. That
 * pre_get_posts hook lives only in the Smart SME child theme and was never
 * ported to cogent-base, so unlike Smart SME this piece WILL lead the
 * homepage until the next post lands.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-twinkl-child-ready.mjs [--publish] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const PUBLISH = process.argv.includes("--publish");
const SEND = process.argv.includes("--send");

const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/twinkl";
const HERO = `${D}/tracie-hero-a.jpg`;
const BIO_IMG = `${D}/tracie-butterfill-bio.jpg`;

const TO = "Marouso Menegou <marouso.menegou@twinkl.co.uk>";
const CC = "Lucas Payne <lucas@cimltd.co.uk>";

const ND = "https://nurserydaily.com";
const TWINKL = "https://www.twinkl.co.uk";
const TITLE = "Building a child-ready setting: inclusion as standard";
const SLUG = "building-a-child-ready-setting-inclusion-as-standard";
const KEYPHRASE = "child-ready setting";
const META =
  "Twinkl's Tracie Butterfill on auditing post-September practice and making inclusion standard provision, not a reaction to a SEND diagnosis.";
const ALT = "Tracie Butterfill, National Lead for Early Years and Families at Twinkl";
const CAPTION = "Tracie Butterfill, National Lead for Early Years and Families at Twinkl. Picture: Twinkl";
const CREDIT = "Picture: Twinkl";
const CATEGORY_ID = 8; // Operations & Tech, the closest fit; the title has no Opinion category
const AUTHOR_ID = 2; // james-burke

const P = (x) => `<p>${x}</p>`;
const H = (x) => `<h2 class="wp-block-heading">${x}</h2>`;

const BLOOM = [
  ["Remembering", "Who came to the three bears&#8217; house?"],
  ["Understanding", "Look at this puddle. What do you think has happened to the ice?"],
  [
    "Applying",
    "You&#8217;ve drawn a great map. How can we use these wooden shapes to build a house like the one on your map?",
  ],
  [
    "Analysing",
    "Why do you think the scales go down when Big Teddy sits on this side and Baby Bear is sat on the other?",
  ],
  ["Evaluating", "You&#8217;ve used the glue and the tape for your rocket. Which one worked better, and why?"],
  ["Creating", "The toy animals need a new home. Can you build a farm for them?"],
];

const MASLOW = [
  [
    "Physiological needs",
    "Feeling hungry, thirsty, tired, or physically uncomfortable. Knowing if they have eaten before arriving, if they had a good night&#8217;s sleep in their own bed the night before, being in tune with those telltale signs indicating that they need a break from an activity or at a certain point of the day, or even being able to identify when their clothes are feeling uncomfortable.",
  ],
  [
    "Providing safety and predictability",
    "When a child feels unsafe, their nervous system remains on high alert, which also prevents them from engaging in deep-level learning. Building a secure attachment with their Key Person and providing a repetitive, consistent routine and environment, which is facilitated by calm, predictable adults, will provide reassurance and support them to develop a sense of safety.",
  ],
  [
    "A sense of belonging",
    "Feeling seen, being heard, and knowing they are valued for all their uniqueness supports a child&#8217;s sense of self. Showcasing wow moments, family photos, community, and setting unity fosters a culture of inclusion where every child, family, and educator matters.",
  ],
  [
    "Little scientists",
    "Enabling play-based self-exploration, whatever that looks like for the unique child and their interests, will motivate them, enable them to gain focus, and support them to get to a place where deep-level learning can begin.",
  ],
];

const REFS = [
  [
    "Bitesize Learning (2024). Maslow&#8217;s Hierarchy of Needs.",
    "https://www.bitesizelearning.co.uk/resources/maslows-hierarchy-of-needs-theory",
  ],
  [
    "Department for Education (2024). Early Years Foundation Stage Statutory Framework (EYFS).",
    "https://www.gov.uk/government/publications/early-years-foundation-stage-framework--2",
  ],
  ["Ruhl, C. (2025). Bloom&#8217;s taxonomy of learning.", "https://www.simplypsychology.org/blooms-taxonomy.html"],
];

const bioImgBlock = (url) =>
  `<!-- wp:image {"width":"160px","sizeSlug":"full","linkDestination":"none"} -->\n` +
  `<figure class="wp-block-image size-full is-resized">` +
  `<img src="${url}" alt="${ALT}" style="width:160px"/></figure>\n` +
  `<!-- /wp:image -->`;

function buildBody(bioUrl) {
  return [
    `<p class="standfirst"><em>September is over and the settling-in is done. For nursery owners and managers, Twinkl&#8217;s national lead for early years argues that the autumn term is the window to audit what your setting actually does, and to stop treating inclusion as something that starts when a diagnosis arrives.</em></p>`,
    P(`<strong>By Tracie Butterfill, National Lead for Early Years and Families, Twinkl</strong>`),

    P(
      `As autumn starts to settle in, the operational pressure on early years management shifts from emotional turbulence to long-term quality assurance. For setting managers and leaders, now is the time to audit post-September practice, moving away from temporary transition strategies to leading a setting-wide &#8220;child-ready&#8221; culture that prioritises safety and inclusion over targets and attainment.`
    ),
    P(
      `For nursery owners, leaders and managers, as September ends and the autumn term takes hold, we are provided with a new window of opportunity. Either we allow the nursery floor to slip into a comfortable, &#8216;business as usual&#8217; routine of writing observations, logging baselines and planning activities around next steps, or we pause, reflect and begin to embed a truly child-ready culture.`
    ),
    P(
      `Inclusion is not an add-on or a reactive approach when needs have been identified or when a SEND diagnosis is given. True inclusive practice is an approach which is underpinned by high-quality provision as standard.`
    ),
    P(
      `Establishing and embedding this type of culture where every child and educator can thrive requires a shift in focus, from getting children ready for rules and routines to getting our settings, systems and staff ever ready for each unique child.`
    ),

    H("The baseline: Maslow"),
    P(
      `There can be a felt pressure as children settle, to collect data and set them off on the next steps of their learning journey. However, <a href="https://www.bitesizelearning.co.uk/resources/maslows-hierarchy-of-needs-theory">Maslow&#8217;s Hierarchy of Needs</a>, high-quality effective practice and pedagogical leadership all remind us that before any high-level learning can take place, a child&#8217;s needs must be fully met.`
    ),
    `<ul>${MASLOW.map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join("")}</ul>`,
    P(
      `Being child-ready means being attuned to the whole child and ensuring they feel safe, seen, valued, and comfortable. Only then will a child begin to feel a sense of belonging.`
    ),

    H("Room to bloom"),
    P(
      `Picture the 19th-century German word &#8220;Kindergarten&#8221;, which translates to children&#8217;s garden: an environment that is prepared well before anything is placed into it, where, when conditions are right, seedlings are nurtured, roots are grown, and growth is observed.`
    ),
    P(
      `Within our early years environments, we too must be prepared, prioritise nurture, and wait patiently for the child to feel safe, seen, and valued before we rush in with learning expectations and goals.`
    ),
    P(
      `Once roots are firmly established and growth is visible, frameworks like <a href="https://www.simplypsychology.org/blooms-taxonomy.html">Bloom&#8217;s Taxonomy</a> can be applied. This learning framework, which represents the levels that a learner goes through to acquire new knowledge, can be used to facilitate higher-level learning through play-based discovery and sustained shared thinking, for example.`
    ),
    P(
      `Practice that adopts an open-ended framing technique, rather than an interrogation approach, is less intimidating and supports children to &#8220;have a go&#8221; without the pressure of needing to &#8220;get it right&#8221;. When this approach is applied to the levels within Bloom&#8217;s Taxonomy, we are valuing effort, encouraging engagement, and facilitating deep-level learning.`
    ),
    `<ul>${BLOOM.map(([k, v]) => `<li><strong>${k}:</strong> &#8220;${v}&#8221;</li>`).join("")}</ul>`,
    P(
      `By embedding complex thinking into playful exploration, we can scaffold learning and creative thinking to every situation without applying pressure or unrealistic expectations.`
    ),

    H("The business of belonging"),
    P(
      `When leaders and managers prioritise psychological safety over premature assessment-chasing, mentor their teams in inclusive practice and defend the emotional wellbeing of both children and staff, the result is a resilient, thriving setting. By embedding these systems now, we ensure that every unique child who walks, crawls, or stumbles through our doors is met with the safety, respect, and attunement they need to reach their full potential.`
    ),

    H("About the author"),
    bioImgBlock(bioUrl),
    P(
      `<strong>Tracie Butterfill</strong> is National Lead for Early Years and Families at <a href="${TWINKL}">Twinkl</a>, covering PVI settings, childminders and the nought to twos. She has more than 30 years in early childhood education, holds a postgraduate EYPS and a BA in Early Childhood Studies, and is a qualified Mental Health First Aider. Her career spans regional trainer, higher education lecturer, local authority early years advisor and school trustee.`
    ),
    P(
      `<em>Contributed pieces carry the author&#8217;s own views. Nursery Daily edits for house style and length. If you run a setting and want to write for us, the address is <a href="mailto:press@nurserydaily.com">press@nurserydaily.com</a>.</em>`
    ),

    H("References"),
    `<ul>${REFS.map(([t, u]) => `<li>${t} <a href="${u}" rel="nofollow">${u}</a></li>`).join("")}</ul>`,

    `<p><em style="font-size:0.85em">${CREDIT}</em></p>`,
  ].join("\n\n");
}

// ---- gate ----
const probe = buildBody("PLACEHOLDER");
const plain = probe.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[\u2014\u2013]/.test(TITLE + probe + META + ALT + CAPTION)) problems.push("dash");
if (TITLE.length > 60) problems.push(`headline ${TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
if (/twinkl\.co\.uk\/(r\/|parents)/.test(probe)) problems.push("commercial Twinkl link survived");
const words = plain.split(" ").length;
if (words < 700) problems.push(`too short ${words}`);
for (const f of [HERO, BIO_IMG]) if (!fs.existsSync(f)) problems.push(`missing image ${f}`);
console.log(`title ${TITLE.length} | meta ${META.length} | words ${words}`);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
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

let postId = JSON.parse(
  wp(`post list --post_type=post --post_status=any --name=${SLUG} --fields=ID --format=json`)
)[0]?.ID;

if (PUBLISH && !postId) {
  const stamp = Date.now();
  // Draft first with a placeholder body, so the bio image can be attached to a
  // real post id and its URL written back into the copy.
  ssh(`base64 -d > /tmp/tw-body-${stamp}.html`, Buffer.from(buildBody(""), "utf8").toString("base64"));
  postId = Number(
    wp(
      `post create /tmp/tw-body-${stamp}.html --post_type=post --post_status=draft ` +
        `--post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} --post_title=${sq(TITLE)} ` +
        `--post_excerpt=${sq(META)} --post_name=${SLUG} --porcelain`
    )
  );

  ssh(`base64 -d > /tmp/tw-hero-${stamp}.jpg`, fs.readFileSync(HERO).toString("base64"));
  const heroId = wp(
    `media import /tmp/tw-hero-${stamp}.jpg --post_id=${postId} --featured_image ` +
      `--title=${sq("Tracie Butterfill, Twinkl")} --alt=${sq(ALT)} --caption=${sq(CAPTION)} --porcelain`
  );

  ssh(`base64 -d > /tmp/tw-bio-${stamp}.jpg`, fs.readFileSync(BIO_IMG).toString("base64"));
  const bioId = wp(
    `media import /tmp/tw-bio-${stamp}.jpg --post_id=${postId} ` +
      `--title=${sq("Tracie Butterfill headshot")} --alt=${sq(ALT)} --porcelain`
  );
  const bioUrl = wp(`post get ${bioId} --field=guid`);

  ssh(`base64 -d > /tmp/tw-final-${stamp}.html`, Buffer.from(buildBody(bioUrl), "utf8").toString("base64"));
  wp(`post update ${postId} /tmp/tw-final-${stamp}.html`);
  wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
  wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
  wp(`post update ${postId} --post_status=publish`);
  ssh(`rm -f /tmp/tw-hero-${stamp}.jpg /tmp/tw-bio-${stamp}.jpg /tmp/tw-body-${stamp}.html /tmp/tw-final-${stamp}.html`);

  const art = await prisma.article.create({
    data: {
      siteId: site.id,
      title: TITLE,
      type: "pr_rewrite",
      status: "published",
      publishedAt: new Date(),
      sourceUrl: TWINKL,
      body: buildBody(bioUrl),
      wpPostId: postId,
      category: "Operations & Tech",
      keyphrase: KEYPHRASE,
      metaDesc: META,
      qaPassed: true,
      imageAlt: ALT,
      imageCredit: CREDIT,
      imageSource: "press:twinkl",
    },
  });
  console.log(`published post ${postId}, hero ${heroId}, bio ${bioId}, article ${art.id}`);
}

if (!postId) {
  console.log("DRY RUN, gate passed, nothing written");
  await prisma.$disconnect();
  process.exit(0);
}
const status = wp(`post get ${postId} --field=post_status`);
const URL = wp(`post url ${postId}`);
console.log(`post ${postId} ${status} ${URL}`);

// ---- reply to Marouso ----
const SUBJECT = "Tracie Butterfill's child-ready piece is live on Nursery Daily";
const MAIL = `Hi Marouso,

Thanks for the pitch, and apologies for coming back to you directly rather than on your thread with Lucas. Yes, it was of interest. The article was attached in full so we have run it as it stood, and it is live on Nursery Daily under Tracie's byline:

${URL}

To answer your questions for next time. We take contributed pieces of 800 to 1,200 words, which is where this one sits. There is no fixed deadline, we publish them as they arrive, so the only thing worth timing is anything pegged to a date, and a week's notice is plenty for that. Send them to press@nurserydaily.com and they will reach the right place faster than the press list will.

Two things I should flag, both of them house rules rather than anything wrong with the piece.

We took out the two Twinkl links in Tracie's bio, the one on "Early Years" and the one on "Families", and replaced them with a single plain link to twinkl.co.uk. One followed link per contributed piece is what we give everybody, and our reader runs a setting rather than being a parent, so the parents page was not the right destination for them anyway.

On pictures, we used Tracie's headshot and not the two room images. One of them is a computer-generated render rather than a photograph, and the other is a stock shot of a room with Cyrillic titles on the bookshelf, which our readers would spot. A real photograph from a UK setting, or more of Tracie, will always get used.

If the piece goes up on Twinkl's own newsroom or blog, a link back to the article would be much appreciated. A standard followed link is all we need.

Best,

James Burke
Publisher, Nursery Daily
${ND}`;

if (/[\u2014\u2013]/.test(MAIL)) throw new Error("dash in email");
if (!SEND) {
  console.log("\nTo: " + TO + "\nCc: " + CC + "\nSubject: " + SUBJECT + "\n\n" + MAIL + "\n\n(email not sent, add --send)");
  await prisma.$disconnect();
  process.exit(0);
}
if (status !== "publish") {
  console.error("not published, not sending");
  process.exit(1);
}

const sender = outreachSender(creds.outreach);
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${MAIL.split(
  /\n\n+/
)
  .map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;
const part = (b, type, body) =>
  [
    `--${b}`,
    `Content-Type: ${type}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
  ].join("\r\n");
const enc = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
const b = `mime-${Date.now().toString(36)}`;
const raw = [
  [
    `From: ${sender.name} <${sender.email}>`,
    `To: ${TO}`,
    `Cc: ${CC}`,
    `Subject: ${enc(SUBJECT)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${b}"`,
  ].join("\r\n"),
  "",
  part(b, "text/plain", MAIL),
  part(b, "text/html", HTML),
  `--${b}--`,
  "",
].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("SEND FAILED:", out?.error?.message || res.status);
  process.exit(1);
}
console.log(`SENT id=${out.id} thread=${out.threadId}`);
await prisma.$disconnect();
