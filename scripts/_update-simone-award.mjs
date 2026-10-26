/**
 * 14 Oct 2026: Simone Nel's two additions to her live profile (post 350), plus
 * the better pictures she sent.
 *
 * She asked for: a short paragraph on the national recognition, and a sentence
 * about Susie Norman appended to her closing answer. Both texts are her own,
 * from her 13 Oct 16:23 email, and both are checked verbatim before anything
 * is written.
 *
 * The award is the thing the article was missing. Our outreach said she had won
 * "Nursery Operations Area Manager of the Year"; the Nursery World Awards site
 * lists that category but names no winners, and the trophy in her photo is not
 * legible at that resolution. Her own wording is "Nursery World's Nursery
 * Operations Manager of the Year 2026". So her quote carries her wording and
 * OUR prose says only that she won her category, which is true either way. The
 * reply asks her to confirm the exact category.
 *
 * PICTURES. She sent seven. One (995A3362...png) shows her with a child at a
 * Montessori tray, and a second child behind, so it is NOT used: this title
 * publishes no photographs of children. Used here:
 *   - new headshot 3A4195BA (1254x1254) replaces the 800x800 as the hero,
 *     same widened 4:3 treatment so it survives the 16/9 and 5/4 crops
 *   - IMG_6201, her with the trophy, inline in the new award section
 *   - IMG_2078, her running a training session, inline where she talks about
 *     growing her own people
 * Unused and fine: IMG_2091, IMG_2103, IMG_2162.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_update-simone-award.mjs [--apply]
 */
import fs from "node:fs";
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 350;
const D =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/simone2";
const SOURCE = `${D}/additions.txt`;

const HERO = `${D}/simone-hero-v2.jpg`;
const AWARD_IMG = `${D}/award-inline.jpg`;
const TRAINING_IMG = `${D}/training-inline.jpg`;

const EXCERPT =
  "Simone Nel oversees six Colourbox Montessori nurseries and two Forest School provisions across Suffolk, and won her category at the Nursery World Awards 2026. She explains what breaks first when one nursery becomes a group, why the group never uses agency staff, and what the unglamorous half of an operations job actually involves.";
const META =
  "Nursery World Awards 2026 winner Simone Nel on running six Suffolk nurseries, what breaks first when you add sites, and why she never uses agency staff.";

const AWARD_Q1 =
  "Winning Nursery World&#8217;s Nursery Operations Manager of the Year 2026 has been a deeply proud moment for me, and being featured in platforms and articles has given me the opportunity to share more of the work behind that recognition.";
const AWARD_Q2 =
  "So much of operational leadership happens quietly: supporting people through difficult moments, making challenging decisions and keeping our ambitions connected to what children need every day. This award means so much because it recognises that work, alongside the dedication of the Colourbox teams I am privileged to lead. I&#8217;m incredibly grateful, and excited about what comes next.";
const SUSIE =
  "That ambition builds on the extraordinary foundation laid by Susie Norman, Director and Founder of Colourbox, whose 35 years of dedication to excellence in early years have shaped the organisation we are today. I am deeply grateful for her trust in me as her Operations Manager and proud to help carry her vision forward.";

const img = (url, alt, caption, width) =>
  `<!-- wp:image {"width":"${width}px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n` +
  `<figure class="wp-block-image aligncenter size-full is-resized">` +
  `<img src="${url}" alt="${alt}" style="width:${width}px"/>` +
  `<figcaption class="wp-element-caption">${caption}</figcaption></figure>\n` +
  `<!-- /wp:image -->`;

// ---- verbatim check against her own email, before touching anything ----
const norm = (x) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const src = norm(fs.readFileSync(SOURCE, "utf8"));
for (const [label, text] of [["award p1", AWARD_Q1], ["award p2", AWARD_Q2], ["susie", SUSIE]]) {
  if (!src.includes(norm(text))) throw new Error(`NOT VERBATIM (${label}): ${norm(text).slice(0, 80)}`);
}
console.log("all three additions verified verbatim against her 13 Oct email");
for (const f of [HERO, AWARD_IMG, TRAINING_IMG]) if (!fs.existsSync(f)) throw new Error(`missing ${f}`);

const { ssh, put } = await nurserySsh();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const before = ssh(`wp post get ${POST_ID} --field=post_content`);
console.log(`post ${POST_ID} is ${ssh(`wp post get ${POST_ID} --field=post_status`)}, ${before.length} bytes`);

const stamp = Date.now();
function upload(file, title, alt, caption, featured = false) {
  if (!APPLY) return { id: 0, url: `PLACEHOLDER_${title}` };
  const remote = `/tmp/sim-${stamp}-${file.split("/").pop()}`;
  const buf = fs.readFileSync(file);
  put(buf, remote);
  if (Number(ssh(`wc -c < ${remote}`).trim()) !== buf.length) throw new Error(`upload mismatch for ${file}`);
  const id = Number(
    ssh(
      `wp media import ${remote} --post_id=${POST_ID} ${featured ? "--featured_image " : ""}` +
        `--title=${sq(title)} --alt=${sq(alt)} --caption=${sq(caption)} --porcelain`
    )
  );
  ssh(`rm -f ${remote}`);
  return { id, url: ssh(`wp post get ${id} --field=guid`) };
}

