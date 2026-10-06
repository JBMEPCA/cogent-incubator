// Put the links SiteGround swallowed back on the sites.
//
//   node --import ./scripts/_register.mjs scripts/seo-recover-and-sweep.mjs --dry
//   node --import ./scripts/_register.mjs scripts/seo-recover-and-sweep.mjs
//
// On 27 and 31 August the host answered fetchPost and updatePost with an HTTP
// 202 bot challenge and an HTML body. 202 passes res.ok, so res.json() threw
// "Unexpected token '<'" and the sweep filed 182 perfectly good link
// suggestions as permanently failed, on all five titles, without ever having
// looked at the copy they were meant to change. lib/wordpress.js now retries a
// challenge and reports it as retryable, and app/api/cron/seo-apply leaves a
// retryable failure pending instead of burning it, so this cannot recur.
//
// This script is the one-off recovery for the ones already lost: it returns
// those suggestions to pending, then applies the whole pending queue in one
// pass rather than waiting the eight days the 25-a-day cap would take.
//
// Nothing here trusts a suggestion. applySuggestion re-reads the live post and
// refuses anything whose anchor has moved, is already linked, or is gone, so a
// suggestion written a week ago cannot write a link into copy that has changed
// underneath it.
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

// Same gap the cron uses: reads as editing, not scraping, to sg-security.
const WRITE_GAP_MS = 1300;
const KINDS = ["internal_link", "brand_link", "title_update"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { prisma, forSite } = await import("../lib/prisma.js");
const { getSiteContext } = await import("../lib/site.js");
const { applySuggestion } = await import("../lib/seo-agent.js");
const { isWordPressConfigured } = await import("../lib/wordpress.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  select: { slug: true },
  orderBy: { createdAt: "asc" },
});

const totals = { requeued: 0, applied: 0, refused: 0, blocked: 0, skipped: 0 };

for (const { slug } of sites) {
  const ctx = await getSiteContext(slug);
  if (!ctx) {
    console.log(`\n== ${slug}: no context, skipped`);
    continue;
  }
  const { site, creds } = ctx;
  const db = forSite(site.id);

  console.log(`\n== ${site.name} [${slug}]`);

  if (!isWordPressConfigured(creds?.wordpress)) {
    console.log("   no WordPress credential, skipped");
    totals.skipped++;
    continue;
  }

  // Step 1: un-burn the transport failures.
  const burned = await db.seoSuggestion.findMany({
    where: {
      status: "failed",
      error: { contains: "not valid JSON" },
      payload: { not: null },
      wpPostId: { not: null },
    },
    select: { id: true },
  });

  if (burned.length) {
    if (!DRY) {
      await db.seoSuggestion.updateMany({
        where: { id: { in: burned.map((b) => b.id) } },
        data: { status: "pending", error: null },
      });
    }
    console.log(`   requeued ${burned.length} suggestion(s) the host had blocked`);
    totals.requeued += burned.length;
  }

  // Step 2: apply everything appliable that is now pending.
  const pending = await db.seoSuggestion.findMany({
    where: { status: "pending", kind: { in: KINDS } },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

  console.log(`   ${pending.length} appliable pending${DRY ? " (dry run, nothing written)" : ""}`);

  if (DRY) {
    const byKind = {};
    for (const p of pending) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
    console.log(`   would apply: ${JSON.stringify(byKind)}`);
    continue;
  }

  let applied = 0;
  let refused = 0;

  for (const suggestion of pending) {
    try {
      await applySuggestion(site, suggestion, creds.wordpress);
      await db.seoSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "applied", appliedAt: new Date(), error: null },
      });
      applied++;
    } catch (e) {
      if (e.retryable) {
        // The host is challenging again. Leave this one and everything behind
        // it pending, and stop: grinding on only deepens the block.
        await db.seoSuggestion.update({
          where: { id: suggestion.id },
          data: { error: e.message?.slice(0, 300) },
        });
        console.log(`   BLOCKED by host, stopping this title: ${e.message?.slice(0, 140)}`);
        totals.blocked++;
        break;
      }
      await db.seoSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "failed", error: e.message?.slice(0, 300) },
      });
      refused++;
    }
    await sleep(WRITE_GAP_MS);
  }

  console.log(`   applied ${applied}, refused ${refused}`);
  totals.applied += applied;
  totals.refused += refused;
}

console.log(`\nTOTALS ${JSON.stringify(totals)}`);
await prisma.$disconnect();
