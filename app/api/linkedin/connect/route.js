import { redirect } from "next/navigation";
import { authorizeUrl, isLinkedInAppConfigured } from "@/lib/linkedin";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

// Starts the one-time LinkedIn sign-in for ONE title. Sits behind the app's
// login like every other page, so only a signed-in session can bind an account.
//
// The title has to be named: the consent that comes back authorises a specific
// company page, and storing it against the wrong publication would post one
// magazine's articles to another's feed.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("site");
  if (!slug) redirect("/?error=" + encodeURIComponent("Connecting LinkedIn needs ?site=<slug>."));

  const site = await getSite(slug);
  if (!site) redirect("/?error=" + encodeURIComponent(`No title called "${slug}".`));

  const back = `/s/${slug}/linkedin`;
  if (!isLinkedInAppConfigured()) {
    redirect(`${back}?error=` + encodeURIComponent("Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET first."));
  }
  redirect(await authorizeUrl(site));
}
