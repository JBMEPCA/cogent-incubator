"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteMark from "./SiteMark";
import EngineRoomLight from "./EngineRoomLight";
import { useActiveSite } from "./FleetContext";

// The header inside a title.
//
// Every nav link is relative to the title in the URL rather than absolute, so
// the same component serves every publication. It reads the active title from
// fleet context instead of taking a prop, which is what lets the ten pages
// underneath it stay exactly as they were.

const SECTIONS = [
  { seg: "", label: "Dashboard" },
  { seg: "/crm", label: "CRM" },
  { seg: "/content", label: "Content" },
  { seg: "/analytics", label: "Analytics" },
  // Sits in the main nav rather than beside "Sign out", where it read as
  // account chrome and got missed. This is where a title is set up, so on a
  // fleet it is one of the pages you reach for most, not an afterthought.
  { seg: "/settings", label: "Settings", icon: true },
];

// A gear, inline so there is no icon dependency for one glyph.
function Gear() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: -2 }} aria-hidden="true">
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

  return (
    <header className="site-header">
      <Link href={base} className="site-badge">
        <SiteMark site={site} size={30} showStatus={false} />
        <span className="site-badge-name">
          {site.name}
          {site.strapline && <em>{site.strapline}</em>}
        </span>
      </Link>

      <nav style={{ display: "flex", gap: 6 }}>
        {SECTIONS.map((s) => {
          const href = `${base}${s.seg}`;
          const active = s.seg === "" ? rest === "/" : rest.startsWith(s.seg);
          return (
            <Link
              key={s.seg || "dash"}
              href={href}
              className="nav-link"
              style={active ? { color: "var(--text)", background: "rgba(101,125,255,.12)" } : undefined}
            >
              {s.icon && <Gear />}
              {s.label}
            </Link>
          );
        })}
        <EngineRoomLight />
      </nav>

      <span
        className="micro"
        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span className={`agent-dot${site.engineEnabled ? " online" : ""}`} />
        {site.engineEnabled ? "Engine running" : "Engine off"}
      </span>

      <Link href="/" className="nav-link" style={{ fontSize: 13 }}>
        All titles
      </Link>
      <a href="/logout" className="nav-link" style={{ fontSize: 13 }}>
        Sign out
      </a>
    </header>
  );
}
