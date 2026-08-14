"use client";

import { useCallback, useEffect, useState } from "react";
import OfficeRoom, { STATE_COLOUR } from "./OfficeRoom";
import { Walkway, Commuter, Dog, ROUTES, routeKey, walkBetween, visitPath, meetSpots } from "./Walkways";

// Seven rooms in three columns, the centre pair dropped lower so the grid reads
// as an isometric floor rather than a spreadsheet. Rows are ~230px apart
// because each caption sits 50px below its slab and would otherwise be sliced
// by the room beneath.
const SEATS = {
  director:   { cx: 550, cy: 168, w: 232, d: 116, label: "Director",          sub: "Everything routes here" },
  researcher: { cx: 190, cy: 360, w: 165, d: 82, label: "Researcher",        sub: "Finds the openings" },
  editor:     { cx: 550, cy: 452, w: 165, d: 82, label: "Editor",            sub: "Writes and subedits" },
  designer:   { cx: 910, cy: 360, w: 165, d: 82, label: "Graphic Designer",  sub: "Picks the imagery" },
  seo:        { cx: 190, cy: 650, w: 165, d: 82, label: "SEO Expert",        sub: "Wins the rankings" },
  finance:    { cx: 550, cy: 720, w: 165, d: 82, label: "Finance Manager",   sub: "Watches the spend" },
  linkedin:   { cx: 910, cy: 650, w: 165, d: 82, label: "LinkedIn Manager",  sub: "Posts the best stories" },
  // Fourth row. Both of these existed in the registry but had no seat here, so
  // they were running with nowhere to be drawn: this map is the floor plan, not
  // lib/agents/registry.js. Add a seat here whenever you add an agent there.
  backlink:   { cx: 190, cy: 940, w: 165, d: 82, label: "Backlink Manager",  sub: "Turns mentions into links" },
  newsletter: { cx: 910, cy: 940, w: 165, d: 82, label: "Newsletter Manager", sub: "Picks the week's ten" },
};

// Tall enough for the fourth row plus its captions, which sit 50px below.
const VIEWBOX = "0 0 1100 1090";
const ORDER = ["director", "researcher", "editor", "designer", "seo", "finance", "linkedin", "backlink", "newsletter"];

const STATE_LABEL = { idle: "Idle", working: "Working", blocked: "Blocked", reporting: "Reporting", asleep: "Asleep" };

// Being out of bed means working. Anything else and the agent turns in, so a
// glance at the floor tells you whether the engine is actually running: it used
// to show seven figures pacing their rooms while all seven were idle, which
// read as a busy office and flatly contradicted the "0 working" tile above it.
// Blocked counts as up. It needs looking at, and tucking it into bed is exactly
// how it would get missed.
const AWAKE_STATES = new Set(["working", "blocked", "reporting"]);

// Two agents mid-conversation are both up. The bus keeps its last 25 messages
// for hours though, so only fresh traffic counts -- otherwise one breakfast
// exchange had the team milling about the campus until the evening.
const MEETING_WINDOW_MS = 15 * 60 * 1000;

// Same window as lib/agents/hours.js, evaluated in the browser so the rooms go
// dark at 8pm without waiting for a server round trip.
function offShift() {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }).format(new Date())
  );
  return h < 7 || h >= 20;
}

