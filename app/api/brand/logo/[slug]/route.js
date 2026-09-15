import { wordmarkFor } from "@/lib/brand/wordmarks";
import { LOGO_PNG } from "@/lib/brand/logo";

export const dynamic = "force-dynamic";

// Public for the same reason the bare /api/brand/logo route is: it is loaded
// from inside outreach emails, and mail clients refuse data: URIs in images,
// so each title's wordmark has to live at a real URL anyone can fetch.
//
// Unknown slugs fall back to the fleet's original mark rather than 404ing:
// a broken image in an already-sent email is worse than a slightly wrong one.
//
// ?kind=masthead serves the title's main mark (stacked, for some titles) for
// the newsletter proof; the default is the one-line mark outreach emails draw
// at 22px, and it must stay the default because sent emails already link it.
export async function GET(request, { params }) {
  const { slug } = await params;
  const mark = wordmarkFor(slug);
  const wantMasthead = new URL(request.url).searchParams.get("kind") === "masthead";
  const image = (wantMasthead && mark?.masthead) || mark?.png || LOGO_PNG;
  return new Response(image, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    },
  });
}
