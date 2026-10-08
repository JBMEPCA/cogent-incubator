"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SiteMark from "./SiteMark";

// Every title's engine room on one screen: ten rooms, two rows of five, the
// Director in a glass head office at the top of each and the eight specialists
// on the floor below.
//
// Positions are percentages of the room floor, so one floor plan serves every
// room at every width.

// Room colours are the hub's own, not the titles' brand colours. Three brands
// are blue, three green and three red, which made rooms in the same row
// indistinguishable; each of these sits near its brand where it could. They
// never reach the sites. A title not listed falls back to its accent2Hex.
const ROOM_COLOUR = {
  "smart-sme": "#6c7bff",
  "fleet-magazine": "#fbbf24",
  "golf-resort-magazine": "#2ecc71",
  "barbering-business": "#ff8a3d",
  "airport-business-magazine": "#4fa8ff",
  "gym-business-news": "#ff4757",
  "nursery-daily": "#ff5fa8",
  "senior-lifestyle-business": "#c86bff",
  "dental-business-news": "#22e3d3",
  "smart-farming-news": "#b6e34a",
};

// Desk order on the floor, two rows of four. Add a key here whenever an agent
// is added to lib/agents/registry.js, or it will have nowhere to sit.
const FLOOR = ["researcher", "seo", "editor", "designer", "finance", "linkedin", "backlink", "newsletter"];
const DESKS = [[16, 52], [38, 52], [62, 52], [84, 52], [16, 78], [38, 78], [62, 78], [84, 78]];
const OFFICE = { x: 50, y: 20 };
const DIRECTOR_SEAT = { x: 50, y: 15 };

// Reporting is an agent handing its result up, which on the floor looks the
// same as working: it is busy and at its desk.
const BUSY = new Set(["working", "reporting"]);
const POLL_MS = 20000;

// Same window as lib/agents/hours.js. Out of hours nobody wanders: idle agents
// sit at their desks so the hub does not look busy at midnight.
function offShift() {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }).format(new Date())
  );
  return h < 7 || h >= 20;
}

const rnd = (a, b) => a + Math.random() * (b - a);

function seatOf(key) {
  if (key === "director") return DIRECTOR_SEAT;
  const i = FLOOR.indexOf(key);
  return i < 0 ? { x: 50, y: 60 } : { x: DESKS[i][0], y: DESKS[i][1] - 8 };
}

function wanderPoint(key) {
  return key === "director" ? { x: rnd(36, 64), y: rnd(12, 26) } : { x: rnd(8, 92), y: rnd(38, 92) };
}

function stateOf(agent) {
  if (!agent) return "idle";
  if (BUSY.has(agent.state)) return "working";
  return agent.state === "blocked" ? "blocked" : "idle";
}

