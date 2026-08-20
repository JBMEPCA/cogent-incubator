// Does the picture desk actually produce a picture?
//
//   node --import ./scripts/_register.mjs scripts/check-image-pipeline.mjs
//   node --import ./scripts/_register.mjs scripts/check-image-pipeline.mjs golf-resort-magazine
//   node --import ./scripts/_register.mjs scripts/check-image-pipeline.mjs golf-resort-magazine 2
//
// Runs the real chooseSmartImage against every article that is currently
// waiting on a header image, plus anything that published without one, and
// prints the picture gate's own verdicts. Read-only: it never writes an
// imageUrl, so it is safe against the live database.
//
// This exists because the failure it diagnoses is invisible from the outside.
// Between 19 and 20 August 2026 the Designer logged 27 successful runs whose
// summary was "No image passed the gate", five articles published bare, and
// nothing anywhere recorded WHY — the reason was invented by the caller. The
// answer turned out to be a gate that had been asked to reject an image showing
// the wrong brand and had read that as a requirement to show the right one, so
// no stock photograph could illustrate a story about a named company.
//
// Run it after touching lib/images.js or the picture gate in lib/qa.js, and
// run it against MORE than one title: the prompt is shared, and art direction
// that rescues a golf course drops a lorry.
//
// Each article costs a few tenths of a cent (Haiku routing plus up to five
// Haiku vision calls). The optional third argument repeats the sweep, which is
// worth doing before concluding anything: the gate is not deterministic and a
// single run flatters or damns a change by about one article in five.
import path from "node:path";
import fs from "node:fs";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { prisma, forSite } = await import("../lib/prisma.js");
const { chooseSmartImage } = await import("../lib/images.js");

const onlySlug = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : null;
const rounds = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a))) || 1;

const sites = await prisma.site.findMany({
  where: onlySlug ? { slug: onlySlug } : { engineEnabled: true },
  orderBy: { createdAt: "asc" },
});
if (!sites.length) {
  console.error(onlySlug ? `No title with slug "${onlySlug}"` : "No titles with the engine on");
  process.exit(1);
}

for (let round = 1; round <= rounds; round++) {
  if (rounds > 1) console.log(`\n================ round ${round} of ${rounds} ================`);

  for (const site of sites) {
    const db = forSite(site.id);
    const [waiting, bare] = await Promise.all([
      db.article.findMany({
        where: { status: { in: ["review", "approved"] }, imageUrl: null },
        orderBy: { createdAt: "desc" },
      }),
      db.article.findMany({
        where: { status: "published", imageUrl: null },
        orderBy: { publishedAt: "desc" },
      }),
    ]);
    const subjects = [
      ...waiting.map((a) => ({ a, note: "waiting" })),
      ...bare.map((a) => ({ a, note: "PUBLISHED BARE" })),
    ];

    console.log(`\n######## ${site.name} — ${waiting.length} waiting, ${bare.length} published bare`);
    if (!subjects.length) {
      console.log("   every article has a picture");
      continue;
    }

    let passed = 0;
    for (const { a, note } of subjects) {
      const started = Date.now();
      const { image, reason, tried } = await chooseSmartImage(site, {
        title: a.title,
        keyphrase: a.keyphrase,
        category: a.category,
      });
      console.log(`\n[${note}] "${a.title.slice(0, 72)}"`);
      if (image) {
        passed++;
        console.log(`   PASS score=${image.score} in ${Date.now() - started}ms — ${image.alt}`);
      } else {
        console.log(`   FAIL in ${Date.now() - started}ms — ${reason}`);
        for (const t of tried || []) console.log(`      ${t.slice(0, 150)}`);
      }
    }
    console.log(`\n   ${site.name}: ${passed}/${subjects.length} found a picture first time`);
  }
}

await prisma.$disconnect();
