// Revive Airport Business Magazine's apollo:catch-all suppressions.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_revive-airport-catchalls.mjs [--write]
//
// The title was seeded 24 Aug 2026, when the ranker suppressed every row
// Apollo flagged catch-all to save verification credits. Both halves of that
// reasoning are gone: the verifier is out of the drip (JB, 10 Sep) and
// subscriber lists hold nothing back (JB, 21 Sep: load catch-alls too, rank
// confirmed first). The queue has now run dry, so these 4,034 contacts are
// the refill.
//
// They go live at the BACK of the queue, after every confirmed address and
// after the 27 new contacts from the 26 Oct file, best score first. Rows a
// verifier actually condemned (verify:*) and dead domains (no-mx) stay
// suppressed: those judgements are paid for and worth keeping.
import { prisma, forSite } from "../lib/prisma.js";

const WRITE = process.argv.includes("--write");

const site = await prisma.site.findUnique({ where: { slug: "airport-business-magazine" } });
const db = forSite(site.id);

const rows = await db.newsletterProspect.findMany({
  where: { suppressed: true, suppressReason: "apollo:catch-all" },
  select: { id: true, email: true, score: true, rank: true },
  orderBy: [{ score: "desc" }, { rank: "asc" }],
});

const top = await db.newsletterProspect.aggregate({ _max: { rank: true } });
let rank = (top._max.rank || 0) + 1;

console.log(`to revive  ${rows.length} apollo:catch-all rows`);
console.log(`new ranks  ${rank} to ${rank + rows.length - 1}`);
console.log(`first five:`);
for (const r of rows.slice(0, 5)) console.log(`  ${r.score}  ${r.email}`);

if (!WRITE) {
  console.log("\nDRY RUN. Nothing written. Re-run with --write.");
  await prisma.$disconnect();
  process.exit(0);
}

let done = 0;
for (let i = 0; i < rows.length; i += 50) {
  await prisma.$transaction(
    rows.slice(i, i + 50).map((r, j) =>
      db.newsletterProspect.update({
        where: { id: r.id },
        data: { suppressed: false, suppressReason: null, rank: rank + i + j },
      })
    )
  );
  done += Math.min(50, rows.length - i);
  if (done % 1000 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
}

const { prospectStats } = await import("../lib/prospects.js");
console.log(JSON.stringify(await prospectStats(site.id), null, 1));
await prisma.$disconnect();
