/**
 * 14 Oct 2026: name Simone Nel's award category precisely on post 350.
 *
 * Three sources disagreed and JB settled it: the category is "Nursery
 * Operations / Area Manager of the Year". That reconciles the other two,
 * because Simone's own paragraph drops the "/ Area" and the Nursery World
 * Awards site's category index drops the "of the Year". Her quote is untouched
 * and keeps her own wording; only OUR prose, the excerpt and the meta change.
 *
 * Simone was also asked to confirm the category in the 14 Oct reply, so if her
 * answer differs this is a one line change back.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_update-simone-category.mjs [--apply]
 */
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 350;
const AWARD = "Nursery Operations / Area Manager of the Year";

const EXCERPT =
  `Simone Nel oversees six Colourbox Montessori nurseries and two Forest School provisions across Suffolk, and was named ${AWARD} at the Nursery World Awards 2026. She explains what breaks first when one nursery becomes a group, why the group never uses agency staff, and what the unglamorous half of an operations job actually involves.`;
const META =
  "Simone Nel, Nursery Operations / Area Manager of the Year 2026, on six Suffolk nurseries, what breaks when you add sites, and never using agency staff.";

const EDITS = [
  {
    what: "intro line",
    from: `She won her category at the Nursery World Awards 2026.`,
    to: `She was named ${AWARD} at the Nursery World Awards 2026.`,
  },
  {
    what: "award section lead-in",
    from: `<p>Nel won her category at the Nursery World Awards 2026. She did not raise it in any of her seven answers, so we asked her about it afterwards.</p>`,
    to: `<p>Nel was named ${AWARD} at the Nursery World Awards 2026. She did not raise it in any of her seven answers, so we asked her about it afterwards.</p>`,
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

// Her quote must be exactly as it was: this edit may not touch any blockquote.
const quotesBefore = (before.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []).join("|");
const quotesAfter = (out.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []).join("|");
if (quotesBefore !== quotesAfter) throw new Error("this edit changed a quote; refusing");
console.log("quotes untouched, confirmed");

const ours = out.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[—–]/.test(ours + META + EXCERPT)) throw new Error("dash in our copy");
if (META.length > 155) throw new Error(`meta ${META.length} > 155`);
console.log(`${before.length} -> ${out.length} bytes | meta ${META.length}`);

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const tmp = `/tmp/simone-cat-${Date.now()}.html`;
put(Buffer.from(out, "utf8"), tmp);
if (Number(ssh(`wc -c < ${tmp}`).trim()) !== Buffer.byteLength(out)) throw new Error("upload mismatch");
ssh(`wp post update ${POST_ID} ${tmp} --post_excerpt=${sq(EXCERPT)} && rm -f ${tmp}`);
ssh(`wp post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(META)}`);
ssh(`wp db query "DELETE FROM wp_yoast_indexable WHERE object_id=${POST_ID} AND object_type='post'" 2>/dev/null || true`);
console.log(ssh(`wp cache flush; wp sg purge; wp sg purge "$(wp post url ${POST_ID})" 2>/dev/null || true`));
console.log(`stored ${ssh(`wp post get ${POST_ID} --field=post_content`).length} bytes`);
console.log(`url: ${ssh(`wp post url ${POST_ID}`)}`);

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
await forSite(site.id).article.updateMany({ where: { wpPostId: POST_ID }, data: { body: out, metaDesc: META } });
await prisma.$disconnect();
