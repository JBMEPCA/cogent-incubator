"use client";

import { Figure, deskAnchorX } from "./OfficeRoom";

// Walkways between the rooms, drawn as a run of separate stepped slabs rather
// than a continuous deck, and the agents who travel along them.
//
// Routes mirror how the team actually works, and travellers are driven by the
// real message bus: a figure crossing a walkway means that message was genuinely
// sent, not that an animation happened to fire.
//
// Two rules hold everything else together:
//   1. There are seven figures on this campus and no more. A figure crossing a
//      walkway IS the agent, who has left its room to make the trip, so every
//      journey is a round trip that starts and ends at its own room.
//   2. Nothing walks on the open floor. Every path is stitched out of real
//      walkways, detouring through whatever rooms the network requires.

// Neighbours only. A crossing that spans the whole map passes underneath the
// rooms in between and is simply hidden by them, which is why the far corners
// looked unconnected. Linking adjacent platforms gives a campus you can read as
// a walkable network, and the reference does exactly this.
export const ROUTES = [
  ["researcher", "director"],
  ["director", "designer"],
  ["director", "editor"],
  ["researcher", "editor"],
  ["editor", "designer"],
  ["researcher", "seo"],
  ["editor", "finance"],
  ["designer", "linkedin"],
  ["seo", "finance"],
  ["finance", "linkedin"],
  ["seo", "backlink"],
  ["backlink", "finance"],
  ["finance", "newsletter"],
  ["linkedin", "newsletter"],
];

export const routeKey = (a, b) => `${a}~${b}`;

// The campus as a graph. These edges are the only ways to get anywhere.
export const NEIGHBOURS = ROUTES.reduce((m, [a, b]) => {
  (m[a] = m[a] || []).push(b);
  (m[b] = m[b] || []).push(a);
  return m;
}, {});

// Shortest walk from one room to another over real walkways, as the full list
// of rooms passed through including both ends. Returns null when the network
// cannot serve the trip, in which case the journey simply does not happen —
// nobody is allowed to cut across the open floor to make it work.
export function walkBetween(from, to) {
  if (from === to || !NEIGHBOURS[from] || !NEIGHBOURS[to]) return null;
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (at === to) break;
    for (const next of NEIGHBOURS[at]) {
      if (next in prev) continue;
      prev[next] = at;
      queue.push(next);
    }
  }
  if (!(to in prev)) return null;
  const stops = [];
  for (let k = to; k; k = prev[k]) stops.unshift(k);
  return stops;
}

// Stitch a wish list of destinations into one continuous walk, inserting
// whatever intermediate rooms the walkways require. Built this way, a patrol
// stays legal even if the routes are rearranged later, rather than quietly
// striking out across the grass.
export function tour(stops) {
  const out = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const leg = walkBetween(out[out.length - 1], stops[i]);
    if (!leg) return null;
    out.push(...leg.slice(1));
  }
  return out;
}

// Straight runs, centre to centre, which is exactly where the crossing bars are
// laid. The reference crossings are dead straight between platforms; curving
// them was what stopped them reading as steps.
export function pathThrough(seats, stops) {
  return stops.map((k, i) => `${i ? "L" : "M"} ${seats[k].cx} ${seats[k].cy}`).join(" ");
}

