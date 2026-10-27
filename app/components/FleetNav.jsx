"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The fleet-level nav: the screens that are about the whole operation rather
// than one title.
//
// Five buttons, each landing on the first of its sub-tabs (FLEET_*_TABS in
// SubTabs.jsx) and staying lit across the rest. It had grown to eleven, one per
// page, which wrapped to two rows and made every button the same weight. Grouped
// by what the work is for: the machinery and what it costs, the numbers, the
// editorial desk, and selling.
//
// The icons are drawn here rather than imported, same reasoning as the gear in
// Header.jsx, and drawn to one spec so they read as a set: 24-unit box, no
// fill, 1.75 stroke in currentColor, round caps and joins, every shape kept
// inside 3–21. Mixed-weight icons — one hairline outline next to one solid
// glyph — are what makes a button row look assembled rather than designed, and
// at 15px the difference is very visible.

const ICON = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

/** Four panes — the grid of title cards. */
function GridIcon() {
  return (
    <svg {...ICON}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

/** Bars on a baseline. Drawn as strokes, not filled rects, so the weight
    matches the outlines either side of it. */
function ChartIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 20.5h17" />
      <path d="M7.5 20.5v-5" />
      <path d="M12 20.5v-9.5" />
      <path d="M16.5 20.5v-13" />
    </svg>
  );
}

/** A sheet with a headline rule and a block of type — the editorial desk. */
function PressIcon() {
  return (
    <svg {...ICON}>
      <path d="M5.5 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
      <path d="M17.5 8.5h1a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2" />
      <path d="M7 7.5h7" />
      <path d="M7 11.5h7" />
      <path d="M7 15.5h4" />
    </svg>
  );
}

/** A megaphone: the brands we sell advertising to. */
function MegaphoneIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2.5l8 4.5v-16l-8 4.5H5A1.5 1.5 0 0 0 3.5 10z" />
      <path d="M7.5 15.5l1.5 5" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  );
}

/** Two rooms side by side, a figure in each — the engine hub. */
function RoomsIcon() {
  return (
    <svg {...ICON}>
      <rect x="3.5" y="5" width="7.5" height="14" rx="1.6" />
      <rect x="13" y="5" width="7.5" height="14" rx="1.6" />
      <circle cx="7.25" cy="13" r="1.6" />
      <circle cx="16.75" cy="13" r="1.6" />
    </svg>
  );
}

/** A cog: the app's own settings. Same spec as the rest of the row. */
function CogIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Home", Icon: GridIcon },
  { href: "/engine-hub", label: "Engine", Icon: RoomsIcon, also: ["/costs"] },
  { href: "/analytics", label: "Analytics", Icon: ChartIcon, also: ["/trending", "/lists"] },
  { href: "/interviews", label: "Editorial", Icon: PressIcon, also: ["/press", "/needs-image"], badge: true },
  { href: "/advertisers", label: "Advertising", Icon: MegaphoneIcon },
];

export default function FleetNav() {
  const pathname = usePathname() || "/";
  // How many articles are waiting on a photograph a person has to find. It
  // rides on Editorial now that Needs an image is one of its sub-tabs, so the
  // count is still visible from every fleet page.
  //
  // Fetched rather than passed in, because this nav sits in every page's
  // header and threading one integer through all of them to show a badge is
  // not worth it. A badge must never be the reason a nav fails to render, so
  // every failure path just leaves it off.
  const [needsImage, setNeedsImage] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/api/needs-image/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && typeof d?.count === "number") setNeedsImage(d.count); })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname]);

  return (
    <nav className="fleet-nav" aria-label="Fleet views">
      {LINKS.map(({ href, label, Icon, also = [], badge }) => {
        // Exact match throughout: "/" would otherwise prefix-match every page
        // in the app.
        const active = [href, ...also].includes(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`fleet-nav-btn${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            {label}
            {badge && needsImage > 0 && (
              <span className="nav-badge" aria-label={`${needsImage} need an image`}>{needsImage}</span>
            )}
          </Link>
        );
      })}
      {/* App settings: icon only, after the groups, so it reads as the app's
          own controls rather than a sixth area of work. */}
      <Link
        href="/settings"
        className={`fleet-nav-btn fleet-nav-cog${pathname.startsWith("/settings") ? " is-active" : ""}`}
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        aria-label="App settings"
        title="App settings"
      >
        <CogIcon />
      </Link>
    </nav>
  );
}
