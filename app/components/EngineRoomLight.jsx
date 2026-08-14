"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActiveSite } from "./FleetContext";

// Nav item with a live status light: green and blinking while any agent is
// mid-run, amber when the team is on shift but idle, red when something is
// blocked, and dim when the engine is off.
//
// This used to be a server component that queried the agent table directly.
// It now sits inside a client header (so it can build slug-aware links), which
// rules that out, so the counts come from the agents endpoint instead. One
// small request per page load, scoped to the title being viewed.

const COLOURS = { red: "#dc2626", green: "#059669", amber: "#d97706", off: "#5b6884" };

export default function EngineRoomLight() {
  const site = useActiveSite();
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

  const title = !site.engineEnabled
    ? "Engine switched off for this title"
    : blocked
      ? `${blocked} agent${blocked === 1 ? "" : "s"} blocked`
      : working
        ? `${working} agent${working === 1 ? "" : "s"} working`
        : "On shift, nothing running";

  return (
    <Link
      href={`/s/${site.slug}/engine-room`}
      className="nav-link"
      title={title}
      style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
    >
      Engine Room
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: COLOURS[tone],
          opacity: tone === "off" ? 0.45 : 1,
          animation:
            tone === "green" || tone === "red" ? "erBlink 1.4s ease-in-out infinite" : "none",
        }}
      />
      <span
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
      >
        {title}
      </span>
    </Link>
  );
}
