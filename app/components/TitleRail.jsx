"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteMark, { SiteMarkEmpty, statusTone } from "./SiteMark";

// The persistent title rail, pinned to the right of every screen.
//
// It is the only navigation that never changes: whatever you are looking at,
// the whole portfolio is one click away. The Cogent mark at the top returns to
// the fleet overview, and the dashed slots below the live titles are the
// provisioning entry point rather than decoration — dead space that does
// nothing is how "we'll add the wizard later" turns into never.

// Enough empty slots to show where the fleet is going, without the rail
// becoming a wall of dashes once titles fill in. Always keeps at least one, so
// there is always somewhere to click to add the next.
function emptySlotCount(liveCount) {
  return Math.max(1, 6 - liveCount);
}

export default function TitleRail({ sites = [] }) {
  const pathname = usePathname() || "";

  // Nothing to navigate on the login screen, and a rail of titles above a
  // sign-in form leaks the portfolio to anyone who reaches the page.
  if (pathname.startsWith("/login") || pathname.startsWith("/logout")) return null;

  const activeSlug = pathname.startsWith("/s/") ? pathname.split("/")[2] : null;
  const onFleet = pathname === "/";
  const onNew = pathname.startsWith("/new-title");
  const slots = emptySlotCount(sites.length);

  return (
    <aside className="rail" aria-label="Titles">
      <Link
        href="/"
        className={`rail-home${onFleet ? " is-active" : ""}`}
        title="All titles"
        aria-current={onFleet ? "page" : undefined}
      >
        <span className="rail-home-mark">C</span>
        <span className="rail-home-label">ALL</span>
      </Link>

      <div className="rail-divider" />

      <nav className="rail-list">
        {sites.map((site) => {
          const active = site.slug === activeSlug;
          const tone = statusTone(site.status);
          return (
            <Link
              key={site.id}
              href={`/s/${site.slug}`}
              className={`rail-item${active ? " is-active" : ""}`}
              title={`${site.name} — ${tone.label}`}
              aria-current={active ? "page" : undefined}
            >
              <SiteMark site={site} size={44} active={active} />
              <span className="rail-tip">
                {site.name}
                <em>{tone.label}</em>
              </span>
            </Link>
          );
        })}

        {Array.from({ length: slots }).map((_, i) => (
          <Link
            key={`empty-${i}`}
            href="/new-title"
            className={`rail-item rail-item-empty${onNew && i === 0 ? " is-active" : ""}`}
            title="Add a title"
          >
            <SiteMarkEmpty size={44} active={onNew && i === 0} />
            <span className="rail-tip">
              Upcoming title
              <em>Click to set one up</em>
            </span>
          </Link>
        ))}
      </nav>

      <div className="rail-foot">
        <span className="rail-count">
          {sites.length}
          <em>{sites.length === 1 ? "title" : "titles"}</em>
        </span>
      </div>
    </aside>
  );
}
