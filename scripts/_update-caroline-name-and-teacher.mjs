/**
 * 26 Oct 2026, Caroline Akker's third and fourth notes on post 455.
 *
 * 1. NAME. "please can you call me Caroline instead of Akker in the article."
 *    The series otherwise uses surname on second reference (Nel, Konyardi), so
 *    this is a deliberate exception at the subject's request. The two full-name
 *    first references stay as they are; only the bare surnames change.
 *
 * 2. THE CEILING IS 1:13, NOT 1:8. "Also, preschool is run by a qualified
 *    teacher called Beth, so we could go higher, but I felt quality
 *    interactions would be compromised. Speech and Language is so important at
 *    this age." Under the EYFS, three and four-year-olds may be staffed at one
 *    to thirteen where a qualified teacher works directly with them, so our
 *    "permitted one to eight" understated her decision considerably. She is
 *    entitled to thirteen per adult and runs five.
 *
 * Her sentence is added as a quote. The only change to her words is
 * capitalising the P of "preschool" after dropping her leading "Also, ", so
 * the verbatim check here is case-insensitive on that one quote and exact on
 * everything else.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_update-caroline-name-and-teacher.mjs [--apply]
 */
import fs from "node:fs";
import { nurserySsh, prisma } from "./_nursery-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 455;
const ND = "https://nurserydaily.com";
const SOURCE =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/nw2/corrections2.txt";

const BETH_QUOTE =
  "Preschool is run by a qualified teacher called Beth, so we could go higher, but I felt quality interactions would be compromised. Speech and Language is so important at this age.";

const src = fs.readFileSync(SOURCE, "utf8").replace(/\s+/g, " ").toLowerCase();
if (!src.includes(BETH_QUOTE.replace(/\s+/g, " ").toLowerCase()))
  throw new Error("Beth quote is not verbatim against her email");
if (!src.includes("call me caroline instead of akker")) throw new Error("name request not found in her email");
console.log("both changes traced to her 26 Oct emails");

const EDITS = [
  {
    what: "ratio context: the ceiling is 1:13, and Beth",
    from: `<p>After this piece first went up, Akker clarified that the preschool room runs at one to five rather than one to three. Preschool is where most settings take the saving, so one to five against a permitted one to eight is the part that costs real money, and she funds it from fees rather than absorbing it. That runs against the pressure described in our piece on <a href="${ND}/lester-aldridge-inflation-above-4-hits-nursery-margins/">inflation above 4% and nursery margins</a>.</p>`,
    to:
      `<p>After this piece first went up, Caroline clarified that the preschool room runs at one to five rather than one to three, and that it is led by a qualified teacher. That second detail raises the ceiling rather than lowering it, because a qualified teacher working directly with three and four-year-olds permits one adult to thirteen children.</p>\n\n` +
      `<blockquote class="wp-block-quote interview-quote">\n<p>${BETH_QUOTE}</p>\n</blockquote>\n\n` +
      `<p>So the setting is entitled to put thirteen children with one qualified adult and chooses to put five, funded from fees rather than absorbed. Preschool is the room where most settings take the saving, which makes this the clearest answer in the interview to what the fees are actually for, and it runs directly against the pressure described in our piece on <a href="${ND}/lester-aldridge-inflation-above-4-hits-nursery-margins/">inflation above 4% and nursery margins</a>.</p>`,
  },
  {
    what: "second reference in the award section",
    from: `<p>Akker was named Manager of the Year at the 2026 NDNA Awards.`,
    to: `<p>Caroline was named Manager of the Year at the 2026 NDNA Awards.`,
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

// Only the two full-name first references may still carry the surname.
const left = (out.match(/Akker/g) || []).length;
const fullName = (out.match(/Caroline Akker/g) || []).length;
if (left !== fullName) throw new Error(`${left - fullName} bare surname(s) still in the body`);
console.log(`surname now appears ${left} times, all as "Caroline Akker" first references`);

// Her existing quotes must be untouched; exactly one new one is added.
const qBefore = (before.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []);
const qAfter = (out.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []);
if (qAfter.length !== qBefore.length + 1) throw new Error(`expected 1 new quote, got ${qAfter.length - qBefore.length}`);
for (const q of qBefore) if (!out.includes(q)) throw new Error("an existing quote was altered");
console.log(`quotes ${qBefore.length} -> ${qAfter.length}, all previous ones intact`);

const ours = out.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " ");
if (/[\u2014\u2013]/.test(ours)) throw new Error("dash in our copy");
console.log(`${before.length} -> ${out.length} bytes`);

if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const tmp = `/tmp/caroline-name-${Date.now()}.html`;
put(Buffer.from(out, "utf8"), tmp);
if (Number(ssh(`wc -c < ${tmp}`).trim()) !== Buffer.byteLength(out)) throw new Error("upload mismatch");
ssh(`wp post update ${POST_ID} ${tmp} && rm -f ${tmp}`);
const pre = ssh(`wp config get table_prefix`).trim();
ssh(`wp db query "DELETE FROM ${pre}yoast_indexable WHERE object_id=${POST_ID} AND object_type='post'"`);
console.log(ssh(`wp cache flush; wp sg purge; wp sg purge "$(wp post url ${POST_ID})" 2>/dev/null || true`));
console.log(`stored ${ssh(`wp post get ${POST_ID} --field=post_content`).length} bytes`);

const { forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
await forSite(site.id).article.updateMany({ where: { wpPostId: POST_ID }, data: { body: out } });
await prisma.$disconnect();
