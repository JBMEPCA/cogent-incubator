/**
 * Read or set how many subscribers a title may gain per week.
 *
 *   node --import ./scripts/_register.mjs scripts/set-drip-rate.mjs
 *   node --import ./scripts/_register.mjs scripts/set-drip-rate.mjs smart-sme 2000
 *
 * The rate is per title because the schedule cannot be: the cron fires the same
 * days for every title, so "two thousand on Smart SME, a thousand on the rest"
 * has to live with the title. Stored in EngineSetting under drip.weeklyTarget.
 */

import "./_env.mjs";
import { prisma, forSite } from "../lib/prisma.js";
import { getWeeklyTarget, setWeeklyTarget, importedThisWeek, ukWeekStart } from "../lib/prospects.js";

const [slug, target] = process.argv.slice(2);

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  select: { id: true, slug: true, name: true },
  orderBy: { createdAt: "asc" },
});

if (slug && target !== undefined) {
  const site = sites.find((s) => s.slug === slug);
  if (!site) {
    console.error(`No live title with slug "${slug}". Known: ${sites.map((s) => s.slug).join(", ")}`);
    process.exit(1);
  }
  const n = Number(target);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`"${target}" is not a weekly target.`);
    process.exit(1);
  }
  await setWeeklyTarget(site.id, n);
  console.log(`${site.name}: weekly target set to ${n}`);
}

console.log(`\nWeek beginning ${ukWeekStart().toISOString()} (UK Monday 00:00)\n`);
for (const site of sites) {
  const [weekly, used, stored] = await Promise.all([
    getWeeklyTarget(site.id),
    importedThisWeek(site.id),
    // Whether a rate was actually set for this title, rather than whether it
    // happens to equal the default. Those are different facts and only the
    // first one tells you the title has been thought about.
    forSite(site.id).engineSetting.findFirst({ where: { key: "drip.weeklyTarget" } }),
  ]);
  const note = stored ? "" : "  (falling back to the default)";
  console.log(
    `${site.slug.padEnd(26)} ${String(weekly).padStart(5)} a week   used ${String(used).padStart(5)}   left ${String(Math.max(0, weekly - used)).padStart(5)}${note}`
  );
}

await prisma.$disconnect();
