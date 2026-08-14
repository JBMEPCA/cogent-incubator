"use client";

import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";

// The list of titles, available to any client component.
//
// The root layout already loads it for the rail, so putting it in context costs
// nothing extra and means the header can identify the title it is sitting above
// without every page having to thread a prop down to it. Ten pages that each
// had to remember to pass `site` to <Header> is ten chances to forget.

const FleetContext = createContext({ sites: [], site: null, slug: null });

export function FleetProvider({ sites, children }) {
  const pathname = usePathname() || "";
  const slug = pathname.startsWith("/s/") ? pathname.split("/")[2] : null;

  const value = useMemo(
    () => ({
      sites: sites || [],
      slug,
      site: slug ? (sites || []).find((s) => s.slug === slug) || null : null,
    }),
    [sites, slug]
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  return useContext(FleetContext);
}

/** The title currently being viewed, or null on fleet-level screens. */
export function useActiveSite() {
  return useContext(FleetContext).site;
}
