// Run the press desk over the real press@ mail WITHOUT publishing, labelling or
// replying, and print each draft so a person can read what would have gone out.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/press-dry-run.mjs [slug ...]
//   ... --cleanup     afterwards, delete the dry run's FeedItems and Articles so
//                     the live desk processes those emails from scratch
//
// Costs real money (sorting, drafting, QA), about the same as the live desk.
import { runPressIntake } from "../lib/press-intake.js";
import { forSite, prisma } from "../lib/prisma.js";

const args = process.argv.slice(2);
if (args.includes("--cleanup")) {
  const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
  for (const s of sites) {
    const db = forSite(s.id);
    const items = await db.feedItem.findMany({ where: { link: { startsWith: "gmail:" } }, select: { id: true } });
    if (!items.length) continue;
    const ids = items.map((i) => i.id);
    const arts = await db.article.deleteMany({ where: { sourceItemId: { in: ids }, status: { not: "published" } } });
    const fi = await db.feedItem.deleteMany({ where: { id: { in: ids }, articles: { none: {} } } });
    console.log(`${s.slug}: removed ${fi.count} press items, ${arts.count} unpublished articles`);
  }
  process.exit(0);
}

const only = args.filter((a) => !a.startsWith("--"));
const out = await runPressIntake({ dryRun: true, only: only.length ? only : null });
for (const t of out.results) {
  console.log(`\n=== ${t.site}${t.error ? ` ERROR ${t.error}` : ""}${t.deferred ? ` (${t.deferred})` : ""}`);
  for (const r of t.done) {
    console.log(`- ${JSON.stringify(r)}`);
    if (!r.article) continue;
    const s = await prisma.site.findUnique({ where: { slug: t.site }, select: { id: true } });
    const a = await forSite(s.id).article.findUnique({ where: { id: r.article } });
    console.log(`  TITLE (${a.title.length}): ${a.title}\n  CATEGORY: ${a.category}  QA: ${a.qaPassed}\n  META: ${a.metaDesc}\n  IMAGE: ${a.imageUrl || "(email picture, uploaded at publish)"} alt="${a.imageAlt}" credit="${a.imageCredit}"`);
    if (!a.qaPassed) console.log(`  QA REPORT: ${a.qaReport}`);
    console.log("  BODY:\n" + String(a.body || "").replace(/<[^>]+>/g, (t) => (/^<\/(p|h\d|li)>/.test(t) ? "\n" : t.startsWith("<a ") ? "[" : t === "</a>" ? "]" : "")).split("\n").map((l) => "    " + l.trim()).filter((l) => l.trim()).join("\n"));
  }
}
process.exit(0);
