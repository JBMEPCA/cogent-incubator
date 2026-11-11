/**
 * Read or set the most subscribers a title's list may hold.
 *
 *   node --import ./scripts/_register.mjs scripts/set-list-cap.mjs
 *   node --import ./scripts/_register.mjs scripts/set-list-cap.mjs smart-sme 17000
 *   node --import ./scripts/_register.mjs scripts/set-list-cap.mjs smart-sme none
 *
 * Several at once: slug=cap pairs, e.g. smart-sme=17000 fleet=10000.
 * The same value the Cap cell on /lists edits. Stored in EngineSetting under
 * drip.cap; no row means no cap.
 */

import "./_env.mjs";
import { prisma } from "../lib/prisma.js";
import { getListCap, setListCap, audienceMemberCount } from "../lib/prospects.js";
import { siteCredentials } from "../lib/site.js";

const args = process.argv.slice(2);
const pairs = args.some((a) => a.includes("="))
  ? args.map((a) => a.split("="))
  : args.length === 2
    ? [args]
    : [];

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  select: { id: true, slug: true, name: true },
  orderBy: { createdAt: "asc" },
});

for (const [slug, raw] of pairs) {
  const site = sites.find((s) => s.slug === slug);
  if (!site) {
    console.error(`No live title with slug "${slug}". Known: ${sites.map((s) => s.slug).join(", ")}`);
    process.exit(1);
  }
  const clear = /^(none|off|-)$/i.test(raw);
  if (!clear && !(Number(raw) >= 0)) {
    console.error(`"${raw}" is not a cap.`);
    process.exit(1);
  }
  const cap = await setListCap(site.id, clear ? null : raw);
  console.log(`${site.name}: cap ${cap == null ? "removed" : `set to ${cap}`}`);
}

console.log("");
for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const [cap, members] = await Promise.all([getListCap(site.id), audienceMemberCount(creds.mailchimp?.audienceId)]);
  const room = cap != null && members != null ? Math.max(0, cap - members) : null;
  console.log(
    `${site.slug.padEnd(26)} cap ${String(cap ?? "none").padStart(6)}   members ${String(members ?? "?").padStart(6)}   room ${String(room ?? "-").padStart(6)}`
  );
}

await prisma.$disconnect();
