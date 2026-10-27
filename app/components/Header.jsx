"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteMark from "./SiteMark";
import EngineRoomLight from "./EngineRoomLight";
import { useActiveSite } from "./FleetContext";
import MobileNav from "./MobileNav";
import TitleMenu from "./TitleMenu";
import { SECTIONS, sectionActive } from "./nav-sections";
import { visitUrl } from "@/lib/site-url";

// The header inside a title.
//
// Every nav link is relative to the title in the URL rather than absolute, so
// the same component serves every publication. It reads the active title from
// fleet context instead of taking a prop, which is what lets the ten pages
// underneath it stay exactly as they were.
//
// Left: the title badge and its menu (visit, all titles, sign out). Middle:
// the five sections. Right: the engine pill and the settings gear, the two
// things about the title's machinery rather than its work.

// Settings is not a section, but the phone sheet lists it with them.
const SETTINGS = { seg: "/settings", label: "Settings" };

// A gear, inline so there is no icon dependency for one glyph.
function Gear() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Header() {
  const site = useActiveSite();
  const pathname = usePathname() || "";

  // Rendered above a title that hasn't resolved yet (or on a fleet screen that
  // reuses this header): fall back to a plain bar rather than crashing on
  // site.slug.
  if (!site) {
    return (
      <header className="site-header">
        <Link href="/" className="nav-link">All titles</Link>
      </header>
    );
  }

  const base = `/s/${site.slug}`;
  const rest = pathname.slice(base.length) || "/";
  // Null while a title is still in setup, which is exactly when there is
  // nothing to visit.
  const live = visitUrl(site);

  const onSettings = sectionActive(SETTINGS, rest);

  return (
    <header className="site-header">
      <div className="site-badge-group">
        <Link href={base} className="site-badge">
          <SiteMark site={site} size={30} showStatus={false} />
          <span className="site-badge-name">
            {site.name}
            {site.strapline && <em>{site.strapline}</em>}
          </span>
        </Link>
        <TitleMenu site={site} live={live} />
      </div>

      {/* Layout lives in .site-nav, not inline: an inline display beat the
          phone rule that hides this row, so it drew over the badge. */}
      <nav className="site-nav">
        {SECTIONS.map((s) => {
          const active = sectionActive(s, rest);
          return (
            <Link
              key={s.seg || "dash"}
              href={`${base}${s.seg}`}
              className="nav-link"
              aria-current={active ? "page" : undefined}
              style={active ? { color: "var(--text)", background: "rgba(101,125,255,.12)" } : undefined}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      <div className="site-tools site-util">
        <EngineRoomLight />
        <Link
          href={`${base}/settings`}
          className={`site-gear${onSettings ? " is-active" : ""}`}
          title="Title settings"
          aria-label="Title settings"
          aria-current={onSettings ? "page" : undefined}
        >
          <Gear />
        </Link>
      </div>

      {/* Renders nothing above 760px; below it, this is the whole nav. */}
      <MobileNav sections={[...SECTIONS, SETTINGS]} base={base} rest={rest} site={site} live={live} />
    </header>
  );
}
