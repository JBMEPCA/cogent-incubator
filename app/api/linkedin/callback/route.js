import { redirect } from "next/navigation";
import { completeConnection } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

// Where LinkedIn sends the browser back after consent. Register this exact URL
// on the app's Auth tab or LinkedIn refuses the handshake.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const fail = (msg) => redirect(`/linkedin?error=${encodeURIComponent(msg)}`);

  // LinkedIn reports a refused consent here rather than by not calling back.
  if (params.get("error")) {
    return fail(params.get("error_description") || params.get("error"));
  }
  const code = params.get("code");
  if (!code) return fail("LinkedIn did not return an authorisation code.");

  let name;
  try {
    name = await completeConnection(code, params.get("state"));
  } catch (e) {
    return fail(e.message);
  }
  // Outside the try: redirect() throws by design and must not be caught above.
  redirect(`/linkedin?connected=${encodeURIComponent(name)}`);
}
