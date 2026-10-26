/**
 * In the Chair: James Talbot, HARE (Woodstock, Eynsham and Witney, Oxfordshire).
 * Rebuilds the sweep's DRAFT, post 1229, in the house shape. JB, 26 Oct 2026.
 *
 * Source: Talbot's reply of 25 Oct 2026 16:40 UK, all seven answers, signed.
 * He asked for a proof before publication and for a link to harestudio.co.uk,
 * and said he would send a high-resolution photo separately.
 *
 * The sweep drafted 1229 in the Q&A layout. This keeps the post and the Article
 * row the sweep linked, and replaces the title, slug, excerpt, body, category
 * and featured image.
 *
 * House shape (JB, 8-9 Oct): h2 prose sections, every quote a plain
 * .interview-quote so the theme draws a bubble, a line of our text before every
 * bubble, positive framing. Quotes are his, trimmed not reworded. The one em
 * dash in his copy becomes a comma, per the house rule.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_build-hare-talbot-interview.mjs --hero=<jpg> --inline=<jpg>
 */
import fs from "node:fs";
import { barberSsh, prisma } from "./_barber-ssh.mjs";

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3);
const HERO = arg("hero");
const INLINE = arg("inline");
if (!HERO || !fs.existsSync(HERO)) throw new Error("--hero=<jpg>");
if (!INLINE || !fs.existsSync(INLINE)) throw new Error("--inline=<jpg>");

const POST_ID = 1229;
const TARGET_ID = "cmvf0vcxa000j13xpp7qws6p0";
const CATEGORY_ID = 3; // Business & Money. The sweep invented "Case Studies", which holds only this draft.
const SITE = "https://barberingbusiness.com";
const L = { site: "https://www.harestudio.co.uk/", hub: `${SITE}/in-the-chair/`, gsc: "https://greensaloncollective.co.uk/" };

const TITLE_TEXT = "James Talbot on making the wash optional";
const TITLE = `🪑 <span class="franchise-eyebrow">In the Chair:</span> ${TITLE_TEXT}`;
const SEO_TITLE = `In the Chair: ${TITLE_TEXT}`;
const SLUG = "in-the-chair-james-talbot-on-making-the-wash-optional";
const KEYPHRASE = "barbershop pricing structure";
const EXCERPT =
  "James and George Talbot have run HARE since 2013, and now have shops in three Oxfordshire towns. James explains why clients pay for only the parts of the service they want, what the hardest opening taught them, and why the hair on the floor is becoming a business of its own.";
const META =
  "HARE co-founder James Talbot on three Oxfordshire barbershops, letting clients skip the wash, and turning swept-up hair into fertiliser.";

const HERO_ALT = "James and George Talbot, co-founders of HARE, in one of their Oxfordshire shops";
const HERO_CAPTION = "James Talbot, left, with his brother George. Picture: supplied";
// Settled 26 Oct: Talbot sent the originals himself, named
// James_Talbot_HARE_portrait.png and James_and_George_HARE.jpeg, so the portrait
// is James and he is the one wearing glasses on the left of the pair shot.
const INLINE_ALT = "James Talbot, co-founder of HARE, in one of the Oxfordshire shops";

