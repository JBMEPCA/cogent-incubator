// Runs the shipped pressFaults() over real held drafts, to show which "quotes"
// it complains about and why. Pulled out of the source text rather than
// imported, because press-intake.js drags in the whole desk.
//
//   node scripts/_press-quote-check.mjs "Pair of established" "LEAPMOTOR REVEALS"
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const grab = (file, re) => {
  const m = fs.readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8").match(re);
  if (!m) throw new Error(`${re} not found in ${file}`);
  return m[0].replace(/^export /, "");
};
const src = [
  grab("drafting.js", /export function stripEmDashes[\s\S]*?\n}/),
  grab("press-intake.js", /function htmlToText[\s\S]*?\n}/),
  grab("press-intake.js", /const norm = [\s\S]*?\.trim\(\);/),
  grab("press-intake.js", /function articleText[\s\S]*?\n}/),
  grab("press-intake.js", /export function pressFaults[\s\S]*?\n}/),
].join("\n");
const { pressFaults, articleText, norm } = new Function(`${src}; return { pressFaults, articleText, norm };`)();

const p = new PrismaClient();
for (const s of process.argv.slice(2)) {
  const it = await p.feedItem.findFirst({ where: { title: { contains: s }, link: { startsWith: "gmail:" } }, include: { articles: { select: { body: true, brief: true } } } });
  const a = it?.articles[0];
  if (!a?.body) { console.log(`== ${s}: no draft`); continue; }
  const release = String(a.brief || "").replace(/^[\s\S]*?Full text follows; it is the only source\.\s*/, "");
  const text = norm(articleText(a.body));
  console.log(`== ${s}\n  quote marks in article text: ${(text.match(/"/g) || []).length}`);
  for (const m of text.matchAll(/.{0,50}"/g)) console.log("   …" + m[0]);
  console.log("  faults:", pressFaults(a.body, release));
}
await p.$disconnect();