// A crossing: a handful of chunky white bars laid square across the run, evenly
// spaced with clear gaps, each with real thickness. Wide and flat, like a zebra
// crossing seen in isometric, not thin treads hugging a curve.
export function Walkway({ from, to }) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Where the run leaves each platform. A room is the diamond |x/w| + |y/d| = 1,
  // so the distance from its centre to its edge along (ux, uy) is exactly
  // 1 / (|ux|/w + |uy|/d). Approximating this by projecting w and d separately
  // overshoots badly on diagonal runs and swallows the whole span.
  const edge = (r) => 1 / (Math.abs(ux) / r.w + Math.abs(uy) / r.d);
  // Leave a clear gap at each end. Tucking the bars onto the platform lip made
  // them look like debris lying on the floor rather than a crossing between.
  const start = edge(from) + 5;
  const end = len - edge(to) - 5;
  const span = end - start;
  if (span < 30) return null;

  // Bar geometry: wide across the walk, shallow along it, with a gap of about
  // the same depth between each.
  const HALF_W = 21; // across the direction of travel
  const DEPTH = 5.5; // along it
  const H = 5; // thickness
  const PITCH = DEPTH * 2 + 9;
  const count = Math.max(3, Math.min(7, Math.floor(span / PITCH)));
  const usable = (count - 1) * PITCH;
  const first = start + (span - usable) / 2;

  // Across-vector, flattened vertically so the bars lie in the isometric plane.
  const ax = -uy * HALF_W;
  const ay = ux * HALF_W * 0.56;
  const bx = ux * DEPTH;
  const by = uy * DEPTH;

  const bars = [];
  for (let i = 0; i < count; i++) {
    const t = first + i * PITCH;
    const x = from.cx + ux * t;
    const y = from.cy + uy * t;
    bars.push({
      key: i,
      top: `${x - ax - bx},${y - ay - by} ${x + ax - bx},${y + ay - by} ${x + ax + bx},${y + ay + by} ${x - ax + bx},${y - ay + by}`,
      front: `${x - ax + bx},${y - ay + by} ${x + ax + bx},${y + ay + by} ${x + ax + bx},${y + ay + by + H} ${x - ax + bx},${y - ay + by + H}`,
      side: `${x + ax - bx},${y + ay - by} ${x + ax + bx},${y + ay + by} ${x + ax + bx},${y + ay + by + H} ${x + ax - bx},${y + ay - by + H}`,
    });
  }

  return (
    <g>
      {bars.map((b) => (
        <g key={b.key}>
          <polygon points={b.front} fill="#c7d5ea" />
          <polygon points={b.side} fill="#b6c6e0" />
          <polygon points={b.top} fill="#ffffff" />
        </g>
      ))}
    </g>
  );
}

// Where two agents stand to talk. The visitor stops short of the host's desk,
// just inside the room on the side the walkway arrives from, and the host waits
// a couple of paces further in — so they end up opposite each other with a gap
// between, which is what makes it read as a conversation rather than a collision.
export function meetSpots(seats, fromKey, toKey) {
  const a = seats[fromKey];
  const b = seats[toKey];
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Distance from the host room's centre to its edge along the approach, and
  // the point just inside the room where they meet.
  const r = 1 / (Math.abs(ux) / b.w + Math.abs(uy) / b.d);
  const mx = b.cx + ux * r * 0.45;
  const my = b.cy + uy * r * 0.45;
  // Separated across the screen, not along the approach. Spaced along it they
  // stand one directly behind the other, and since a figure is 40px tall and a
  // conversational gap is about 24, the nearer one simply hides the other.
  // The visitor keeps to the side their own room is on. The small difference in
  // y puts the visitor a step nearer the viewer, which matches the draw order:
  // rooms first, then whoever is out on the walkways.
  const s = ux >= 0 ? 1 : -1;
  return {
    visitor: { x: mx + 15 * s, y: my + 3 },
    host: { x: mx - 15 * s, y: my - 3 },
  };
}

// The visitor's round trip: out along the walkways, but stopping at the meeting
// spot rather than walking into the middle of somebody else's room, then back
// the way they came.
export function visitPath(seats, stops) {
  const spot = meetSpots(seats, stops[stops.length - 2], stops[stops.length - 1]).visitor;
  const out = stops.slice(0, -1).map((k) => [seats[k].cx, seats[k].cy]);
  out.push([spot.x, spot.y]);
  const full = [...out, ...out.slice(0, -1).reverse()];
  return full.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
}

// The dog's round: every room, anticlockwise. Run through tour() so each leg is
// a real walkway.
const DOG_ROUND = tour(["director", "researcher", "seo", "finance", "linkedin", "designer", "editor", "director"]);

