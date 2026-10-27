import { Inter } from "next/font/google";
import "./globals.css";
import TitleRail from "./components/TitleRail";
import { FleetProvider } from "./components/FleetContext";
import { listSites } from "@/lib/site";
import { currentRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import ReadOnlyBanner from "./components/ReadOnlyBanner";
import ReadOnlyGuard from "./components/ReadOnlyGuard";

// One family for everything. It was a display grotesk plus a mono for labels,
// two downloads before first paint; globals.css now points --font-mono here
// too. The variable name is kept so nothing that reads it has to change.
const grotesk = Inter({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Cogent Incubator",
  description: "Control room for the Cogent title portfolio",
};

// Next supplies a width=device-width viewport by default, but not the two
// things a phone build actually needs: viewportFit so the bottom title rail can
// clear the home indicator with env(safe-area-inset-bottom), and a themeColor
// so the browser chrome matches the app instead of sitting on a white bar above
// a near-black page. maximumScale is deliberately left alone — capping zoom is
// an accessibility regression, and the 16px input rule in globals.css is what
// stops iOS auto-zooming on focus.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d1220",
};

export default async function RootLayout({ children }) {
  // The rail is on every screen, so a database that is unreachable or not yet
  // migrated must not take the whole app down with it. An empty rail plus a
  // working login page is a far better failure than a stack trace, and during
  // first-run setup there genuinely are no titles yet.
  let sites = [];
  try {
    sites = await listSites();
  } catch {
    sites = [];
  }

  // Only decides whether the banner is drawn. If the lookup fails the page
  // still renders; the actions are guarded independently and refuse on their
  // own when the database is unreachable.
  let readOnly = false;
  // A session whose account row has gone: the account was removed in App
  // settings while its sign-in token was still valid. The token alone would
  // keep the whole app readable until it expired, so the shell is withheld
  // instead. Only a successful lookup that finds no row counts; a database
  // error leaves this false, so an outage never locks everyone out.
  let removed = false;
  try {
    const session = await auth();
    const role = await currentRole();
    readOnly = role === "viewer";
    removed = !!session?.user?.id && role === null;
  } catch {
    readOnly = false;
  }

  if (removed) {
    return (
      <html lang="en" className={grotesk.variable}>
        <body>
          <main className="fleet-wrap">
            <section className="panel fleet-empty">
              <h1>This account has been removed</h1>
              <p>Ask an admin for a new account if you still need access.</p>
              <a href="/logout" className="btn">Sign out</a>
            </section>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={grotesk.variable}>
      <body data-readonly={readOnly ? "true" : undefined}>
        {readOnly && <ReadOnlyGuard />}
        <FleetProvider sites={sites}>
          <div className="shell">
            <div className="shell-main">
              {readOnly && <ReadOnlyBanner />}
              {children}
            </div>
            <TitleRail sites={sites} />
          </div>
        </FleetProvider>
      </body>
    </html>
  );
}
