import { prisma } from "@/lib/prisma";
import { buildFeed, fleetToken } from "@/lib/ads";

// What one title should be running, for its cogent-ads plugin. Public in the
// proxy (the sites have no session) and closed by the fleet token instead,
// passed in the query string because the SiteGround WAF blocks wp-json calls
// that carry an Authorization header and the plugin mirrors that habit.

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const token = fleetToken();
  if (!token || url.searchParams.get("token") !== token) return new Response("Not found", { status: 404 });
  const site = await prisma.site.findUnique({ where: { slug: String(url.searchParams.get("site") || "") } });
  if (!site) return new Response("Not found", { status: 404 });
  return Response.json(await buildFeed(site), { headers: { "Cache-Control": "no-store" } });
}
