"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useActiveSite } from "./FleetContext";

// The engine pill: a status light and a one-line state, and the way into the
// Engine Room. Green and blinking while any agent is mid-run, amber when the
// team is on shift but idle, red when something is blocked, and dim when the
// engine is off.
//
// This replaced two things that said the same thing: an "Engine Room" nav link
// with a light on it, and a separate "Engine running" caption further right.
// One control now answers both "is it running?" and "where do I look?".
//
// It sits inside a client header (so it can build slug-aware links), so the
// counts come from the agents endpoint rather than a direct query. One small
// request per page load, scoped to the title being viewed.

const COLOURS = { red: "#dc2626", green: "#059669", amber: "#d97706", off: "#5b6884" };

export default function EngineRoomLight() {
  const site = useActiveSite();
  const pathname = usePathname() || "";
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    fetch(`/api/agents?site=${encodeURIComponent(site.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.agents) return;
        setCounts({
          working: d.agents.filter((a) => a.state === "working").length,
          blocked: d.agents.filter((a) => a.state === "blocked").length,
        });
      })
      // A failed poll leaves the light in its unknown state rather than
      // asserting "all clear", which would be the misleading answer.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [site]);

  if (!site) return null;

  const working = counts?.working ?? 0;
  const blocked = counts?.blocked ?? 0;
  const tone = !site.engineEnabled ? "off" : blocked ? "red" : working ? "green" : "amber";

  const label = !site.engineEnabled
    ? "Engine off"
    : blocked
      ? `${blocked} blocked`
      : working
        ? "Engine working"
        : "Engine on";

  const title = !site.engineEnabled
    ? "Engine switched off for this title. Open the Engine Room"
    : blocked
      ? `${blocked} agent${blocked === 1 ? "" : "s"} blocked. Open the Engine Room`
      : working
        ? `${working} agent${working === 1 ? "" : "s"} working. Open the Engine Room`
        : "On shift, nothing running. Open the Engine Room";

  const href = `/s/${site.slug}/engine-room`;
  const active = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`engine-pill site-util${active ? " is-active" : ""}`}
      title={title}
      aria-current={active ? "page" : undefined}
    >
      <span
        aria-hidden="true"
        className="engine-pill-dot"
        style={{
          background: COLOURS[tone],
          opacity: tone === "off" ? 0.45 : 1,
          animation:
            tone === "green" || tone === "red" ? "erBlink 1.4s ease-in-out infinite" : "none",
        }}
      />
      {label}
    </Link>
  );
}
