import { LOGO_PNG } from "@/lib/brand/logo";

export const dynamic = "force-static";

// Public, because it is loaded from inside outreach emails and from whatever
// news page pastes the badge. Mail clients refuse data: URIs in images, so the
// wordmark has to live at a real URL that anyone can fetch.
export async function GET() {
  return new Response(LOGO_PNG, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
