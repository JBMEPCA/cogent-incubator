/**
 * Cosmin-Andrei Musat, 15 Oct 2026: too much of the piece is about the previous
 * owner and the state of the practice before he bought it. He is explicit that
 * the information is accurate and that he does not want the previous dentist
 * reading it as criticism.
 *
 * He is right, and the fault is ours rather than his. His own answer stated the
 * condition of the building plainly and once. We turned it into "somebody
 * else's tired surgery", "a practice that has been winding down for some
 * years", a heading reading "What 400 patients actually looked like" and a line
 * about the whole thing being "harder to believe of a trading practice in
 * 2026". None of that judgement is in his email. We sharpened a factual answer
 * into a characterisation of a named individual's professional conduct, and the
 * individual is identifiable: there is one previous owner of one practice in
 * Larne and the dental register is public.
 *
 * So the edits below are to OUR copy, not his, with one exception. The single
 * sentence of his that describes the man rather than the premises, about four
 * hours a day and a handful of patients, comes out at his request. It is his
 * quote and he is entitled to withdraw part of it. Everything left in the
 * blockquote is still verbatim and the gate re-proves both halves.
 *
 * What is NOT softened: that they bought an existing practice with about 400
 * patients, that the building and equipment needed replacing, and that it ran
 * on paper with no internet. He volunteered all of it, it is the reason the
 * story is worth reading, and removing it would leave an article about a
 * practice that grew for no visible reason.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_soften-musat-previous-owner.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const POST_ID = 278;
const ARTICLE_ID = "cmv6w0dja00017etb9do1fz4a";
const SOURCE_FILE =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420/moyle/answers.txt";

const NEW_META =
  "Cosmin-Andrei Musat and his wife Cristina bought an established Larne practice in January. Heart surgery had paused the plan. The list is now past 2,000.";

/** [what it is, exact old text, new text] */
const EDITS = [
  [
    "standfirst: our 'tired surgery'",
    `In January this year he and his wife Cristina bought somebody else&#8217;s tired surgery in Larne instead: no computers, no internet connection, and about 400 patients on the books. Nine months on the list is past 2,000.`,
    `In January this year he and his wife Cristina bought an established practice in Larne instead, with about 400 patients on the books, and rebuilt it from the plant upwards. Nine months on the list is past 2,000.`,
  ],
  [
    "heading: 'actually looked like' implies he was misled",
    `<h2 class="wp-block-heading">What 400 patients actually looked like</h2>`,
    `<h2 class="wp-block-heading">What they took on</h2>`,
  ],
  [
    "lead-in: our 'valuing a tired practice'",
    `The growth figure is the headline. The more useful number for anyone valuing a tired practice is the one on day one.`,
    `The growth figure is the headline. The more useful number for anyone buying an established practice is the one on day one.`,
  ],
  [
    "his quote: the one sentence about the man, withdrawn at his request",
    `thriving business. The previous dentist had been working approximately four hours a day, seeing only a handful of patients. The building was ageing,`,
    `thriving business. The building was ageing,`,
  ],
  [
    "our commentary: 'winding down for some years'",
    `A four-hour clinical day and a list of 400 describes a practice that has been winding down for some years, and it is a particular kind of purchase:`,
    `A list of 400 and a building that needs its plant replaced is a particular kind of purchase:`,
  ],
  [
    "heading: the absence of computers as the headline fact",
    `<h2 class="wp-block-heading">No computers, no internet connection</h2>`,
    `<h2 class="wp-block-heading">Rebuilding the fabric, and the systems</h2>`,
  ],
  [
    "our aside: 'harder to believe'",
    `<p>Then the part that is harder to believe of a trading practice in 2026.</p>`,
    `<p>The systems behind the surgeries needed the same treatment.</p>`,
  ],
];

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
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
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

let body = Buffer.from(ssh(`cd ${sq(docroot)} && wp post get ${POST_ID} --field=post_content | base64 -w0`), "base64").toString("utf8");
const before = body.length;

const problems = [];
for (const [what, oldText, newText] of EDITS) {
  const hits = body.split(oldText).length - 1;
  if (hits !== 1) {
    problems.push(`${what}: found ${hits} times, expected 1`);
    continue;
  }
  body = body.replace(oldText, newText);
  console.log(`edited  ${what}`);
}

// Nothing he said may have been altered, only shortened. Re-prove every quote.
const SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");
const norm = (x) =>
  x.replace(/<br>\s*<br>/g, " ").replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const src = norm(SOURCE);
const quotes = [...body.matchAll(/<blockquote[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
let verified = 0;
for (const q of quotes) {
  const n = norm(q);
  if (src.includes(n)) { verified++; continue; }
  // The trimmed quote is two verbatim halves with his sentence lifted out.
  const halves = n.split("The building was ageing,");
  if (halves.length === 2 && src.includes(halves[0].trim()) && src.includes("The building was ageing," + halves[1])) {
    verified++;
    console.log("quote shortened at his request, both halves still verbatim");
    continue;
  }
  problems.push(`QUOTE NO LONGER VERBATIM: ${n.slice(0, 90)}...`);
}

// The softening must not have removed the story with the judgement.
for (const must of ["approximately 400", "entirely paper-based", "over 2,000 patients", "Larne", "moyledentalcare.co.uk"])
  if (!body.includes(must)) problems.push(`softened away something load-bearing: ${must}`);
for (const gone of ["tired surgery", "winding down", "four hours a day", "previous dentist", "harder to believe"])
  if (body.includes(gone)) problems.push(`still present: ${gone}`);
if (/[\u2014\u2013]|&#8212;/.test(body.replace(/<blockquote[\s\S]*?<\/blockquote>/g, " "))) problems.push("dash in our copy");
if (NEW_META.length > 155) problems.push(`meta ${NEW_META.length} > 155`);

console.log(`\n${quotes.length} quotes, ${verified} verified | body ${before} to ${body.length} chars | meta ${NEW_META.length}/155`);
if (problems.length) {
  console.error("GATE FAILED:");
  for (const p of problems) console.error("  -", p);
  await prisma.$disconnect();
  process.exit(1);
}
console.log("gate passed: nothing of his altered, nothing load-bearing lost");

if (!APPLY) {
  console.log("DRY RUN, the live article is untouched. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

const stamp = Date.now();
ssh(`base64 -d > /tmp/musat-soften-${stamp}.html`, Buffer.from(body, "utf8").toString("base64"));
wp(`post update ${POST_ID} /tmp/musat-soften-${stamp}.html --post_excerpt=${sq(NEW_META)}`);
ssh(`rm -f /tmp/musat-soften-${stamp}.html`);
wp(`post meta update ${POST_ID} _yoast_wpseo_metadesc ${sq(NEW_META)}`);
ssh(`cd ${sq(docroot)} && wp sg purge; wp cache flush`);

await forSite(site.id).article.update({
  where: { id: ARTICLE_ID },
  data: { body, metaDesc: NEW_META },
});

const live = Buffer.from(ssh(`cd ${sq(docroot)} && wp post get ${POST_ID} --field=post_content | base64 -w0`), "base64").toString("utf8");
console.log(`\nlive now: ${live.length} chars`);
for (const gone of ["tired surgery", "winding down", "four hours a day", "previous dentist", "harder to believe"])
  console.log(`  ${gone.padEnd(18)} gone: ${!live.includes(gone)}`);
console.log(`  story intact      : ${live.includes("approximately 400") && live.includes("over 2,000 patients")}`);
console.log(`url: ${wp(`post url ${POST_ID}`)}`);
await prisma.$disconnect();
