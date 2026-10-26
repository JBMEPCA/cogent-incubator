/**
 * Gym Champions: Kevin Braddock, The Soma Space (Oswestry). Built as a
 * WordPress DRAFT for JB to preview. JB, 16 Oct 2026: "Proof please".
 *
 * Source: the reply of 16 Oct 2026 10:36 UK from somadynamic23@gmail.com,
 * all seven answers plus one photo. Written by Kevin Braddock (the
 * psychotherapist, Boxercise and Tai Chi instructor), who co-founded the space
 * with Jo Hazell-Watkins (Level 3 PT, trauma-informed exercise specialist).
 * Row locked to "drafted" before the sweep read it.
 *
 * House shape (JB, 8-14 Oct): h2 prose sections, every quote a plain
 * .interview-quote (bubbles via the Gym child theme), a line of our text before
 * every bubble and never two bubbles in a row, positive framing. Quotes are his,
 * trimmed not reworded. Edits are spelling and punctuation only: nine typos
 * (perfomance, awarness, interocpetion, espeically, begining, especally,
 * psyhotherapeutic, prescibers, mainatining), "CIMPSA" to "CIMSPA", and his
 * dashes recast as commas or full stops for the house no-dash rule.
 *
 * Photo: 1500x2000, Jo left and Kevin right (
 * NOT verified: assumed from the founders named in the answers; JB to confirm). Hero is the whole
 * photo at full height in the middle of a 1920x1080 canvas with blurred sides,
 * the shape JB settled on 14 Oct. No logo.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-soma-space-interview.mjs --hero=<jpg> [--post=<id> [--keep-hero]]
 */
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const HERO = (process.argv.find((a) => a.startsWith("--hero=")) || "").slice(7);
if (!HERO || !fs.existsSync(HERO)) throw new Error("--hero=<jpg>");
const TARGET_ID = "cmv514a25002f10pgkd6hnjbh";
const HERO_ALT = "Jo Hazell-Watkins and Kevin Braddock, co-founders of The Soma Space, sitting on a plyo box and a bench in their gym in Oswestry";
const HERO_CAPTION = "Jo Hazell-Watkins (left) and Kevin Braddock at The Soma Space. Picture: supplied";

const GYM = "https://gymbusinessnews.com";
const L = { site: "https://thesoma.space/", hub: `${GYM}/gym-champions/` };

const TITLE_TEXT = "Kevin Braddock on a gym for mental health";
const TITLE = `<span class="franchise-eyebrow">🏋️ Gym Champions:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `Gym Champions: ${TITLE_TEXT}`;
const EXCERPT =
  "At The Soma Space in Oswestry, nobody is training for a six pack. Co-founder Kevin Braddock explains how a psychotherapist and a trauma-informed PT built a gym for mental health, why Tai Chi, Boxercise and strength sit side by side, and why they now train other instructors.";
const META =
  "The Soma Space co-founder Kevin Braddock on running a gym for mental health in Oswestry, trauma-informed training and teaching other instructors.";
const KEYPHRASE = "gym for mental health";
const SLUG = "gym-champions-kevin-braddock-on-a-gym-for-mental-health";
const CATEGORY_ID = 3; // Start & Grow
const AUTHOR_ID = 2;

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/’/g, "&#8217;");

const BODY = [
  `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are The Soma Space?</h2>
