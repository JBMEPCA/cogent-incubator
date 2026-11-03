import { prisma } from "@/lib/prisma";
import { fleetToken } from "@/lib/ads";

// The served copy of one creative, for a site's plugin to download once and
// keep in its own uploads folder. Readers never fetch this: the plugin serves
// its local copy, so this is hit a handful of times per creative, not per view.

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { id } = await params;
  const token = fleetToken();
  if (!token || new URL(req.url).searchParams.get("token") !== token) return new Response("Not found", { status: 404 });
  const a = await prisma.campaignAsset.findUnique({ where: { id }, select: { webData: true, webMime: true } });
  if (!a?.webData) return new Response("Not found", { status: 404 });
  return new Response(a.webData, {
    headers: {
      "Content-Type": a.webMime || "application/octet-stream",
      "Content-Length": String(a.webData.length),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