function timeAgo(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ukTime(d) {
  return new Date(d).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
}

// Dollars, like the fleet overview. Small sums keep a third decimal place so a
// Haiku agent's day does not read as $0.00 when it cost something.
function usd(v) {
  if (v == null) return "—";
  if (v === 0) return "$0";
  return v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`;
}

function share(part, whole) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

function Fig({ label, value, sub, tone }) {
  return (
    <div className="hub-fig">
      <div className="hub-fig-l">{label}</div>
      <div className="hub-fig-v" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="hub-fig-s">{sub}</div>
    </div>
  );
}

function TwoUp({ label, today, week }) {
  return (
    <div className="hub-two">
      <div className="hub-two-l">{label}</div>
      <div className="hub-two-row">
        <span><b>{today}</b> today</span>
        <span><b>{week}</b> 7d</span>
      </div>
    </div>
  );
}

function Room({ site, colour, selected, onSelect, resting }) {
  const byKey = Object.fromEntries(site.agents.map((a) => [a.key, a]));
  const keys = ["director", ...FLOOR].filter((k) => byKey[k]);
  const working = site.agents.filter((a) => stateOf(a) === "working").length;

  // Where each figure is, and until when it is still walking there.
  const [pos, setPos] = useState(() =>
    Object.fromEntries(keys.map((k) => [k, { ...(stateOf(byKey[k]) === "idle" ? wanderPoint(k) : seatOf(k)), dur: 0, until: 0 }]))
  );
  const [packets, setPackets] = useState([]);
  // Clock ticked by the animation step rather than read during render, so
  // "still walking" stays a pure function of state.
  const [now, setNow] = useState(0);
  const latest = useRef({ byKey, resting });
  useEffect(() => {
    latest.current = { byKey, resting };
  });

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = () => {
      const { byKey: agents, resting: still } = latest.current;
      const now = Date.now();
      setPos((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(agents)) {
          const p = prev[k] || { ...seatOf(k), dur: 0, until: 0 };
          const s = stateOf(agents[k]);
          const goSit = s !== "idle" || still;
          const seat = seatOf(k);
          let target = null;
          if (goSit && (p.x !== seat.x || p.y !== seat.y)) target = seat;
          else if (!goSit && !reduced && now > p.until && Math.random() < 0.25) target = wanderPoint(k);
          if (!target) continue;
          // Busy agents hurry to their desks; idle ones amble.
          const speed = goSit ? 22 : k === "director" ? 6 : 9;
          const dur = reduced ? 0 : Math.max(0.4, Math.hypot(target.x - p.x, (target.y - p.y) * 0.75) / speed);
          next[k] = { ...target, dur, until: now + dur * 1000 };
        }
        return next;
      });
      // A finished report travelling up to head office, from a random busy desk.
      if (!reduced) {
        const busy = FLOOR.filter((k) => stateOf(agents[k]) === "working");
        if (busy.length && Math.random() < 0.35) {
          const from = seatOf(busy[Math.floor(Math.random() * busy.length)]);
          const id = now + Math.random();
          setPackets((ps) => [...ps, { id, ...from }]);
          setTimeout(() => setPackets((ps) => ps.filter((x) => x.id !== id)), 950);
        }
      }
      setNow(now);
    };
    step();
    const t = setInterval(step, 700);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      type="button"
      className={`hub-room${selected ? " is-selected" : ""}`}
      style={{ "--c": colour }}
      onClick={() => onSelect(null)}
      aria-pressed={selected}
      aria-label={`${site.name}: ${working} of ${keys.length} agents working`}
    >
      <span className="hub-plate">
        <SiteMark site={site} size={22} showStatus={false} />
        <span className="hub-name">{site.name}</span>
        <span className="hub-count">
          {working}/{keys.length || 9} working
        </span>
      </span>
      <span className="hub-shell">
        <span className="hub-floor">
          <span className="hub-office" />
          <span className="hub-desk hub-desk-dir" style={{ left: "50%", top: "22%" }} />
          {FLOOR.map((k, i) => {
            const a = byKey[k];
            const p = pos[k];
            const atDesk = p && now >= p.until && p.x === seatOf(k).x && p.y === seatOf(k).y;
            return (
              <span
                key={k}
                className={`hub-desk${stateOf(a) === "working" && atDesk ? " is-busy" : ""}`}
                style={{ left: `${DESKS[i][0]}%`, top: `${DESKS[i][1]}%` }}
              />
            );
          })}
          {packets.map((pk) => (
            <span key={pk.id} className="hub-packet" style={{ "--x0": `${pk.x}%`, "--y0": `${pk.y}%`, "--x1": `${OFFICE.x}%`, "--y1": `${OFFICE.y}%` }} />
          ))}
          {keys.map((k) => {
            const a = byKey[k];
            const p = pos[k] || seatOf(k);
            const s = stateOf(a);
            const walking = now < (p.until || 0);
            const seat = seatOf(k);
            const settled = !walking && p.x === seat.x && p.y === seat.y;
            const cls = [
              "hub-bot",
              k === "director" && "is-director",
              walking && "is-walking",
              s === "working" && settled && "is-working",
              s === "blocked" && "is-blocked",
              s === "idle" && "is-idle",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <span
                key={k}
                className={cls}
                title={`${a.name} · ${s}${a.currentTask ? ` · ${a.currentTask}` : ""}`}
                // A figure sits inside the room's button, so it cannot be a
                // button itself. The team list below carries the keyboard route
                // to the same agent.
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(k);
                }}
                style={{ left: `${p.x}%`, top: `${p.y}%`, transitionDuration: `${p.dur || 0}s`, "--a": k === "director" ? "#ffb000" : a.accent }}
              >
                <span className="hub-bot-body" />
              </span>
            );
          })}
          {!keys.length && <span className="hub-empty">No agents yet</span>}
        </span>
      </span>
    </button>
  );
}

export default function EngineHub() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [agentKey, setAgentKey] = useState(null);
  const [unblocking, setUnblocking] = useState(null);
  const [unblockError, setUnblockError] = useState(null);
  const [resting, setResting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/fleet", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Back on duty now rather than at the hourly recovery. It does not re-run
  // anything; the agent takes its next job on its own schedule.
  const unblock = async (slug, key, id) => {
    setUnblocking(id);
    setUnblockError(null);
    try {
      const res = await fetch(`/api/agents/unblock?site=${encodeURIComponent(slug)}&agent=${key}`, { method: "POST" });
      if (res.status === 403) throw new Error("Your account can view the hub but not change agents.");
      if (!res.ok) throw new Error(`Couldn't unblock it (status ${res.status}). Try again.`);
      await load();
    } catch (e) {
      setUnblockError(e.message);
    }
    setUnblocking(null);
  };

  useEffect(() => {
    load();
    setResting(offShift());
    // One fleet-wide query per tick, and only while someone is looking.
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      load();
      setResting(offShift());
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!data) {
    return (
      <section className="panel hub-loading">
        {error ? `Couldn't load the agents (${error}). Retrying every 20 seconds.` : "Opening the engine rooms…"}
      </section>
    );
  }

  const sites = data.sites;
  const all = sites.flatMap((s) => s.agents);
  const working = all.filter((a) => stateOf(a) === "working").length;
  const blocked = all.filter((a) => a.state === "blocked");
  const runsToday = sites.reduce((n, s) => n + s.runsToday, 0);
  const total = (k) => sites.reduce((n, s) => n + (s.costs?.[k] || 0), 0);
  const spendToday = total("todayUsd");
  const spendWeek = total("weekUsd");
  const publishedToday = total("publishedToday");
  const publishedWeek = total("publishedWeek");
  // Same rule as each room: spend over articles PRODUCED in the window.
  const perArticleToday = total("producedToday") ? spendToday / total("producedToday") : null;
  const perArticleWeek = total("producedWeek") ? spendWeek / total("producedWeek") : null;
  const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
  const colourOf = (s) => ROOM_COLOUR[s.slug] || s.accent2Hex || "#6c7bff";
  const sel = sites.find((s) => s.slug === selected);
  const agent = sel?.agents.find((a) => a.key === agentKey);

  return (
    <>
      <div className="hub-strip">
        <Fig label="Agents" value={all.length} sub={`across ${sites.length} titles`} />
        <Fig label="Working now" value={working} tone={working ? "var(--neon-green)" : undefined} sub={`${all.length - working - blocked.length} idle`} />
        <Fig label="Blocked" value={blocked.length} tone={blocked.length ? "var(--neon-red)" : undefined} sub={blocked.length ? "see Needs you" : "all clear"} />
        <Fig label="Runs today" value={runsToday} sub="since midnight" />
        <Fig label="Spend today" value={usd(spendToday)} sub={`${usd(spendWeek)} in 7 days`} />
        <Fig label="Published today" value={publishedToday} sub={`${publishedWeek} in 7 days`} />
        <Fig label="Cost per article" value={usd(perArticleToday)} sub={`${usd(perArticleWeek)} over 7 days`} />
      </div>
      <ul className="hub-legend">
        <li><i style={{ background: "var(--neon-green)" }} />Working</li>
        <li><i style={{ background: "var(--muted)" }} />Idle</li>
        <li><i style={{ background: "#ff3b4e" }} />Blocked</li>
        <li><i style={{ background: "#ffd45c" }} />Director</li>
        {resting && <li className="hub-offshift">Off shift until 7am</li>}
      </ul>

      <section className="hub-grid">
        {sites.map((s) => (
          <Room
            key={s.id}
            site={s}
            colour={colourOf(s)}
            resting={resting}
            selected={s.slug === selected}
            onSelect={(key) => {
              // A figure opens its agent; the room itself toggles.
              if (key) {
                setSelected(s.slug);
                setAgentKey(key);
              } else {
                setSelected(s.slug === selected ? null : s.slug);
                setAgentKey(null);
              }
            }}
          />
        ))}
      </section>

      <div className="hub-below">
        <section className="panel hub-card">
          {sel ? (
            <>
              <h3 className="hub-card-h">
                <SiteMark site={sel} size={22} showStatus={false} />
                {sel.name}
                <Link href={`/s/${sel.slug}`} className="hub-open">Open title ↗</Link>
              </h3>
              <div className="hub-costs">
                <TwoUp label="AI spend" today={usd(sel.costs.todayUsd)} week={usd(sel.costs.weekUsd)} />
                <TwoUp label="Articles published" today={sel.costs.publishedToday} week={sel.costs.publishedWeek} />
                <TwoUp label="Cost per article" today={usd(sel.costs.perArticleToday)} week={usd(sel.costs.perArticleWeek)} />
              </div>

              {agent && (
                <div className="hub-agent" style={{ "--a": agent.key === "director" ? "#ffb000" : agent.accent }}>
                  <div className="hub-agent-head">
                    <span className={`hub-dot is-${stateOf(agent)}`} />
                    <span className="hub-ag-name">{agent.name}</span>
                    <span className="hub-agent-state">{stateOf(agent)}</span>
                    <button type="button" className="hub-agent-close" onClick={() => setAgentKey(null)} aria-label="Close agent">
                      ×
                    </button>
                  </div>
                  <div className="hub-ag-task">
                    {agent.currentTask || agent.detail || `Last ran ${timeAgo(agent.lastRunAt)}`}
                  </div>
                  <div className="hub-costs hub-costs-agent">
                    <TwoUp label="Cost" today={usd(agent.costs.todayUsd)} week={usd(agent.costs.weekUsd)} />
                    <TwoUp
                      label="Share of title spend"
                      today={share(agent.costs.todayUsd, sel.costs.todayUsd)}
                      week={share(agent.costs.weekUsd, sel.costs.weekUsd)}
                    />
                  </div>
                </div>
              )}

              <div className="hub-roster">
                {["director", ...FLOOR].map((k) => sel.agents.find((a) => a.key === k)).filter(Boolean).map((a) => {
                  const s = stateOf(a);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      className={`hub-ag${a.key === agentKey ? " is-selected" : ""}`}
                      aria-pressed={a.key === agentKey}
                      onClick={() => setAgentKey(a.key === agentKey ? null : a.key)}
                    >
                      <span className={`hub-dot is-${s}`} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="hub-ag-name">{a.name}</div>
                        <div className="hub-ag-task">
                          {a.currentTask || (s === "idle" ? `Idle · last ran ${timeAgo(a.lastRunAt)}` : a.detail || s)}
                        </div>
                      </div>
                      <span className="hub-ag-cost" title="Last 7 days">{usd(a.costs.weekUsd)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h3 className="hub-card-h">Title detail</h3>
              <p className="hub-quiet">Click a room to see its team, spend and cost per article. Click an agent for its own costs.</p>
            </>
          )}
        </section>

        <section className="panel hub-card">
          <h3 className="hub-card-h">Latest across the fleet</h3>
          <ol className="hub-feed">
            {data.recent.map((r) => {
              const s = siteById[r.siteId];
              const agent = s?.agents.find((a) => a.key === r.agentKey);
              return (
                <li key={r.id}>
                  <span className="hub-feed-tm">{ukTime(r.startedAt)}</span>
                  <span className="hub-feed-tx">
                    <b style={{ color: s ? colourOf(s) : undefined }}>{s?.name || "Unknown title"}</b> · {agent?.name || r.agentKey}
                    {r.ok ? " " : " failed: "}
                    {r.summary}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="panel hub-card hub-needs">
        <h3 className="hub-card-h">
          Needs you
          {blocked.length > 0 && <span className="hub-needs-n">{blocked.length}</span>}
        </h3>
        {blocked.length ? (
          <>
          <div className="hub-needs-list">
            {blocked.map((a) => {
              const site = siteById[a.siteId];
              const id = `${a.siteId}-${a.key}`;
              const info = a.block;
              return (
                <div key={id} className="hub-need">
                  <span className="hub-dot is-blocked" />
                  <button
                    type="button"
                    className="hub-need-main"
                    onClick={() => {
                      setSelected(site?.slug);
                      setAgentKey(a.key);
                    }}
                  >
                    <span className="hub-ag-name">{site?.name} · {a.name}</span>
                    <span className="hub-need-why">{info?.error || a.detail || "Its last run failed"}</span>
                    <span className={`hub-need-when${info?.needsPerson ? " is-stuck" : ""}`}>
                      {info?.needsPerson
                        ? `Failed ${info.streak} runs in a row, so it waits for you`
                        : info?.recoversAt
                          ? `Failed at ${ukTime(info.failedAt)} · back on duty by itself at ${ukTime(info.recoversAt)}`
                          : "Back on duty by itself within the hour"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="hub-unblock"
                    disabled={unblocking === id}
                    onClick={() => unblock(site?.slug, a.key, id)}
                  >
                    {unblocking === id ? "Unblocking…" : "Unblock"}
                  </button>
                </div>
              );
            })}
          </div>
          {unblockError && <p className="hub-need-err">{unblockError}</p>}
          </>
        ) : (
          <p className="hub-quiet">Nothing blocked across the fleet.</p>
        )}
      </section>
    </>
  );
}
