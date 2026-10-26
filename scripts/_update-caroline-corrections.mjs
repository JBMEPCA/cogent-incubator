/**
 * 26 Oct 2026: Caroline Akker's corrections to her live profile (post 455),
 * from her 10:39 UK reply.
 *
 * 1. RATIO CORRECTION. Her answer said "a 1:3 ratio across the board as much
 *    as we could" and the piece led on it. She has since clarified that the
 *    preschool room runs at 1:5. Her quote stays exactly as she wrote it; our
 *    own framing around it was overstated and is corrected, and the correction
 *    is stated on the page rather than quietly swapped. The story survives: 1:5
 *    in preschool is still well inside the statutory 1:8.
 * 2. AWARD CONFIRMED. "I was named Manager of the Year at the NDNA Awards
 *    2026, please include this where you feel it is appropriate." Also
 *    finalists for Nursery of the Year (Central), and apprentice Holly a
 *    finalist for Apprentice of the Year. Added.
 * 3. SECOND SITE STAYS OUT. "We are in the process of looking for second
 *    nursery, but nothing is final yet. We are also moving from sole trader to
 *    limited company... When it does, you are welcome to do an article on it."
 *    So the Companies House entries stay unpublished, as they were. Her account
 *    and the register do not quite line up on timing, which is another reason
 *    not to print it.
 *
 * PHOTO: the replacement she sent is 240x240, SMALLER than the 640x640 already
 * in use, because her mail client resized it. Hero unchanged.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_update-caroline-corrections.mjs [--apply]
 */
import fs from "node:fs";
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 455;
const ND = "https://nurserydaily.com";
const SOURCE =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/nw2/correction.txt";

const EXCERPT =
  "Caroline Akker was a childminder until demand outgrew her house. She explains how a conversation with a working farm turned into a converted barn, why she staffs above the statutory minimum and charges for it, and what teaching did not prepare her for.";
const META =
  "Caroline Akker went from childminder to a barn nursery at Glebe Farm. The NDNA Manager of the Year 2026 on ratios, the farm deal and the paperwork.";

// Facts taken only from her email.
const src = fs.readFileSync(SOURCE, "utf8").replace(/\s+/g, " ");
for (const must of [
  "1:5 ratio in the preschool",
  "named Manager of the Year at the NDNA Awards 2026",
  "finalists in the Nursery of the Year (Central)",
  "Holly our apprentice was a finalist for Apprentice of the Year",
]) {
  if (!src.includes(must)) throw new Error(`her email does not contain: ${must}`);
}
console.log("every added fact traced to her 26 Oct email");

const EDITS = [
  {
    what: "intro, add the award",
    from: `whether it had a spare room. She answered our seven questions in writing.`,
    to: `whether it had a spare room. She was named Manager of the Year at the 2026 NDNA Awards. She answered our seven questions in writing.`,
  },
  {
    what: "section heading, no longer 1:3 across the board",
    from: `<h2 class="wp-block-heading">A 1:3 ratio, and fees that pay for it</h2>`,
    to: `<h2 class="wp-block-heading">Richer ratios, and fees that pay for them</h2>`,
  },
  {
    what: "ratio context, corrected",
    from: `<p>That last paragraph is worth reading twice. The statutory minimum in England is one adult to three children under two, one to five for two-year-olds, and one to eight or one to thirteen for three and four-year-olds depending on qualification. Staffing at one to three across the board means carrying materially more adults than the law requires for the older rooms, and paying for it out of fees rather than absorbing it. Most settings move in the opposite direction when margins tighten, which is the pressure our piece on <a href="${ND}/lester-aldridge-inflation-above-4-hits-nursery-margins/">inflation above 4% and nursery margins</a> describes.</p>`,
    to:
      `<p>That last paragraph is worth reading twice. The statutory minimum in England is one adult to three children under two, one to five for two-year-olds, and one to eight for three and four-year-olds, or one to thirteen where a qualified teacher is working directly with them.</p>\n\n` +
      `<p>After this piece first went up, Akker clarified that the preschool room runs at one to five rather than one to three. Preschool is where most settings take the saving, so one to five against a permitted one to eight is the part that costs real money, and she funds it from fees rather than absorbing it. That runs against the pressure described in our piece on <a href="${ND}/lester-aldridge-inflation-above-4-hits-nursery-margins/">inflation above 4% and nursery margins</a>.</p>`,
  },
  {
    what: "award section",
    from: `<h2 class="wp-block-heading">Paperwork and personalities</h2>`,
    to:
      `<h2 class="wp-block-heading">Manager of the Year, and a finalist apprentice</h2>\n\n` +
      `<p>Akker was named Manager of the Year at the 2026 NDNA Awards. Bee Curious was also a finalist for Nursery of the Year in the Central region, and Holly, an apprentice at the setting, was a finalist for Apprentice of the Year.</p>\n\n` +
      `<p>The last of those belongs with the answer above it. A nursery that opened in 2024 and decided early to become a training setting already has an apprentice on a national shortlist, which is a better argument for growing your own than any amount of saying it is a good idea.</p>\n\n` +
      `<h2 class="wp-block-heading">Paperwork and personalities</h2>`,
  },
];

const { ssh, put } = await nurserySsh();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const before = ssh(`wp post get ${POST_ID} --field=post_content`);
console.log(`post ${POST_ID} is ${ssh(`wp post get ${POST_ID} --field=post_status`)}, ${before.length} bytes`);

let out = before;
for (const e of EDITS) {
  if (!out.includes(e.from)) throw new Error(`anchor missing for "${e.what}"`);
  out = out.replace(e.from, e.to);
  console.log(`  applied: ${e.what}`);
}

// Her words must not move: this edit only touches our own framing.
const qBefore = (before.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []).join("|");
const qAfter = (out.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []).join("|");
if (qBefore !== qAfter) throw new Error("this edit changed a quote; refusing");
console.log("quotes untouched, confirmed");
if (!/1:3 ratio across the board as much as we could/.test(out)) throw new Error("her original wording lost");

const ours = out.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[\u2014\u2013]/.test(ours + META + EXCERPT)) throw new Error("dash in our copy");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`${before.length} -> ${out.length} bytes | meta ${META.length}`);

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const tmp = `/tmp/caroline-corr-${Date.now()}.html`;
put(Buffer.from(out, "utf8"), tmp);
if (Number(ssh(`wc -c < ${tmp}`).trim()) !== Buffer.byteLength(out)) throw new Error("upload mismatch");
ssh(`wp post update ${POST_ID} ${tmp} --post_excerpt=${sq(EXCERPT)} && rm -f ${tmp}`);
ssh(`wp post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
const pre = ssh(`wp config get table_prefix`).trim();
ssh(`wp db query "DELETE FROM ${pre}yoast_indexable WHERE object_id=${POST_ID} AND object_type='post'"`);
console.log(ssh(`wp cache flush; wp sg purge; wp sg purge "$(wp post url ${POST_ID})" 2>/dev/null || true`));
console.log(`stored ${ssh(`wp post get ${POST_ID} --field=post_content`).length} bytes`);
console.log(`url: ${ssh(`wp post url ${POST_ID}`)}`);

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
await forSite(site.id).article.updateMany({ where: { wpPostId: POST_ID }, data: { body: out, metaDesc: META } });
await prisma.$disconnect();