const q = (...paras) =>
  `<blockquote class="wp-block-quote interview-quote">\n${paras.map((x) => `<p>${x}</p>`).join("\n")}\n</blockquote>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;
const p = (s) => `<p>${s}</p>`;
const t = (s) => s.replace(/'/g, "&#8217;").replace(/’/g, "&#8217;");
const figure = (url, alt, caption) =>
  `<!-- wp:image {"width":"480px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n` +
  `<figure class="wp-block-image aligncenter size-full is-resized"><img src="${url}" alt="${alt}" style="width:480px"/>` +
  `<figcaption class="wp-element-caption">${caption}</figcaption></figure>\n<!-- /wp:image -->`;

const body = (inlineUrl) =>
  [
    `<section class="interview-company">
<div class="interview-company-head">
<h2>Who are HARE?</h2>
</div>
<p>${t(`HARE is an independent barbering and hairdressing business in Oxfordshire, founded by brothers James and George Talbot in 2013. It runs walk-in shops for men and women in Woodstock, Eynsham and Witney, and is developing KeraCycle, its own hair recycling and fertiliser project.`)}</p>
<dl>
<div>
<dt>Company</dt>
<dd>HARE</dd>
</div>
<div>
<dt>Website</dt>
<dd><a href="${L.site}">harestudio.co.uk</a></dd>
</div>
<div>
<dt>Sector</dt>
<dd>Barbering and hairdressing</dd>
</div>
<div>
<dt>Based</dt>
<dd>Woodstock, Eynsham and Witney, Oxfordshire</dd>
</div>
<div>
<dt>Founded</dt>
<dd>2013</dd>
</div>
</dl>
</section>`,

    p(t(`James and George Talbot opened the first <a href="${L.site}">HARE</a> in Woodstock in 2013, before the barbering boom arrived. Three Oxfordshire towns later they run walk-in hairdressing and barbering for men and women, let clients pay for only the parts of the service they want, and are building a second business out of the hair they sweep off the floor. James took our seven questions.`)),

    h2(`Two brothers, two jobs`),
    p(t(`Plenty of family businesses come unstuck on who decides what. At HARE the split was settled by working out what each brother is actually good at.`)),
    q(t(`George and I have quite different strengths, which is why we work so well together. He&#8217;s brilliant with the financial side and managing our teams, and I tend to lean towards the creative side, developing ideas, coaching and teaching.`)),
    p(t(`The useful part, he says, is not dividing the work evenly. It is being honest about where each of you is strongest.`)),
    q(t(`There&#8217;s plenty of overlap, of course, but one of the most important things is understanding your strengths as individuals and entrepreneurs. We don&#8217;t need to be good at exactly the same things. What matters is that we&#8217;re working towards the same goals.`)),

    h2(`Three towns, three different problems`),
    p(t(`Woodstock came first, in a market with almost no competition and a very different mood to the one barbering trades in now.`)),
    q(t(`We were young, enthusiastic, and it was all a bit rock and roll, boozy barbering before the barbering boom. There was very little competition, and we were doing something completely different.`)),
    p(t(`Eynsham took longer to build, and earned its place by proving the format that HARE now runs everywhere.`)),
    q(t(`Eynsham was a slow burner, but it&#8217;s where we first tested our walk-in hairdressing and barbering concept for men and women.`)),
    p(t(`Witney put that format on a high street, and has been the hardest of the three. Talbot is straight about why, and about where it is heading.`)),
    q(t(`Witney was an opportunity to bring that concept onto the high street. It&#8217;s definitely been the hardest. Competition and the council&#8217;s ongoing roadworks have affected footfall and kept turnover down. But it&#8217;s getting there.`)),

    figure(inlineUrl, INLINE_ALT, "James Talbot. Picture: supplied"),

    h2(`Paying for only what you want`),
    p(t(`HARE prices the wash and blow dry as optional extras rather than baking them into every cut. Getting there took work, on the menu and on the team.`)),
    q(t(`Creating our pricing structure was tricky at first. It was different, customers weren&#8217;t used to it, and getting the logistics right took some work. But it&#8217;s worked really well. Clear menus and making sure the team understands the concept have made a huge difference.`)),
    p(t(`The payoff is a client who is choosing rather than being charged, and a technical argument that happens to support it.`)),
    q(t(`Customers like choosing exactly what they want rather than paying for services they don&#8217;t need. Interestingly, we often find hair cuts better with a little natural oil in it, so a fresh wash isn&#8217;t always necessary. It&#8217;s become one of our strongest selling points and gives us a genuine point of difference.`)),

    h2(`The hair on the floor`),
    p(t(`HARE recycles client hair through the <a href="${L.gsc}">Green Salon Collective</a>, which started with a simple observation about the bin.`)),
    q(t(`We genuinely believe in recycling hair. We were seeing huge amounts going into commercial waste and thought there must be something better we could do with it.`)),
    p(t(`Two years of work later, that has turned into a venture of its own.`)),
    q(t(`That&#8217;s led us to develop KeraCycle, our own hair recycling and fertiliser project, which we&#8217;ve been working on for two years. Customers love knowing their hair is being put to good use. It&#8217;s become one of our unique selling points and is now part of the foundation of HARE.`)),

    h2(`What Mexico changed`),
    p(t(`Talbot set up a makeshift barbershop at an orphanage in Mexico, teaching martial arts and teaching a local lad to cut hair. He came back thinking differently about what the trade is for.`)),
    q(t(`It really brought home how much hairdressing can influence people&#8217;s lives. It&#8217;s not just about cutting hair. It&#8217;s about building confidence, making people feel good about themselves, and giving young people skills they can use for life.`)),
    p(t(`The practical result shows up in HARE&#8217;s hiring.`)),
    q(t(`We&#8217;ve always supported charities back home, but Mexico reinforced how important that work is. I came back with renewed energy to invest in young people, take on more trainees, and create opportunities through HARE.`)),

    h2(`The part nobody warns you about`),
    p(t(`Ask any multi-site owner what the job is really like and the glamour goes quickly. Talbot starts with the broom.`)),
    q(t(`You&#8217;re also the head cleaner. Hair gets absolutely everywhere, even in your shoes and socks. Then there are staff issues, client complaints, and parking wardens as you dash between shops.`)),
    p(t(`And the hours do not stop at the door of any one shop.`)),
    q(t(`The hours are relentless. It&#8217;s seven days a week, twenty-four hours a day in your head. Running three shops isn&#8217;t just a job, it&#8217;s a lifestyle.`)),

    h2(`A training school, and a level playing field`),
    p(t(`Talbot wants a fourth shop, a bigger product range and KeraCycle properly off the ground. The ambition he leads with, though, is a training school, and he ties it to the conditions legitimate shops are trading in.`)),
    q(t(`In five years I&#8217;d love HARE to have its own training school, but for businesses like ours to grow, we need the government to sort out VAT, tighten regulation and cut out bogus barbering and hairdressing on the high street.`)),
    p(t(`That, for him, is what the next generation of the trade depends on.`)),
    q(t(`Legitimate businesses need a fair environment to evolve, employ more people and invest in the next generation.`)),

    p(t(`<em><a href="${L.hub}">In the Chair</a> profiles the people who run the shops we cover. Answers have been lightly edited for clarity.</em>`)),
  ].join("\n");

/* ------------------------------------------------------------------ gates */

const BODY_CHECK = body("PLACEHOLDER");
if (/[—–]/.test(TITLE + EXCERPT + META + HERO_CAPTION + BODY_CHECK)) throw new Error("dash");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
if (SEO_TITLE.length > 60) throw new Error(`seo title ${SEO_TITLE.length} > 60`);
const blocks = BODY_CHECK.split("\n<blockquote");
let bare = 0;
for (let i = 1; i < blocks.length; i++) if (/<\/(h2|blockquote)>\s*$/.test(blocks[i - 1])) bare++;
if (bare) throw new Error(`${bare} bubble(s) with no text of ours before them`);
const words = BODY_CHECK.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
console.log(`seo title ${SEO_TITLE.length} | meta ${META.length} | ~${words} words | bubbles ${blocks.length - 1}`);

if (process.argv.includes("--check")) {
  console.log("-- gates only, nothing written --");
  await prisma.$disconnect();
  process.exit(0);
}

/* ------------------------------------------------------------------- wp */

const { ssh, put } = await barberSsh();
if (ssh(`wp post get ${POST_ID} --field=post_status`) !== "draft") throw new Error(`post ${POST_ID} is not a draft`);

const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const stamp = Date.now();

put(fs.readFileSync(INLINE), `/tmp/hare-inline-${stamp}.jpg`);
const inlineId = ssh(
  `wp media import /tmp/hare-inline-${stamp}.jpg --post_id=${POST_ID} --title=${b64("James Talbot, HARE")} --alt=${b64(INLINE_ALT)} --porcelain`
);
const inlineUrl = ssh(`wp post get ${inlineId} --field=guid`);

const BODY = body(inlineUrl);
put(Buffer.from(BODY, "utf8"), `/tmp/hare-body-${stamp}.html`);
ssh(
  `wp post update ${POST_ID} /tmp/hare-body-${stamp}.html --post_title=${b64(TITLE)} ` +
  `--post_excerpt=${b64(EXCERPT)} --post_name=${SLUG} --post_category=${CATEGORY_ID}`
);

const oldThumb = ssh(`wp post meta get ${POST_ID} _thumbnail_id || true`);
put(fs.readFileSync(HERO), `/tmp/hare-hero-${stamp}.jpg`);
const heroId = ssh(
  `wp media import /tmp/hare-hero-${stamp}.jpg --post_id=${POST_ID} --featured_image ` +
  `--title=${b64("James and George Talbot, HARE")} --alt=${b64(HERO_ALT)} --caption=${b64(HERO_CAPTION)} --porcelain`
);

ssh(`wp post meta update ${POST_ID} _yoast_wpseo_title ${b64(SEO_TITLE)}`);
ssh(`wp post meta update ${POST_ID} _yoast_wpseo_metadesc ${b64(META)}`);
ssh(`wp post meta update ${POST_ID} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
// Yoast serves a cached row and would keep the sweep's title and the old og:image.
ssh(`wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}"`);
ssh(`rm -f /tmp/hare-body-${stamp}.html /tmp/hare-hero-${stamp}.jpg /tmp/hare-inline-${stamp}.jpg`);
ssh(`wp cache flush`);

await prisma.article.update({
  where: { id: "cmvo335ip0001ccyfa9w48zar" },
  data: { title: SEO_TITLE, body: BODY, keyphrase: KEYPHRASE, metaDesc: META, category: "Business & Money" },
});
await prisma.interviewTarget.update({
  where: { id: TARGET_ID },
  data: { headshotUrl: ssh(`wp post get ${heroId} --field=guid`) },
});
await prisma.$disconnect();

console.log(`hero ${heroId}, inline ${inlineId}${oldThumb ? `, old thumb ${oldThumb} left in library` : ""}`);
console.log(ssh(`wp post get ${POST_ID} --fields=ID,post_status,post_name --format=json`));
console.log(`\npreview: ${SITE}/?p=${POST_ID}&preview=true`);
console.log(`edit:    ${SITE}/wp-admin/post.php?post=${POST_ID}&action=edit`);
