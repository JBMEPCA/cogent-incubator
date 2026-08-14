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
];

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

      <Link
        href={`${base}/settings`}
        className="nav-link"
        style={{ fontSize: 13, ...(rest.startsWith("/settings") ? { color: "var(--text)" } : null) }}
      >
        Integrations
      </Link>
      <Link href="/" className="nav-link" style={{ fontSize: 13 }}>
        All titles
      </Link>
      <a href="/logout" className="nav-link" style={{ fontSize: 13 }}>
        Sign out
      </a>
    </header>
  );
}