</div>
<p>${t(`The Soma Space is a gym in Oswestry, Shropshire, built around movement for mental health. It was co-founded in 2023 by psychotherapist and instructor Kevin Braddock and trauma-informed PT Jo Hazell-Watkins, runs strength, Boxercise and Tai Chi groups, and now teaches other instructors through a CIMSPA-endorsed CPD course.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>The Soma Space</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">thesoma.space</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Exercise for mental health</dd>
</div>
<div>
<dt>Based</dt>
<dd>Oswestry, Shropshire</dd>
</div>
</dl>
</section>`,

  p(t(`Most gyms sell strength, speed or a better body. <a href="${L.site}">The Soma Space</a> in Oswestry sells something else. Kevin Braddock, a psychotherapist turned fitness instructor, and Jo Hazell-Watkins, a Level 3 PT who specialises in trauma-informed weight lifting, opened it at the start of 2023 as a gym for mental health. Their course for other instructors is now endorsed by CIMSPA. Braddock told us how it works.`)),

  h2(`A different reason to train`),
  p(t(`The difference starts with what a session is for.`)),
  q(t(`The focus at sessions at The Soma Space is on exercise for the benefit of mental health, rather than for physical performance, aesthetics and body composition goals.`)),
  p(t(`Clients can work one to one, join a longer small group programme or come to community sessions. Many sessions build in time to talk about how exercise helps the mind, and to reflect on what it does for each person.`)),
  q(t(`Exercise can be a great way for clients to explore ideas such as self-awareness, embodiment, interoception, autonomy and so on.`)),

  h2(`Meeting people where they are`),
  p(t(`Bringing psychotherapy and trauma-informed practice into a gym shapes everything from the first conversation onwards. Every new client starts with a consultation about what would suit them.`)),
  q(t(`Much of our work involves assisting clients to overcome anxieties attached to beginning exercise. After all, starting exercise can be anxiety-inducing for anyone, but especially for clients experiencing poor mental health.`)),
  p(t(`That, he says, is where the two disciplines earn their place.`)),
  q(t(`We aim to meet clients where they're at both physically and psychologically, and understand their situation in life and what barriers they may have to beginning exercise, so that we can help them overcome them.`)),

  h2(`Referred by the GP`),
  p(t(`The gym's tagline is Movement For Mental Health, and its clients are people who want to exercise but find the high street gym off-putting. Many arrive with a recommendation from a professional.`)),
  q(t(`People often find us through recommendations from local GP surgeries or social prescribers, or via word of mouth or social media.`)),

  h2(`Tai Chi, Boxercise and a barbell`),
  p(t(`The mix of disciplines comes from the founders' own training. Hazell-Watkins brought years of strength work; Braddock trained as a therapist, then as a fitness and Boxercise instructor, and has practised Tai Chi for more than a decade. In practice, the three fit together neatly.`)),
  q(t(`We found that while clients after some time will bias towards one of these modalities, the combination in sessions of Tai Chi to warm up and cool down, boxercise to raise energy, and strength training to work on strength, works really well.`)),

  h2(`Teaching other instructors`),
  p(t(`The Soma Space now runs a training arm alongside the gym, with a CIMSPA-endorsed CPD programme for other fitness professionals. Braddock sees it as the way to share what they have learned without losing what they built.`)),
  q(t(`Adding a training wing to The Soma Space operation and offering our CIMSPA-endorsed CPD programme is the best way for us to share our best practice and evidence from running this project since the beginning of 2023, and to meet a growing demand for trauma-informed exercise for mental health facilitation, while maintaining The Soma Space as a valuable community asset.`)),

  h2(`The part nobody warns you about`),
  p(t(`A specialist gym still has floors to mop. Braddock treats that as part of the job.`)),
  q(t(`Mopping the floor, taking out the bins and repairing the floor when the space is flooded (which has only happened once... touch wood) are all good ways of keeping our feet on the ground and staying humble with the task of running the space so that clients always have a positive experience of it and of us as facilitators.`)),

  h2(`A Soma Space in every town`),
  p(t(`Next, the founders want to work with other practitioners and organisations to take their approach further. There are gyms for every appetite, he says, but too few built for people with mental health needs.`)),
  q(t(`As a friend of ours said, "there needs to be a Soma Space in every town and city in the UK."`)),

  p(t(`<em><a href="${L.hub}">Gym Champions</a> profiles the people who run the gyms and fitness businesses we cover. Answers have been lightly edited for clarity.</em>`)),
].join("\n");

if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION + BODY)) throw new Error("dash");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
if (SEO_TITLE.length > 60) throw new Error(`seo title ${SEO_TITLE.length} > 60`);
const blocks = BODY.split("\n<blockquote");
let bare = 0;
for (let i = 1; i < blocks.length; i++) if (/<\/(h2|blockquote)>\s*$/.test(blocks[i - 1])) bare++;
if (bare) throw new Error(`${bare} bubble(s) with no text of ours before them`);
const words = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
console.log(`seo title ${SEO_TITLE.length} | meta ${META.length} | ~${words} words | bubbles ${blocks.length - 1}`);

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const wp = (args) => ssh(`cd '${docroot}' && wp ${args}`);

const POST_ARG = (process.argv.find((a) => a.startsWith("--post=")) || "").slice(7);
const KEEP = process.argv.includes("--keep-hero");
const existing = wp(`post list --post_type=post --post_status=any --s=Soma --fields=ID --format=csv`).split("\n").slice(1).filter(Boolean);
if (existing.length && !POST_ARG) throw new Error(`a Soma post exists already: ${existing.join(",")} (pass --post=<id>)`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`soma-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
let postId;
if (POST_ARG) {
  postId = Number(POST_ARG);
  if (wp(`post get ${postId} --field=post_status`) !== "draft") throw new Error(`post ${postId} is not a draft`);
  wp(`post update ${postId} /tmp/soma-body-${stamp}.html --post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)}`);
} else {
  postId = Number(wp(
    `post create /tmp/soma-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${b64(TITLE)} --post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --porcelain`
  ));
}
if (!KEEP) {
  put(`soma-hero-${stamp}.jpg`, fs.readFileSync(HERO));
  const heroId = wp(`media import /tmp/soma-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${b64("Jo Hazell-Watkins and Kevin Braddock, The Soma Space")} --alt=${b64(HERO_ALT)} --caption=${b64(HERO_CAPTION)} --porcelain`);
  await forSite(site.id).interviewTarget.update({ where: { id: TARGET_ID }, data: { status: "drafted", headshotUrl: wp(`post get ${heroId} --field=guid`) } });
  console.log(`hero media ${heroId}`);
}
wp(`post meta update ${postId} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${b64(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
ssh(`rm -f /tmp/soma-body-${stamp}.html /tmp/soma-hero-${stamp}.jpg`);
await prisma.$disconnect();

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name --format=json`));
console.log(`preview: ${GYM}/?p=${postId}&preview=true`);
console.log(`edit:    ${GYM}/wp-admin/post.php?post=${postId}&action=edit`);
