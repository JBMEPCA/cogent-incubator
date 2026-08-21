import { wordmarkFor } from "@/lib/brand/wordmarks";
import { LOGO_PNG } from "@/lib/brand/logo";

export const dynamic = "force-dynamic";

// Public for the same reason the bare /api/brand/logo route is: it is loaded
// from inside outreach emails, and mail clients refuse data: URIs in images,
// so each title's wordmark has to live at a real URL anyone can fetch.
//
// Unknown slugs fall back to the fleet's original mark rather than 404ing:
// a broken image in an already-sent email is worse than a slightly wrong one.
export async function GET(_request, { params }) {
  const { slug } = await params;
  const mark = wordmarkFor(slug);
  return new Response(mark?.png || LOGO_PNG, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    },
  });
}
