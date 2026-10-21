// Two questions about the named-place image rule.
//
//   1. Does it catch the picture that caused it? (the Carrington, 19 Oct 2026)
//   2. How much of the fleet's real header imagery would it drop, IF the story
//      were about a named place? The filter only runs in that case, but the
//      blast radius is worth seeing rather than guessing.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_named-place-image-check.mjs
import { looksLikeExterior } from "../lib/images.js";
import { prisma, fleetRead } from "../lib/prisma.js";

// The exact Pexels caption that ran above "Senior Resource Group Buys
// Carrington, Hits 23 Communities".
const CULPRIT =
  "Modern retirement community building with brick and timber cladding, landscaped courtyard, and covered parking area.";

const CASES = [
  [CULPRIT, true, "the Carrington culprit"],
  ["Aerial view of a golf resort clubhouse and fairways at sunset", true, "golf resort exterior"],
  ["Exterior facade of a modern apartment block", true, "plain exterior"],
  ["Airport terminal building at dusk", true, "terminal exterior"],
  ["Close-up of hands repairing a bicycle wheel", false, "detail shot"],
  ["Older woman and a care worker talking over a cup of tea", false, "people at work"],
  ["Empty hair salon chair and mirror", false, "interior detail"],
  ["Rows of solar panels in a field", false, "equipment"],
  ["Chef plating a meal in a commercial kitchen", false, "interior activity"],
];

let bad = 0;
console.log("word test:");
for (const [text, want, label] of CASES) {
  const got = looksLikeExterior({ title: text, tags: "" });
  const ok = got === want;
  if (!ok) bad++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${got ? "exterior " : "usable   "} ${label}`);
}

console.log("\nblast radius against real fleet header captions:");
const rows = await fleetRead().article.findMany({
  where: { imageAlt: { not: null }, status: "published" },
  select: { imageAlt: true, site: { select: { slug: true } } },
  take: 600,
});
const per = {};
for (const r of rows) {
  const s = (per[r.site.slug] ||= { n: 0, hit: 0 });
  s.n++;
  if (looksLikeExterior({ title: r.imageAlt, tags: "" })) s.hit++;
}
for (const [slug, s] of Object.entries(per).sort((a, b) => b[1].hit / b[1].n - a[1].hit / a[1].n)) {
  const pct = ((s.hit / s.n) * 100).toFixed(0);
  console.log(`  ${slug.padEnd(28)} ${String(s.hit).padStart(3)}/${String(s.n).padEnd(3)} ${pct.padStart(3)}% would be dropped on a named-place story`);
}
const tot = Object.values(per).reduce((a, s) => ({ n: a.n + s.n, hit: a.hit + s.hit }), { n: 0, hit: 0 });
console.log(`  ${"FLEET".padEnd(28)} ${tot.hit}/${tot.n} ${((tot.hit / tot.n) * 100).toFixed(0)}%`);

await prisma.$disconnect();
console.log(`\n${CASES.length - bad}/${CASES.length} word tests passed`);
process.exit(bad ? 1 : 0);
