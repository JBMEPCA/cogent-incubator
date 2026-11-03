import { prisma } from "@/lib/prisma";
import { cronGuard } from "@/lib/cron";
import { pullEmailStats, pullSiteStats } from "@/lib/ads";

// Nightly: every title's banner views and clicks from its ad plugin, then the
// Mailchimp numbers for solus sends and newsletter banners. Each title's last
// four days are re-read, so a late beacon or a site that was down for a night
// is caught up by the next run rather than lost.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const sites = await prisma.site.findMany({ where: { status: { in: ["live", "cold_start"] } }, orderBy: { slug: "asc" } });
  const results = [];
  for (const site of sites) {
    try {
      results.push(await pullSiteStats(site));
    } catch (e) {
      results.push({ site: site.slug, error: String(e.message || e).slice(0, 200) });
    }
  }
  let email;
  try {
    email = await pullEmailStats();
  } catch (e) {
    email = { error: String(e.message || e).slice(0, 200) };
  }
  return Response.json({ sites: results, email });
}
