import { prisma } from "@/lib/prisma";

// Serves a campaign file stored in the database (see CampaignAsset). Behind
// the proxy's sign-in like every other route, so a link only works for the
// team. ?download=1 saves it instead of opening it.

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { id } = await params;
  const a = await prisma.campaignAsset.findUnique({
    where: { id },
    select: { name: true, mimeType: true, data: true, url: true },
  });
  if (!a) return new Response("Not found", { status: 404 });
  if (!a.data) return a.url ? Response.redirect(a.url, 302) : new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const safe = a.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(a.data, {
    headers: {
      "Content-Type": a.mimeType || "application/octet-stream",
      "Content-Length": String(a.data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safe}"`,
      // Client files are opened by the team, so an SVG or HTML file must not
      // be able to run script on the app's origin.
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
