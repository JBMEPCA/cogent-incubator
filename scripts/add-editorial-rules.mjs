// Append two measured rules to each title's editorial standard, in the database.
//
//   node scripts/add-editorial-rules.mjs --all --dry
//   node scripts/add-editorial-rules.mjs --all
//
// The standard lives on Site.editorialStandardMd and is read at runtime by
// lib/voice.js, so a change here reaches the agents on their next run with no
// deploy. That matters right now: the app repo is 67 commits ahead of main on a
// feature branch, so anything written into lib/ would sit undeployed.
//
// RULE ONE: headline length. Measured 11 September 2026 across all five titles.
// Median rendered title lengths were 89, 98 and 107 characters on Smart SME,
// Fleet and Golf, against the roughly 60 Google shows, so 99% to 100% of results
// were cut off mid-clause. Backfilling short SEO titles fixed the archive where
// the house "hook: explainer" format allowed a clean split. This rule stops new
// articles rebuilding the problem, and helps most on Golf and Airport, whose
// headlines mostly do not split and so could not be fixed mechanically.
//
// RULE TWO: openings and closures. The strongest format signal in the data, and
// it was nobody's beat. One story about a named pizza restaurant closing is 20%
// of every impression Smart SME has had in ninety days, at position 6.9. Golf
// shows the same shape independently: its reopening and expansion stories are
// 18% of impressions and carry its best-clicking pages. Fleet has published no
// closure story at all.
//
// Idempotent: each block carries a marker and is skipped if already present.
import fs from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const DRY = process.argv.includes("--dry");
const ALL = process.argv.includes("--all");
const only = arg("site");
if (!only && !ALL) { console.error("Usage: --site=<slug> | --all [--dry]"); process.exit(1); }

const HEADLINE_MARKER = "## The headline length rule";
const BEAT_MARKER = "## Openings and closures";

const headlineRule = `
${HEADLINE_MARKER}

Google shows about 60 characters of a headline. Everything past that is cut off
and the reader never sees it.

So the news goes in the first 60 characters: who, what happened, and the number
if there is one. The explainer clause after the colon is written for somebody
already on the page, and nothing load-bearing belongs in it. If the only way to
understand your headline is to read past the colon, the headline is the wrong
way round.

This was measured on 11 September 2026. Median headline length across the fleet
was 89 to 107 characters, so between 99% and 100% of search results were being
truncated mid-clause, and on the longest ones the actual news never appeared at
all. It is the cheapest fixable thing on any of these sites.

Aim for 60 characters before the colon. Sixty-five is the ceiling. A headline
that needs more than that is usually two stories or one unmade decision.
`;

const beatFor = (title) => `
${BEAT_MARKER}

${title.beat}

Why this is a standing beat and not an occasional story: ${title.evidence}

How to write one, because ranking for these is easy and getting the click is not.
Name the business in the first three words. Use the plain word a person would
type, closes or opens or reopens, not ceases trading or commences operations.
Put the place in the headline where there is one. Keep the whole headline inside
60 characters, per the headline length rule above.

The trade angle still has to be there, and it is what makes the piece ours rather
than the local paper's: what it cost, what went wrong, what the numbers were, and
what someone else in the same position should do differently. That belongs in the
standfirst and the body. It does not belong in the headline, where it pushes the
news out of sight.

Never speculate about why a named business failed, and never imply wrongdoing.
Report what has been announced or filed, attribute it, and link the source.
`;

const TITLES = {
  "smart-sme": {
    beat: `Named UK small businesses opening, closing, expanding, relocating or going
into administration. Independents and owner-managed firms, not corporates.`,
    evidence: `one story about a named pizza restaurant closing over rising costs
accounts for 20% of every impression this title has had in ninety days, at
position 6.9. Nothing else on the site comes close, and it was not commissioned
as part of any beat.`,
  },
  "fleet-magazine": {
    beat: `Named operators failing, being acquired, opening depots or losing licences.
Haulier and coach administrations, O-licence revocations and public inquiry
outcomes, new depots, charging hubs and distribution centres, and fleet
operators moving sites.`,
    evidence: `this title has published no closure story at all, while the two
sister titles that have both show the same pattern. Operator failures are among
the most-read stories in this sector and the trade press covers them routinely,
so the absence is a gap rather than a judgement.`,
  },
  "golf-resort-magazine": {
    beat: `Named courses, clubs and resorts closing, reopening, being sold, breaking
ground or completing a renovation. Worldwide, not only in Britain.`,
    evidence: `reopening and expansion stories are 18% of this title's impressions
and carry its best-clicking pages, all of them named clubs. Readers search for a
specific club and what is happening to it, and this title is already the answer
for several.`,
  },
};

const { prisma } = await import("../lib/prisma.js");

const slugs = ALL ? Object.keys(TITLES) : [only];
const ALL_SITES = await prisma.site.findMany({ select: { id: true, slug: true, name: true, editorialStandardMd: true } });

let changed = 0;

// The headline rule goes on every title. The beat goes only where there is
// evidence for it, because a standing beat nobody has measured is just a quota.
for (const site of ALL_SITES) {
  const std = site.editorialStandardMd || "";
  let next = std;
  const added = [];

  if (!std.includes(HEADLINE_MARKER)) { next += headlineRule; added.push("headline length"); }

  const beat = TITLES[site.slug];
  if (beat && slugs.includes(site.slug) && !next.includes(BEAT_MARKER)) {
    next += beatFor(beat);
    added.push("openings and closures beat");
  }

  if (next === std) { console.log(`${site.name.padEnd(28)} already has both, unchanged`); continue; }

  console.log(`${site.name.padEnd(28)} ${DRY ? "would add" : "added"}: ${added.join(", ")}  (${std.length} -> ${next.length} chars)`);
  if (!DRY) {
    await prisma.site.update({ where: { id: site.id }, data: { editorialStandardMd: next } });
    changed++;
  }
}

console.log(`\n${DRY ? "DRY RUN. " : ""}${changed} standards updated`);
await prisma.$disconnect();
