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

/** A head and shoulders — the interview pipeline is people, not documents. */
function PersonIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
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

// Four buttons, each landing on the first of its sub-tabs (FLEET_*_TABS in
// SubTabs.jsx) and staying lit across the rest. Costs sits under the engine
// hub because that is what the money is spent on, mirroring the Engine Room
// inside a title; Trending sits under Analytics as the outside view beside
// the fleet's own numbers.
const LINKS = [
  { href: "/", label: "All titles", Icon: GridIcon },
  { href: "/engine-hub", label: "Engine hub", Icon: RoomsIcon, also: ["/costs"] },
  { href: "/analytics", label: "Analytics", Icon: ChartIcon, also: ["/trending"] },
  { href: "/interviews", label: "Interviews", Icon: PersonIcon },
];

export default function FleetNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fleet-nav" aria-label="Fleet views">
      {LINKS.map(({ href, label, Icon, also = [] }) => {
        // Exact match throughout: "/" would otherwise prefix-match every page
        // in the app. The one nested fleet page, the printable cost report,
        // has no nav on it.
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
          </Link>
        );
      })}
    </nav>
  );
}
