import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // api/unsubscribe is public by necessity: the one-click opt-out in an outreach
  // email has to work for a stranger, and a login wall in front of it would make
  // the promise in the footer a lie. api/brand is public for the same reason,
  // one step removed: the wordmark is loaded by every recipient's mail client
  // and by any news page that pastes the badge.
  matcher: [
    "/((?!api/auth|api/cron|api/unsubscribe|api/brand|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
