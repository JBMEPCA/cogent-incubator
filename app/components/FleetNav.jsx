"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The fleet-level nav: the three screens that are about the whole operation
// rather than one title.
//
// These used to be a plain text link under the heading, which is where a
// fleet-wide page goes to be missed — it read as a caption rather than as
// somewhere to go. As buttons in the top right they sit where the eye lands
// after the heading, and there is now somewhere obvious for a fourth to live.
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

/** A note with a coin on it — spend. */
function MoneyIcon() {
  return (
    <svg {...ICON}>
      <rect x="3" y="6" width="18" height="12" rx="2.4" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 12h.01" />
      <path d="M17.5 12h.01" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "All titles", Icon: GridIcon },
  { href: "/analytics", label: "Group analytics", Icon: ChartIcon },
  { href: "/costs", label: "Group costs", Icon: MoneyIcon },
];

export default function FleetNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fleet-nav" aria-label="Fleet views">
      {LINKS.map(({ href, label, Icon }) => {
        // Exact match throughout: "/" would otherwise prefix-match every page
        // in the app, and the two fleet pages have nothing nested under them.
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`fleet-nav-btn${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
