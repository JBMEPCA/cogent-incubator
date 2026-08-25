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
  // api/version is excluded for the same reason as api/cron: it is a machine
  // endpoint guarded by CRON_SECRET, and a login redirect in front of it makes
  // it useless for the one job it has. A route left in the matcher answers 307
  // to /login no matter what its own guard says — which reads exactly like the
  // route not being deployed, and cost an hour of chasing a Vercel build that
  // had been fine all along.
  matcher: [
    "/((?!api/auth|api/cron|api/version|api/unsubscribe|api/brand|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
