/**
 * One-off, 1 Oct 2026: add the Kingsbury history to Ela Konyardi's profile
 * (post 229) and correct the two lines that implied she opened it.
 *
 * When the piece published, her answers said "our first acquisition" without
 * saying which, so the article deliberately claimed nothing about how
 * Kingsbury started and the reply to her asked the question. She answered on
 * 30 Sep 19:26 UK, in the same thread: Kingsbury was ACQUIRED, the process ran
 * from autumn 2022 to spring 2023, and it was a small part-time preschool
 * provision at the time.
 *
 * So this is a clarification rather than a correction of a false claim, but
 * two lines did say she "started" the business and they are now precise
 * instead. The new quotes are verbatim from her email and checked against it
 * before anything is written.
 *
 * Every replacement is anchored and throws if its anchor is missing, so a
 * later edit to the post can never let this silently drop a change.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_update-ela-kingsbury.mjs [--apply]
 */
import fs from "node:fs";
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 229;
const SRC =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/ela/kingsbury.txt";

const Q = (x) => `<blockquote class="wp-block-quote interview-quote"><p>${x}</p></blockquote>`;

// Verbatim from her 30 Sep reply.
const QUOTE =
  `At the time of acquisition, it was a small, part-time preschool/nursery provision. ` +
  `We have since built upon the existing provision and significantly developed the service, ` +
  `extending it to a full-time nursery offering for children from babies through to four years old.` +
  `<br><br>` +
  `The building also underwent a refurbishment and development programme to create a more ` +
  `purpose-designed environment, while retaining the foundations of the existing provision.`;

const EDITS = [
  // Standfirst: she bought Kingsbury, she did not start it.
  {
    what: "standfirst",
    from: "before starting her own in Kingsbury in 2022, and won",
    to: "before buying a small part-time setting in Kingsbury and building it into a two-site group, and won",
  },
  // Company card.
  {
    what: "company card",
    from: "Ela Konyardi started the business in 2022 and runs it with her husband Sebastian.",
    to:
      "Ela Konyardi acquired the Kingsbury setting in a process that ran from autumn 2022 to spring 2023, " +
      "and runs the group with her husband Sebastian.",
  },
  // Opening line: the clock starts at completion, not at the first enquiry.
  {
    what: "intro clock",
    from: "Four years after starting on her own, Ela Konyardi runs two settings",
    to: "Three years after completing her first acquisition, Ela Konyardi runs two settings",
  },
  // Abbots Langley is not the only one she bought.
  {
    what: "abbots langley lead-in",
    from: "The second setting in Abbots Langley is not a build.",
    to: "The second setting in Abbots Langley is not a build either.",
  },
  // The new passage, hung off the tail of the freehold paragraph.
  {
    what: "kingsbury passage",
    from: "sets out in multiples and per-place terms.</p>",
    to:
      "sets out in multiples and per-place terms.</p>\n\n" +
      "<p>That first acquisition was Kingsbury itself. Konyardi bought it rather than opening it, in a " +
      "process that began in autumn 2022 and completed in spring 2023, and what she bought was modest.</p>\n\n" +
      Q(QUOTE) +
      "\n\n" +
      "<p>Which puts the three-month break-even in its proper context. Kingsbury was a trading part-time " +
      "provision when she took it on, so the occupancy she had to build sat on top of something rather than " +
      "starting at zero, and the service that exists now was built after the purchase, not bought with it. " +
      "It also makes Enchanted Lands two acquisitions rather than a build and a buy, which is a different " +
      "kind of operator to learn from, and it stops Sebastian's construction background being a footnote: " +
      "both settings have had building work.</p>",
  },
];

const { ssh, put } = await nurserySsh();
const before = ssh(`wp post get ${POST_ID} --field=post_content`);
console.log(`post ${POST_ID} is ${ssh(`wp post get ${POST_ID} --field=post_status`)}, ${before.length} bytes`);

// The new quote must match her email exactly.
const norm = (x) =>
  x.replace(/<br>\s*<br>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const source = norm(fs.readFileSync(SRC, "utf8"));
if (!source.includes(norm(QUOTE))) throw new Error("QUOTE NOT VERBATIM against her email");
console.log("quote verified verbatim against her 30 Sep reply");

let out = before;
for (const e of EDITS) {
  if (!out.includes(e.from)) throw new Error(`anchor missing for "${e.what}": ${e.from.slice(0, 70)}`);
  out = out.replace(e.from, e.to);
  console.log(`  applied: ${e.what}`);
}

// House rule, our copy only: her quotes keep her own punctuation.
const ours = out.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[\u2014\u2013]/.test(ours)) throw new Error("dash in our copy");

console.log(`\n${before.length} -> ${out.length} bytes`);
if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const stamp = Date.now();
const tmp = `/tmp/ela-upd-${stamp}.html`;
// put() pipes the bytes; ssh() does NOT take stdin. Getting this wrong once
// wrote an empty file and blanked the live post, so the size is checked on the
// server before anything is allowed to overwrite the article.
put(Buffer.from(out, "utf8"), tmp);
const uploaded = Number(ssh(`wc -c < ${tmp}`).trim());
if (uploaded !== Buffer.byteLength(out)) throw new Error(`upload is ${uploaded} bytes, expected ${Buffer.byteLength(out)}`);
ssh(`wp post update ${POST_ID} ${tmp} && rm -f ${tmp}`);
console.log("updated. purging...");
console.log(ssh(`wp cache flush; wp sg purge; wp sg purge "$(wp post url ${POST_ID})" 2>/dev/null || true`));
console.log("url:", ssh(`wp post url ${POST_ID}`));

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
await forSite(site.id).article.update({ where: { id: "cmuntr81b00011mngmmgsvag7" }, data: { body: out } });
console.log("Article row body synced");
await prisma.$disconnect();
