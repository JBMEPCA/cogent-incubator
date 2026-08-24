import { redirect } from "next/navigation";
import { completeConnection, siteSlugFromState } from "@/lib/linkedin";
import { getSite } from "@/lib/site";
import { canEdit } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Where LinkedIn sends the browser back after consent. Register this exact URL
// on the app's Auth tab or LinkedIn refuses the handshake.
//
// One callback serves the whole fleet, so which title consented is read out of
// the state parameter rather than the path — see authorizeUrl().
export async function GET(request) {
  if (!(await canEdit())) {
    redirect("/?error=" + encodeURIComponent("This account is read-only."));
  }

  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const slug = siteSlugFromState(state);
  const back = slug ? `/s/${slug}/linkedin` : "/";
  const fail = (msg) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  // LinkedIn reports a refused consent here rather than by not calling back.
  if (params.get("error")) {
    return fail(params.get("error_description") || params.get("error"));
  }
  const code = params.get("code");
  if (!code) return fail("LinkedIn did not return an authorisation code.");
  if (!slug) return fail("The LinkedIn callback did not say which title it was for.");

  const site = await getSite(slug);
  if (!site) return fail(`No title called "${slug}".`);

  let name;
  try {
    name = await completeConnection(site, code, state);
  } catch (e) {
    return fail(e.message);
  }
  // Outside the try: redirect() throws by design and must not be caught above.
  redirect(`${back}?connected=${encodeURIComponent(name)}`);
}
