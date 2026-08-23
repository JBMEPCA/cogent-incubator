"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFleet } from "./FleetContext";

// Sub-navigation for sections that own more than one page: Advertisers lives
// under CRM, SEO under Analytics. Keeps the top nav to five items without
// rewriting the pages themselves.
//
// The tab tables below stay written as bare segments ("/crm", "/seo") and this
// component prefixes the active title. That is deliberate: it means the ten
// pages importing CRM_TABS and ANALYTICS_TABS did not have to change at all
// when every route moved under /s/[slug].

export default function SubTabs({ items, active }) {
  const { slug } = useFleet();
  const pathname = usePathname() || "";
  const base = slug ? `/s/${slug}` : "";

  // `active` is still passed as a bare segment by the pages, so compare on the
  // segment rather than the resolved href.
  const current = active ?? (base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname);

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={`${base}${t.href}`}
          className="nav-link"
          style={
            t.href === current
              ? {
                  color: "var(--neon-cyan)",
                  background: "rgba(34,211,238,0.08)",
                  textShadow: "0 0 14px rgba(34,211,238,0.7)",
                }
              : undefined
          }
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export const CRM_TABS = [
  { href: "/crm", label: "Pipeline" },
  { href: "/advertisers", label: "Advertisers" },
];

export const ANALYTICS_TABS = [
  { href: "/analytics", label: "Performance" },
  { href: "/seo", label: "SEO" },
  { href: "/outreach", label: "Backlinks" },
  { href: "/mail", label: "Mail" },
  { href: "/newsletter", label: "Newsletter" },
];

// The LinkedIn queue is a content surface, so it lives with the rest of them
// rather than taking a sixth slot in the top nav.
export const CONTENT_TABS = [
  { href: "/content", label: "Engine" },
  { href: "/content?tab=schedule", label: "Schedule" },
  { href: "/content?tab=pr", label: "PR Sources" },
  { href: "/linkedin", label: "LinkedIn" },
];

export const ENGINE_TABS = [
  { href: "/engine-room", label: "The team" },
  { href: "/engine-room/costs", label: "Costs" },
];