// The office dog. Wanders the whole campus on a long slow loop and ends up back
// at its bed in the Director's room. Deliberately much slower than the agents,
// and it stops for a good while at each end.
export function Dog({ seats, asleep }) {
  // The dog's bed, in the Director's room, positioned off the same desk anchor
  // the room itself uses so the two cannot drift apart.
  const bedX = deskAnchorX(seats.director, "director") - 34;
  const bedY = seats.director.cy - 2 + 32;

  // Bed to the middle of the Director's room, then the circuit, then home. The
  // legs run centre to centre because that is where the crossing bars are: the
  // old version offset every stop by 24px and joined rooms with no walkway
  // between them, so the dog trotted off across the open floor.
  const d = `M ${bedX} ${bedY} ` + pathThrough(seats, DOG_ROUND).replace(/^M /, "L ") + ` L ${bedX} ${bedY}`;

  // Overnight the dog is curled up in its bed rather than absent. Gating the
  // whole component on being awake is why it vanished entirely at night.
  const roaming = !asleep;

  return (
    <g
      className={roaming ? "dog" : undefined}
      style={
        roaming
          ? { offsetPath: `path("${d}")`, animation: "dogWalk 150s ease-in-out infinite", offsetRotate: "0deg" }
          : { transform: `translate(${bedX}px, ${bedY}px)` }
      }
    >
      {!roaming && (
        <g className="zzz">
          <text x="6" y="-14" fontSize="9" fontWeight="700" fill="#5f6f90">z</text>
          <text x="13" y="-21" fontSize="7" fontWeight="700" fill="#5f6f90" opacity="0.7">z</text>
        </g>
      )}
      <g className={roaming ? "dog-bob" : undefined}>
        <ellipse cx="0" cy="7" rx="9" ry="3" fill="#0b1020" opacity="0.16" />
        {/* legs */}
        {[-5, -1.5, 2, 5.5].map((lx, i) => (
          <rect key={i} x={lx} y="0" width="1.8" height="6" rx="0.9" fill="#7c6549" />
        ))}
        {/* body */}
        <ellipse cx="0" cy="-2" rx="8.5" ry="4.6" fill="#a98559" />
        <ellipse cx="-1" cy="-3.2" rx="6.5" ry="3" fill="#c19b6c" opacity="0.85" />
        {/* tail */}
        <path className={roaming ? "dog-tail" : undefined} d="M 8 -4 q 5 -2 4 -7" fill="none" stroke="#a98559" strokeWidth="2" strokeLinecap="round" />
        {/* head */}
        <circle cx="-8.5" cy="-6.5" r="4.4" fill="#b89163" />
        <ellipse cx="-11.5" cy="-5.5" rx="2.4" ry="1.7" fill="#8f6f4a" />
        <circle cx="-12.6" cy="-6.2" r="0.9" fill="#3a2c1e" />
        {/* ears */}
        <path d="M -10.5 -10 q -1.5 -4 1.5 -4.5 q 1 2.5 0 4.5" fill="#8f6f4a" />
        <path d="M -6.5 -10.2 q 1.5 -4 -1.5 -4.5 q -1 2.5 0 4.5" fill="#8f6f4a" />
      </g>
    </g>
  );
}

// An agent out on the campus. This is the same figure that stands in the room,
// not a stand-in drawn alongside it: whoever is rendered here is absent from
// their room for the whole animation, which is why the trip is a round one.
export function Commuter({ d, accent, who, dur, delay = 0, carrying, say }) {
  return (
    <g
      className="commuter"
      style={{
        offsetPath: `path("${d}")`,
        animation: `commute ${dur}s ease-in-out ${delay}s infinite`,
        offsetRotate: "0deg",
      }}
    >
      <Figure accent={accent} who={who} walking say={say} />
      {/* The handover, carried in step with the body rather than floating
          alongside it. */}
      {carrying && (
        <g className="fig-bob">
          <rect x="10" y="2" width="7" height="9" rx="1" fill="#ffffff" stroke="#93a4c2" strokeWidth="0.9" />
        </g>
      )}
    </g>
  );
}
