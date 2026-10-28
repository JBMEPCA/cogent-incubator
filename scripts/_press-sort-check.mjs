// Re-sorts the releases Lucas judged in his 28 Oct 2026 review and compares the
// desk's call with his. Sorting only (Haiku, about 0.1p each): nothing is
// drafted, labelled or published, and nothing is written to the database.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_press-sort-check.mjs
import Anthropic from "@anthropic-ai/sdk";
import { sortRelease, sortLane } from "../lib/press-intake.js";
import { prisma } from "../lib/prisma.js";

// Subject fragment → Lucas's verdict: true = should be used, false = rightly refused.
const LUCAS = {
  "Beyond project delivery": false,
  "Thales strengthens its commitment": true,
  "Preparing your hair for the winter": true,
  "Garrison® Dental Solutions": true,
  "All-Pro V1x Monday playoff": false,
  "GMS Studios develops new brand": true,
  "Rai and Fox join DP World": false,
  "Local charities partner up": true,
  "BC SoftWear offers": false,
  "From classroom to bedtime stories": false,
  "retirees keeping mentally and physically": true,
  "EIMA 2026": false,
  "blowfly risk continues": true,
  "Why supporting established care businesses": false,
  "Fiat Multiplina": false,
  "2CV BRINGS A SMILE": false,
  "Alfa Romeo Giulia": false,
  "Debenhams Group returns to Burnley": false,
  "FURTHER INVESTMENT TO IMPROVE BRITAIN": true,
};

const sites = await prisma.$queryRawUnsafe(`select * from "Site"`);
const client = new Anthropic();
let agree = 0;
for (const [frag, lucas] of Object.entries(LUCAS)) {
  const [it] = await prisma.$queryRawUnsafe(
    `select "siteId", title, summary, "publishedAt", "discoveredAt" from "FeedItem" where link like 'gmail:%' and title ilike $1 limit 1`,
    `%${frag}%`
  );
  if (!it) { console.log(`?? not found: ${frag}`); continue; }
  const site = sites.find((s) => s.id === it.siteId);
  const text = String(it.summary || "").replace(/^\[(from|skipped|pitch|photo)[^\]]*\]\s*/gm, "");
  const from = String(it.summary || "").match(/^\[from: ([^\]]*)\]/m)?.[1] || "unknown";
  const sorted = await sortRelease(client, site, { from, subject: it.title, date: it.publishedAt || it.discoveredAt, text });
  const lane = sortLane(sorted);
  const used = !lane.skip;
  if (used === lucas) agree++;
  console.log(`${used === lucas ? "  match" : "MISMATCH"}  lucas=${lucas ? "use " : "skip"} desk=${used ? (lane.guide ? "guide" : "use  ") : "skip "} r${sorted.relevance} n${sorted.newsValue} u${sorted.usefulness ?? "-"} ${site.slug.padEnd(20)} ${it.title.slice(0, 55)}${lane.skip ? `\n           ${lane.skip.slice(0, 150)}` : ""}`);
}
console.log(`\nAgrees with Lucas on ${agree} of ${Object.keys(LUCAS).length}`);
await prisma.$disconnect();
