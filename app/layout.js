import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TitleRail from "./components/TitleRail";
import { FleetProvider } from "./components/FleetContext";
import { listSites } from "@/lib/site";
import { currentRole } from "@/lib/permissions";
import ReadOnlyBanner from "./components/ReadOnlyBanner";
import ReadOnlyGuard from "./components/ReadOnlyGuard";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Cogent Incubator",
  description: "Control room for the Cogent title portfolio",
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
  try {
    readOnly = (await currentRole()) === "viewer";
  } catch {
    readOnly = false;
  }

  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
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
