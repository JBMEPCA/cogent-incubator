"use client";

import { useEffect, useState } from "react";

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

/** A head and shoulders — the interview pipeline is people, not documents. */
function PersonIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/** A door with an arrow leaving it. */
function ExitIcon() {
  return (
    <svg {...ICON}>
      <path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4" />
      <path d="M15.5 16.5l4.5-4.5-4.5-4.5" />
      <path d="M20 12H9.5" />
    </svg>
  );
}

/** A sheet with a headline rule and a block of type — a press release on the
    desk, drawn to the same 24-unit spec as the rest of the row. */
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

/** A folder: the shared Drive of media packs and documents. */
function FolderIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  );
}

/** A line that climbs and breaks upward — a search spike. */
function TrendIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 17.5l5.5-5.5 4 4 7.5-7.5" />
      <path d="M15 8.5h5.5V14" />
    </svg>
  );
}

// Media packs and other team documents live in a shared Google Drive folder,
// not in the app. Opens in a new tab because it leaves the dashboard.
const FILES_URL = "https://drive.google.com/drive/folders/1mgveqN4PRsWVqYDcU6dd1H63GZSST6vM";

function ImageIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.6" />
      <path d="M2.4 11.2 6 7.9l2.5 2.3L10.8 8l2.8 2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.1" cy="5.9" r="1.05" />
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

const LINKS = [
  { href: "/", label: "Home", Icon: GridIcon },
  { href: "/engine-hub", label: "Engine", Icon: RoomsIcon },
  { href: "/analytics", label: "Analytics", Icon: ChartIcon },
  { href: "/trending", label: "Trending", Icon: TrendIcon },
  { href: "/interviews", label: "Interviews", Icon: PersonIcon },
  { href: "/needs-image", label: "Needs an image", Icon: ImageIcon },
  { href: "/costs", label: "Costs", Icon: MoneyIcon },
  { href: "/press", label: "PR", Icon: PressIcon },
  { href: "/advertisers", label: "Advertisers", Icon: MegaphoneIcon },
];

export default function FleetNav() {
  const pathname = usePathname() || "/";
  // How many articles are waiting on a photograph a person has to find.
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
            {href === "/needs-image" && needsImage > 0 && (
              <span className="nav-badge" aria-label={`${needsImage} waiting`}>{needsImage}</span>
            )}
          </Link>
        );
      })}
      <a href={FILES_URL} target="_blank" rel="noopener noreferrer" className="fleet-nav-btn">
        <FolderIcon />
        Files
        <span aria-hidden="true">↗</span>
      </a>
    </nav>
  );
}
