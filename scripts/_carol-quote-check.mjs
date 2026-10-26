// Every blockquote in the draft must come from Carol Hatcher's own answers.
// The fleet has published invented interviews before (Kesman, Zamaine), so
// this is checked mechanically rather than trusted.
//
// Light edits are expected and allowed: punctuation, an em dash turned into a
// comma, an obvious typo. What is NOT allowed is a sentence she never wrote.
// So both sides are reduced to bare words and the quote has to appear as a
// contiguous run inside the source.
import fs from "node:fs";

const DIR = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad";
const body = fs.readFileSync(`${DIR}/carol-draft-body.html`, "utf8");
const source = fs.readFileSync(`${DIR}/carol-answers.txt`, "utf8");

const words = (s) =>
  s
    .replace(/&#8217;|&#8216;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

const src = words(source);
const srcJoined = ` ${src.join(" ")} `;

const quotes = [...body.matchAll(/<blockquote[^>]*>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
console.log(`${quotes.length} quotes to check against ${src.length} words of source\n`);

let bad = 0;
for (const raw of quotes) {
  const w = words(raw);
  const joined = ` ${w.join(" ")} `;
  if (srcJoined.includes(joined)) {
    console.log(`  ok    ${w.length.toString().padStart(3)}w  ${w.slice(0, 9).join(" ")}...`);
    continue;
  }
  // Not contiguous. Report the longest run that IS present, so the drift is visible.
  let best = 0;
  let bestAt = 0;
  for (let i = 0; i < w.length; i++) {
    for (let len = w.length - i; len > best; len--) {
      if (srcJoined.includes(` ${w.slice(i, i + len).join(" ")} `)) {
        best = len;
        bestAt = i;
        break;
      }
    }
  }
  bad++;
  console.log(`  FAIL  ${w.length}w, longest matching run ${best}w`);
  console.log(`        quote : ${w.join(" ").slice(0, 150)}`);
  console.log(`        found : ${w.slice(bestAt, bestAt + best).join(" ").slice(0, 150)}`);
}

console.log(`\n${quotes.length - bad}/${quotes.length} quotes are verbatim runs of her answers`);
process.exit(bad ? 1 : 0);