function timeAgo(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AgentOffice() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("director");
  const [error, setError] = useState(null);
  const [waking, setWaking] = useState(null);
  const [asleep, setAsleep] = useState(false);
  // Clock ticked by the poll rather than read during render, so deciding which
  // messages are still live stays a pure function of state. 0 until the first
  // effect runs, which simply means no meetings on the very first paint.
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    setAsleep(offShift());
    setNow(Date.now());
    const t = setInterval(() => {
      load();
      setAsleep(offShift());
      setNow(Date.now());
    }, 6000);
    return () => clearInterval(t);
  }, [load]);

  const wake = async (key) => {
    setWaking(key);
    try {
      await fetch(`/api/agents/wake?agent=${key}`, { method: "POST" });
    } catch {}
    setWaking(null);
    load();
  };

  const byKey = Object.fromEntries((data?.agents || []).map((a) => [a.key, a]));
  const active = byKey[selected];

  // Meetings. A message on the bus is two agents talking, so it is drawn as
  // two: the sender walks over and the recipient waits in their own room to
  // receive them, and they stand face to face while the bubbles go back and
  // forth. Nobody takes part in two meetings at once, which is what keeps the
  // count at seven figures no matter how busy the bus is.
  const accentOf = (k) => byKey[k]?.meta?.accent || "#2E3EEE";
  const meetings = [];
  const engaged = new Set();

  const arrange = (from, to, kind) => {
    if (from === to || engaged.has(from) || engaged.has(to)) return false;
    if (!SEATS[from] || !SEATS[to]) return false;
    const stops = walkBetween(from, to);
    if (!stops) return false;
    engaged.add(from);
    engaged.add(to);
    meetings.push({
      from,
      to,
      stops,
      carrying: kind === "request",
      // Paced by distance so a long detour does not become a sprint.
      dur: 15 * (stops.length - 1) + 14,
      delay: meetings.length * 3.4,
    });
    return true;
  };

  // Only live traffic puts anyone on the walkways. The Director used to patrol
  // to whoever had run most recently even with nothing to say, which kept a
  // figure walking the campus around the clock and made an idle engine look busy.
  const fresh = (data?.messages || []).filter(
    (m) => now - new Date(m.createdAt).getTime() < MEETING_WINDOW_MS
  );
  if (!asleep && fresh.length) {
    const dirMsg = fresh.find((m) => m.fromKey === "director" && SEATS[m.toKey]);
    if (dirMsg) arrange("director", dirMsg.toKey, dirMsg.kind);
    // Three at a time. Beyond that the campus is too busy to read.
    for (const m of fresh) {
      if (meetings.length >= 3) break;
      arrange(m.fromKey, m.toKey, m.kind);
    }
  }

  const visiting = {};
  const hosting = {};
  for (const mt of meetings) {
    visiting[mt.from] = mt;
    hosting[mt.to] = mt;
  }

  // Up only if there is a reason to be up: mid-run, blocked, or in a meeting.
  // Everyone else is in bed, on shift or not.
  const isAsleep = (k) =>
    !AWAKE_STATES.has(byKey[k]?.state) && !visiting[k] && !hosting[k];

  return (
    <div className="agent-office">
      <style>{`
        /* The office defines the row height. The detail panel is often taller
           (recent work, team traffic), and if it drives the row it leaves a
           large dead space under the rooms, so it is taken out of flow and
           scrolls within the office's height instead. */
        .agent-office { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 18px; align-items: stretch; }
        .panel-col { position: relative; min-height: 420px; }
        .agent-panel { position: absolute; inset: 0; overflow-y: auto; }

        @media (max-width: 1100px) {
          .agent-office { grid-template-columns: 1fr; }
          /* Stacked on narrow screens, so let the panel size itself again. */
          .panel-col { position: static; min-height: 0; }
          .agent-panel { position: static; max-height: none; }
        }

        .iso-wrap {
          background: linear-gradient(160deg, #eaf3ff 0%, #dbe9fb 55%, #cfe2fa 100%);
          border-radius: 16px; overflow: hidden; position: relative;
        }
        .iso-wrap.night { background: linear-gradient(160deg,#d7e2f4 0%,#c6d5ec 55%,#b8cbe6 100%); }

        .room { cursor: pointer; transition: transform .35s cubic-bezier(.2,.8,.3,1); }
        /* Mouse users should never see the focus box, but keyboard users must
           still be able to tell where they are. */
        .room:focus { outline: none; }
        .room:focus-visible > .room-plate { stroke-width: 4; }
        .room:hover { transform: translateY(-8px); }
        .room.selected { transform: translateY(-10px); }

        /* Four float phases so neighbouring rooms never bob in unison. */
        .float-0 { animation: bob 6.5s ease-in-out infinite; }
        .float-1 { animation: bob 7.8s ease-in-out infinite .9s; }
        .float-2 { animation: bob 5.9s ease-in-out infinite 1.7s; }
        .float-3 { animation: bob 8.4s ease-in-out infinite 2.4s; }
        @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }

        /* Six wander paths. Each agent roams its own room in its own shape. */
        .wander-0 { animation: w0 17s ease-in-out infinite; }
        .wander-1 { animation: w1 21s ease-in-out infinite; }
        .wander-2 { animation: w2 15s ease-in-out infinite; }
        .wander-3 { animation: w3 24s ease-in-out infinite; }
        .wander-4 { animation: w4 19s ease-in-out infinite; }
        .wander-5 { animation: w5 13s ease-in-out infinite; }
        @keyframes w0 { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-46px,16px)} 45%{transform:translate(-14px,30px)} 70%{transform:translate(44px,8px)} }
        @keyframes w1 { 0%,100%{transform:translate(0,0)} 30%{transform:translate(40px,-10px)} 55%{transform:translate(6px,26px)} 80%{transform:translate(-40px,10px)} }
        @keyframes w2 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-30px,-8px)} 50%{transform:translate(22px,22px)} 75%{transform:translate(48px,-4px)} }
        @keyframes w3 { 0%,100%{transform:translate(0,0)} 18%{transform:translate(52px,6px)} 42%{transform:translate(10px,-14px)} 66%{transform:translate(-44px,18px)} 88%{transform:translate(-8px,28px)} }
        @keyframes w4 { 0%,100%{transform:translate(0,0)} 35%{transform:translate(-52px,4px)} 60%{transform:translate(-10px,-16px)} 85%{transform:translate(36px,20px)} }
        @keyframes w5 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(26px,26px)} 70%{transform:translate(-34px,-6px)} }
        .at-desk { animation: none; }

        .fig-bob { animation: step 1.15s ease-in-out infinite; }
        @keyframes step { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }

        /* Walking. One stride is .62s and the body rises twice per stride, once
           over each leg, which is what stops it looking like a hover. The limbs
           come in opposing pairs, so two keyframe sets drive all four.
           A walking figure carries both .fig-bob and .walk; this rule must stay
           below .fig-bob, since they set the same shorthand at equal weight and
           source order is what lets the stride replace the idle bob. */
        .walk { animation: stride .31s ease-in-out infinite; }
        @keyframes stride { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.6px) } }
        .walk .limb-a { animation: swingFwd .62s ease-in-out infinite; }
        .walk .limb-b { animation: swingBack .62s ease-in-out infinite; }
        @keyframes swingFwd {
          0%,100% { transform: translate(2.6px,-1.3px) }
          25%     { transform: translate(0,-2.2px) }
          50%     { transform: translate(-2.6px,0) }
          75%     { transform: translate(0,0) }
        }
        @keyframes swingBack {
          0%,100% { transform: translate(-2.6px,0) }
          25%     { transform: translate(0,0) }
          50%     { transform: translate(2.6px,-1.3px) }
          75%     { transform: translate(0,-2.2px) }
        }
        /* Arms swing against the leg on their own side, at half the throw. */
        .walk .swing-a { animation: swingArmA .62s ease-in-out infinite; }
        .walk .swing-b { animation: swingArmB .62s ease-in-out infinite; }
        @keyframes swingArmA { 0%,100% { transform: translate(-1.3px,0) } 50% { transform: translate(1.3px,0) } }
        @keyframes swingArmB { 0%,100% { transform: translate(1.3px,0) } 50% { transform: translate(-1.3px,0) } }

        /* Talking. Both bubbles run on their meeting's own timeline, so the
           visitor speaks as they arrive and the host answers, and the two are
           in step because they share a duration and a delay. */
        .say-visitor, .say-host {
          opacity: 0;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .say-visitor { animation-name: sayVisitor; }
        .say-host { animation-name: sayHost; }
        @keyframes sayVisitor { 0%,43% { opacity:0 } 45%,49% { opacity:1 } 51%,100% { opacity:0 } }
        @keyframes sayHost { 0%,49% { opacity:0 } 51%,55% { opacity:1 } 57%,100% { opacity:0 } }

        /* Sleeping: the blanket breathes and the z's drift up. */
        .blanket { animation: breathe 4.2s ease-in-out infinite; }
        @keyframes breathe { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.09) } }
        .zzz { animation: drift 3.6s ease-in-out infinite; }
        @keyframes drift { 0% { opacity:0; transform: translate(0,4px) } 35% { opacity:1 } 100% { opacity:0; transform: translate(6px,-14px) } }

        .scr-on { animation: flicker 2.7s ease-in-out infinite; }
        @keyframes flicker { 0%,100% { opacity:.72 } 40% { opacity:1 } 70% { opacity:.84 } }

        .plant { animation: sway 6.2s ease-in-out infinite; }
        @keyframes sway { 0%,100% { transform: rotate(-2.5deg) } 50% { transform: rotate(2.5deg) } }

        /* Walking the campus. An agent out on a trip is a round trip: away,
           a pause at the far end, then back to its own room. It never fades in
           or out, because fading a body in and out of existence is exactly what
           made the walkers read as extra characters rather than the team. */
        @keyframes commute {
          0%   { offset-distance: 0% }
          9%   { offset-distance: 0% }
          43%  { offset-distance: 50% }
          57%  { offset-distance: 50% }
          91%  { offset-distance: 100% }
          100% { offset-distance: 100% }
        }
        .commuter { offset-rotate: 0deg; }

        .scr-glow { animation: scrGlow 3.4s ease-in-out infinite; }
        @keyframes scrGlow { 0%,100% { opacity:.10 } 50% { opacity:.26 } }

        @keyframes dogWalk {
          0%   { offset-distance: 0% }
          8%   { offset-distance: 0% }
          92%  { offset-distance: 100% }
          100% { offset-distance: 100% }
        }
        .dog { offset-rotate: 0deg; }
        .dog-bob { animation: dogStep 1.1s ease-in-out infinite; }
        @keyframes dogStep { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.4px) } }
        .dog-tail { animation: wag .7s ease-in-out infinite; transform-origin: 8px -4px; }
        @keyframes wag { 0%,100% { transform: rotate(-14deg) } 50% { transform: rotate(16deg) } }

        .lit { animation: lit 1.9s ease-in-out infinite; }
        @keyframes lit { 0%,100% { opacity:.12 } 50% { opacity:.32 } }
        .lit-bad { animation: litBad 1.1s ease-in-out infinite; }
        @keyframes litBad { 0%,100% { opacity:.13 } 50% { opacity:.36 } }

        .room-label { font-weight: 700; font-size: 15px; fill: #101a33; }
        .room-sub { font-size: 11.5px; fill: #5b6884; }

        @media (prefers-reduced-motion: reduce) {
          .room, .float-0, .float-1, .float-2, .float-3,
          [class^="wander-"], .fig-bob, .blanket, .zzz, .scr-on, .plant, .lit, .lit-bad,
          .commuter, .scr-glow, .dog, .dog-bob, .dog-tail,
          .walk, .walk .limb-a, .walk .limb-b, .walk .swing-a, .walk .swing-b { animation: none !important; }
          /* No motion means no meeting to caption, so the bubbles stay down. */
          .say-visitor, .say-host { animation: none !important; opacity: 0 }
        }

        .agent-panel { background: var(--surface, #10182b); border-radius: 14px; padding: 16px; border: 1px solid rgba(255,255,255,.07); }
        .agent-chip { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700;
          text-transform:uppercase; letter-spacing:.06em; padding:3px 9px; border-radius:999px; }
        .agent-row { padding:9px 0; border-bottom:1px solid rgba(255,255,255,.06); font-size:13px; }
        .agent-row:last-child { border-bottom:0; }
        .agent-btn { width:100%; padding:9px; border-radius:9px; border:1px solid rgba(255,255,255,.14);
          background:rgba(255,255,255,.05); color:inherit; font-weight:600; font-size:13px; cursor:pointer; }
        .agent-btn:hover { background:rgba(255,255,255,.10); }
        .agent-btn:disabled { opacity:.5; cursor:default; }
      `}</style>

      <div className={`iso-wrap${asleep ? " night" : ""}`}>
        <svg viewBox={VIEWBOX} width="100%" role="img" aria-label="AI agent office floor plan">
          <defs>
            <filter id="isoShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#1c2e5a" floodOpacity="0.20" />
            </filter>
            <linearGradient id="grad-slab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#eef4ff" />
            </linearGradient>
          </defs>

          {/* Stepped walkways connecting the campus. */}
          {ROUTES.map(([a, b]) => (
            <Walkway key={routeKey(a, b)} from={SEATS[a]} to={SEATS[b]} />
          ))}

          {ORDER.map((key, i) => {
            const host = hosting[key];
            return (
              <OfficeRoom
                key={key}
                seat={SEATS[key]}
                agent={byKey[key] ? { ...byKey[key], key } : { key }}
                index={i}
                selected={selected === key}
                asleep={isAsleep(key)}
                away={!!visiting[key]}
                waitAt={host && meetSpots(SEATS, host.from, host.to).host}
                say={host && { role: "host", dur: host.dur, delay: host.delay }}
                onSelect={setSelected}
              />
            );
          })}

          {/* Anyone out on the walkways is drawn last so they stay on top of
              the rooms they pass through. Drawn before them, a walker vanished
              behind the platform at each end of the trip. */}
          {meetings.map((mt) => (
            <Commuter
              key={mt.from}
              d={visitPath(SEATS, mt.stops)}
              accent={accentOf(mt.from)}
              who={mt.from}
              dur={mt.dur}
              delay={mt.delay}
              carrying={mt.carrying}
              say={{ role: "visitor", dur: mt.dur, delay: mt.delay }}
            />
          ))}
          <Dog seats={SEATS} asleep={asleep} />
        </svg>

        {error && (
          <div style={{ position: "absolute", top: 12, left: 12, background: "#dc2626", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12 }}>
            Live state unavailable: {error}
          </div>
        )}
      </div>

      <div className="panel-col">
      <div className="agent-panel">
        {!active && <p style={{ opacity: 0.7, fontSize: 13 }}>Loading the team…</p>}
        {active && (() => {
          const shown = isAsleep(selected) ? "asleep" : active.state;
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: active.meta?.accent }} />
                <h3 style={{ margin: 0, fontSize: 17 }}>{active.name}</h3>
              </div>
              <span className="agent-chip" style={{ background: `${STATE_COLOUR[shown]}22`, color: STATE_COLOUR[shown] }}>
                {STATE_LABEL[shown]}
              </span>

              <p style={{ fontSize: 12.5, opacity: 0.75, margin: "12px 0 0", lineHeight: 1.5 }}>{active.goal}</p>

              <div style={{ marginTop: 14, padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55, marginBottom: 5 }}>Right now</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                  {shown === "asleep"
                    ? asleep
                      ? "Asleep. The team works 7:00 to 20:00 UK."
                      : "In bed. Nothing queued, so it sleeps until there is work."
                    : shown === "working"
                      ? active.detail || active.currentTask || "Working"
                      : shown === "blocked"
                        ? active.detail || "Blocked, waiting on the Director"
                        : active.detail || "Nothing queued"}
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6 }}>Last active {timeAgo(active.lastRunAt)}</div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 12 }}>
                <div style={{ flex: 1, padding: 9, borderRadius: 9, background: "rgba(255,255,255,.04)" }}>
                  <div style={{ opacity: 0.55 }}>Runs, 7d</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{active.weekRuns}</div>
                </div>
                <div style={{ flex: 1, padding: 9, borderRadius: 9, background: "rgba(255,255,255,.04)" }}>
                  <div style={{ opacity: 0.55 }}>Cost, 7d</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>${(active.weekCost || 0).toFixed(2)}</div>
                </div>
              </div>

              <button className="agent-btn" style={{ marginTop: 12 }} disabled={waking === active.key} onClick={() => wake(active.key)}>
                {waking === active.key ? "Waking…" : `Wake ${active.name} now`}
              </button>

              {/* Straight to wherever this agent's output lands. Tinted with its
                  own accent so it reads as belonging to the desk rather than
                  being a second, competing primary action. */}
              {active.meta?.link && (
                <a
                  href={active.meta.link.href}
                  style={{
                    display: "block",
                    marginTop: 8,
                    padding: "9px 12px",
                    borderRadius: 9,
                    textAlign: "center",
                    fontSize: 12.5,
                    fontWeight: 600,
                    textDecoration: "none",
                    color: active.meta.accent,
                    border: `1px solid ${active.meta.accent}55`,
                    background: `${active.meta.accent}14`,
                  }}
                >
                  {active.meta.link.label} &rsaquo;
                </a>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55, marginBottom: 4 }}>Recent work</div>
                {(active.recent || []).length === 0 && <div style={{ fontSize: 12.5, opacity: 0.5 }}>No runs yet</div>}
                {(active.recent || []).map((r) => (
                  <div key={r.id} className="agent-row">
                    <div style={{ display: "flex", gap: 7 }}>
                      <span style={{ color: r.ok ? "#059669" : "#dc2626", fontWeight: 700 }}>{r.ok ? "✓" : "✕"}</span>
                      <span style={{ flex: 1, lineHeight: 1.4 }}>{r.error || r.summary || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3 }}>
                      {timeAgo(r.startedAt)} · ${Number(r.costUsd || 0).toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>

              {selected === "researcher" && (data?.topics || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55, marginBottom: 4 }}>Topics proposed</div>
                  {data.topics.map((t) => (
                    <div key={t.id} className="agent-row">
                      <div style={{ lineHeight: 1.4 }}>{t.title}</div>
                      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3 }}>
                        {t.source}
                        {t.score != null && ` · score ${t.score}`}
                        {t.impressions != null && ` · ${t.impressions} impressions`}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected === "linkedin" && (
                <a
                  href="/linkedin"
                  className="agent-btn"
                  style={{ display: "block", textAlign: "center", marginTop: 10, textDecoration: "none" }}
                >
                  Review the post queue →
                </a>
              )}

              {selected === "director" && (data?.messages || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55, marginBottom: 4 }}>Team traffic</div>
                  {data.messages.slice(0, 8).map((m) => (
                    <div key={m.id} className="agent-row">
                      <div style={{ fontSize: 11, opacity: 0.5 }}>{m.fromKey} → {m.toKey} · {m.kind}{m.resolved ? " · resolved" : ""}</div>
                      <div style={{ lineHeight: 1.4 }}>{m.subject}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {data?.totals && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)", fontSize: 12, opacity: 0.65 }}>
            Team total, 7 days: <strong>${data.totals.weekCost.toFixed(2)}</strong> over {data.totals.weekRuns} runs
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
