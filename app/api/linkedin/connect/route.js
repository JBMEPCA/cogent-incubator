import { redirect } from "next/navigation";
import { authorizeUrl, isLinkedInConfigured } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

// Starts the one-time LinkedIn sign-in. Sits behind the app's login like every
// other page, so only a signed-in session can bind an account.
export async function GET() {
  if (!isLinkedInConfigured()) {
    redirect("/linkedin?error=" + encodeURIComponent("Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET first."));
  }
  redirect(await authorizeUrl());
}