const oldThumb = ssh(`wp post meta get ${POST_ID} _thumbnail_id`).trim();
const hero = upload(HERO, "Simone Nel, Colourbox Montessori", "Simone Nel, operations manager at Colourbox Montessori", "Simone Nel. Picture: supplied", true);
const award = upload(AWARD_IMG, "Simone Nel at the Nursery World Awards 2026", "Simone Nel holding her trophy at the Nursery World Awards 2026", "Simone Nel collecting her award at the Nursery World Awards 2026. Picture: supplied");
const training = upload(TRAINING_IMG, "Simone Nel running a Colourbox training session", "Simone Nel leading a training session with Colourbox staff", "Nel running a training session for Colourbox teams. Picture: supplied");

const EDITS = [
  {
    what: "intro, add the award",
    from: `across Suffolk. She began her own career as a practitioner. She answered our seven questions by email.`,
    to: `across Suffolk. She won her category at the Nursery World Awards 2026. She began her own career as a practitioner, and answered our seven questions by email.`,
  },
  {
    what: "training photo",
    from: `which is the ground the sector tends to find more persuasive than the invoice.</p>`,
    to:
      `which is the ground the sector tends to find more persuasive than the invoice.</p>\n\n` +
      img(training.url, "Simone Nel leading a training session with Colourbox staff", "Nel running a training session for Colourbox teams. Picture: supplied", 720),
  },
  {
    what: "award section",
    from: `<h2 class="wp-block-heading">Kennett, and what growth has to mean</h2>`,
    to:
      `<h2 class="wp-block-heading">The award, and the quiet work behind it</h2>\n\n` +
      `<p>Nel won her category at the Nursery World Awards 2026. She did not raise it in any of her seven answers, so we asked her about it afterwards.</p>\n\n` +
      `<blockquote class="wp-block-quote interview-quote">\n<p>${AWARD_Q1}</p>\n<p>${AWARD_Q2}</p>\n</blockquote>\n\n` +
      img(award.url, "Simone Nel holding her trophy at the Nursery World Awards 2026", "Collecting the award. Picture: supplied", 480) +
      `\n\n<p>Which is the same point she made about the unglamorous half of the job, arriving from the other direction. Operations is the layer that decides whether a group of settings holds together, and it is rarely the layer anyone photographs.</p>\n\n` +
      `<h2 class="wp-block-heading">Kennett, and what growth has to mean</h2>`,
  },
  {
    what: "Susie Norman addition",
    from: `<p>I want our people to see a future within Colourbox and our generations of families to continue to experience the care, consistency and confidence that comes from a well-led nursery.</p>`,
    to:
      `<p>I want our people to see a future within Colourbox and our generations of families to continue to experience the care, consistency and confidence that comes from a well-led nursery.</p>\n` +
      `<p>${SUSIE}</p>`,
  },
];

let out = before;
for (const e of EDITS) {
  if (!out.includes(e.from)) throw new Error(`anchor missing for "${e.what}"`);
  out = out.replace(e.from, e.to);
  console.log(`  applied: ${e.what}`);
}

const ours = out.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[\u2014\u2013]/.test(ours + META + EXCERPT)) throw new Error("dash in our copy");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`\n${before.length} -> ${out.length} bytes | meta ${META.length}`);

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const tmp = `/tmp/simone-upd-${stamp}.html`;
put(Buffer.from(out, "utf8"), tmp);
if (Number(ssh(`wc -c < ${tmp}`).trim()) !== Buffer.byteLength(out)) throw new Error("body upload mismatch");
ssh(`wp post update ${POST_ID} ${tmp} --post_excerpt=${sq(EXCERPT)} && rm -f ${tmp}`);
ssh(`wp post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
// Yoast caches og:image on the indexable row, so clear it after a hero swap
ssh(`wp db query "DELETE FROM wp_yoast_indexable WHERE object_id=${POST_ID} AND object_type='post'" 2>/dev/null || true`);
if (oldThumb && oldThumb !== String(hero.id)) ssh(`wp post delete ${oldThumb} --force 2>/dev/null || true`);

const stored = ssh(`wp post get ${POST_ID} --field=post_content`);
console.log(`stored ${stored.length} bytes | bubbles ${(stored.match(/<blockquote/g) || []).length} | images ${(stored.match(/wp:image/g) || []).length / 2}`);
console.log(`thumb ${ssh(`wp post meta get ${POST_ID} _thumbnail_id`)} (was ${oldThumb})`);
console.log(ssh(`wp cache flush; wp sg purge; wp sg purge "$(wp post url ${POST_ID})" 2>/dev/null || true`));
console.log(`url: ${ssh(`wp post url ${POST_ID}`)}`);

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
await forSite(site.id).article.updateMany({ where: { wpPostId: POST_ID }, data: { body: out, metaDesc: META } });
await prisma.$disconnect();
