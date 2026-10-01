import { getSiteContext } from "@/lib/site";
import { readOverlayName, loadInterview, drawInterview } from "@/lib/social-overlay";
import { socialImage } from "@/lib/social-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The interview overlay, as a JPEG at a public address, for Make to download
// when it posts to LinkedIn or Instagram (lib/social-overlay).
//
// Public like api/card: Make fetches it with a plain request and no session.
// Only addresses signed by the posting job are answered, so this can draw
// nothing but the overlay of a real published interview.
//
// It never answers with a broken picture. If the overlay cannot be drawn the
// clean photo is served at the same address instead: a post that goes out
// plain is fine, a post Make fails on switches the whole scenario off for
// every title (22 Sep 2026).
export async function GET(request, { params }) {
  const { slug, file } = await params;
  const want = readOverlayName(slug, file);
  if (!want) return new Response("Not found", { status: 404 });

  const ctx = await getSiteContext(slug);
  const wp = ctx?.creds?.wordpress;
  if (!ctx || !wp?.url) return new Response("Not found", { status: 404 });

  let interview = null;
  try {
    interview = await loadInterview(ctx.site, wp, want.wpPostId);
    if (!interview) return new Response("Not an interview", { status: 404 });
    const drawn = await drawInterview(ctx.site, interview, want.format);
    return new Response(drawn.buffer, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (e) {
    console.warn(`[overlay] ${slug} ${want.wpPostId} ${want.format}: ${e.message}; serving the plain photo`);
    if (!interview?.imageUrl) return new Response("Picture unavailable", { status: 502 });
    const dims = want.format === "instagram" ? { width: 1080, height: 1350 } : { width: 1200, height: 628 };
    try {
      const res = await fetch(socialImage(interview.imageUrl, dims), { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      return new Response(Buffer.from(await res.arrayBuffer()), {
        headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300", "x-overlay": "fallback" },
      });
    } catch {
      return new Response("Picture unavailable", { status: 502 });
    }
  }
}
