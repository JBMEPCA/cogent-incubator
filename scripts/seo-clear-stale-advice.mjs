// Clear the SEO advice queue of items that are not advice.
//
//   node --import ./scripts/_register.mjs scripts/seo-clear-stale-advice.mjs --dry
//   node --import ./scripts/_register.mjs scripts/seo-clear-stale-advice.mjs
//
// 82 advisory items were pending across the five titles on 3 September and only
// 19 of them asked for anything. The rest fall into three groups, and each is a
// symptom rather than a suggestion:
//
//   SWEEP_NOISE   The audit prompt tells the model to note what it could not
//                 fit inside its 12-suggestion cap. That note is addressed to
//                 the next sweep, not to a human, so it should never have
//                 reached a review queue. 51 of 82.
//   ALREADY_BUILT The model asks for a related-reading block, a read-next
//                 module or an internal-link template on every title, every
//                 few days. All of it shipped in the base theme's
//                 article-footer.php. It cannot see it: it audits
//                 content.rendered from the REST API, and the block is added
//                 by the theme at render time. Same blindness produces the
//                 schema and byline items, both of which Yoast already emits.
//   DELIBERATE    A decision NOT to link a post, correctly recorded. There is
//                 nothing to do with it but read it.
//
// lib/seo-agent.js now tells the model the related-reading block exists, so
// that group should stop refilling. The other two are inherent.
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

const DRY = process.argv.includes("--dry");

const RULES = [
  {
    name: "ALREADY_BUILT",
    test: /related[- ](posts|reading)|read[- ]next|internal[- ]link(ing)?[- ](checklist|map|template|minimum)|standing .*link block|link block for new posts/i,
    reason:
      "already live: the base theme ends every article with a What to read next block (three posts from the same section, one similar piece, the category hub and the post tags). Not visible in the REST content the audit reads.",
  },
  {
    name: "SCHEMA_LIVE",
    test: /schema markup for (product and )?news article/i,
    reason:
      "already live: Yoast emits NewsArticle, Person, Organization, BreadcrumbList, WebPage and WebSite JSON-LD on every post. Verified on the live site 3 Sep 2026.",
  },
  {
    name: "BYLINE_LIVE",
    test: /author bylines and dates/i,
    reason:
      "already live: the theme renders an author card and Yoast emits datePublished on every post. Verified on the live site 3 Sep 2026.",
  },
  {
    name: "DELIBERATE",
    test: /deliberately|do not force|limited honest linking|leave the .* short/i,
    reason: "acknowledged: this records a decision not to link a post, which needs reading rather than doing.",
  },
  {
    name: "SWEEP_NOISE",
    test: /next sweep|queued for next|to close in next|remaining|still need|still owed|still owe|to be added|to be closed|finish (remaining|internal|closing|must ?fix|link)|second (internal )?link/i,
    reason:
      "bookkeeping for the model's own 12-suggestion cap, addressed to the next sweep rather than to a person. The backlog it names was cleared by the 3 Sep recovery sweep.",
  },
];

const { prisma, forSite } = await import("../lib/prisma.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  select: { id: true, slug: true, name: true },
  orderBy: { createdAt: "asc" },
});

const totals = {};
const kept = [];

for (const s of sites) {
  const db = forSite(s.id);
  const advice = await db.seoSuggestion.findMany({
    where: { status: "pending", kind: "advice" },
    orderBy: { impact: "desc" },
  });

  for (const a of advice) {
    const rule = RULES.find((r) => r.test.test(a.title));
    if (!rule) {
      kept.push(`[${s.slug}] i${a.impact} ${a.title}`);
      continue;
    }
    totals[rule.name] = (totals[rule.name] ?? 0) + 1;
    if (!DRY) {
      await db.seoSuggestion.update({
        where: { id: a.id },
        data: { status: "dismissed", error: rule.reason },
      });
    }
  }
}

console.log(DRY ? "DRY RUN, nothing written\n" : "");
console.log("dismissed:", JSON.stringify(totals, null, 2));
console.log(`\nleft pending for a human (${kept.length}):`);
for (const k of kept) console.log("  " + k);
await prisma.$disconnect();
