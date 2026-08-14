"use client";

// One agent's room. Every room is a furnished space rather than a desk on a
// slab: a workstation themed to the job, somewhere to sit, somewhere to sleep,
// storage, a lamp, a plant and a bin. The workstation is what changes — the SEO
// Expert runs three monitors, the Editor works on paper and a printer, the
// Finance Manager has a vault, the Designer paints. Screens and lamps glow only
// while that agent is actually working.

const THICK = 16;

// Where a room's workstation sits. The Director's room is half as wide again,
// and at the standard fraction its scene ran off the left edge, so its
// workstation is pulled in towards the middle. Exported because the dog's bed is
// positioned off the Director's desk and the two drifted apart when each side
// carried its own copy of the number.
export const deskAnchorX = (seat, key) => seat.cx - seat.w * (key === "director" ? 0.26 : 0.34);

export function slabPoints({ cx, cy, w, d }) {
  return {
    top: `${cx},${cy - d} ${cx + w},${cy} ${cx},${cy + d} ${cx - w},${cy}`,
    left: `${cx - w},${cy} ${cx},${cy + d} ${cx},${cy + d + THICK} ${cx - w},${cy + THICK}`,
    right: `${cx},${cy + d} ${cx + w},${cy} ${cx + w},${cy + THICK} ${cx},${cy + d + THICK}`,
  };
}

/* ------------------------------------------------------------- primitives */

// Darken a colour for the two side faces, so a solid needs one colour rather
// than three hand-picked ones that drift apart over time.
// Clamped: a k above 1 lightens, and without the clamp a channel over 255
// carries into the next byte and turns a pale blue highlight lime green.
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `#${((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1)}`;
}

// A flat isometric surface: desks, rugs, tabletops.
const Top = ({ x, y, w, d, fill, opacity = 1 }) => (
  <polygon points={`${x},${y - d} ${x + w},${y} ${x},${y + d} ${x - w},${y}`} fill={fill} opacity={opacity} />
);

// A solid with visible thickness and hand-picked faces. The default is a shade
// darker than the slab: at the old value furniture tops were within a couple of
// per cent of the white floor and vanished into it.
function Box({ x, y, w, d, h, top = "#dbe4f6", left = "#c1cee7", right = "#adbcd8" }) {
  return (
    <g>
      <polygon points={`${x - w},${y} ${x},${y + d} ${x},${y + d + h} ${x - w},${y + h}`} fill={left} />
      <polygon points={`${x},${y + d} ${x + w},${y} ${x + w},${y + h} ${x},${y + d + h}`} fill={right} />
      <polygon points={`${x},${y - d} ${x + w},${y} ${x},${y + d} ${x - w},${y}`} fill={top} />
    </g>
  );
}

// The same thing from a single colour. Most furniture wants this.
const Solid = ({ x, y, w, d, h, fill }) => (
  <Box x={x} y={y} w={w} d={d} h={h} top={fill} left={shade(fill, 0.78)} right={shade(fill, 0.62)} />
);

// An upright screen. A monitor genuinely emits light, so the glow here is
// literal rather than decoration, and it only appears when the agent is working.
function Screen({ x, y, w = 20, h = 15, accent, on }) {
  return (
    <g>
      {on && <ellipse cx={x + w / 2} cy={y - h / 2} rx={w * 1.5} ry={h * 1.2} fill={accent} opacity="0.16" className="scr-glow" />}
      <polygon points={`${x},${y} ${x + w},${y + w * 0.5} ${x + w},${y + w * 0.5 - h} ${x},${y - h}`} fill="#39445c" />
      <polygon
        points={`${x + 1.5},${y - 1} ${x + w - 1.5},${y + w * 0.5 - 1.8} ${x + w - 1.5},${y + w * 0.5 - h + 1.5} ${x + 1.5},${y - h + 1.5}`}
        fill={accent}
        opacity={on ? 1 : 0.4}
        className={on ? "scr-on" : ""}
      />
      <polygon points={`${x},${y} ${x},${y - h} ${x - 5},${y - h + 2.5} ${x - 5},${y + 2.5}`} fill="#2d3648" />
    </g>
  );
}

// Framed thing on the wall: charts, artwork, pinboards.
function WallPanel({ x, y, w = 22, h = 16, fill = "#ffffff", accent, children }) {
  return (
    <g>
      <polygon points={`${x},${y} ${x + w},${y + w * 0.5} ${x + w},${y + w * 0.5 - h} ${x},${y - h}`} fill={fill} stroke="#b9c6dd" strokeWidth="0.8" />
      {accent && (
        <polygon
          points={`${x + 3},${y - 3} ${x + w - 3},${y + w * 0.5 - 4.5} ${x + w - 3},${y + w * 0.5 - h + 4} ${x + 3},${y - h + 4}`}
          fill={accent}
          opacity="0.55"
        />
      )}
      {children}
    </g>
  );
}

const Plant = ({ x, y, scale = 1 }) => (
  <g className="plant" style={{ transformOrigin: `${x}px ${y}px` }} transform={scale === 1 ? undefined : `translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}>
    <polygon points={`${x - 6},${y} ${x},${y + 3} ${x + 6},${y} ${x + 5},${y - 9} ${x - 5},${y - 9}`} fill="#b58058" />
    <ellipse cx={x} cy={y - 9} rx="5" ry="2.2" fill="#7d5a3c" />
    <rect x={x - 0.9} y={y - 22} width="1.8" height="13" fill="#3f6b45" />
    <circle cx={x} cy={y - 27} r="6" fill="#4fa05f" />
    <circle cx={x - 6} cy={y - 22} r="4.4" fill="#3f8b51" />
    <circle cx={x + 6} cy={y - 22.5} r="4.2" fill="#59ab68" />
  </g>
);

/* -------------------------------------------------------------- furniture */

// A proper task chair: castor base, gas lift, seat, and a backrest that stands
// on the seat's back edge so it leans into the room rather than floating.
// Sized against the figure — at seat width 22 it dwarfed the person sitting in it.
function TaskChair({ x, y, seat = "#39445c" }) {
  const feet = [
    [10, 5],
    [-10, 5],
    [10, -5],
    [-10, -5],
  ];
  return (
    <g>
      <ellipse cx={x} cy={y} rx="11" ry="5.5" fill="#0b1020" opacity="0.10" />
      {feet.map(([fx, fy], i) => (
        <polygon key={i} points={`${x},${y - 1.8} ${x + fx},${y + fy - 1.8} ${x + fx},${y + fy} ${x},${y}`} fill="#d8e0ee" stroke="#b4c1d8" strokeWidth="0.5" />
      ))}
      <rect x={x - 1.3} y={y - 12} width="2.6" height="10.5" fill="#c2cddf" />
      <Solid x={x} y={y - 14.5} w={8} d={4} h={2.6} fill={seat} />
      <polygon points={`${x - 8},${y - 14.5} ${x},${y - 18.5} ${x},${y - 31} ${x - 8},${y - 27}`} fill={shade(seat, 0.86)} />
      <polygon points={`${x - 8},${y - 27} ${x},${y - 31} ${x + 1.4},${y - 30.3} ${x - 6.6},${y - 26.3}`} fill={shade(seat, 1.3)} />
    </g>
  );
}

// A tucked-in meeting chair. No castors, and small enough to sit round a table
// without reading as a plate on it.
function MeetChair({ x, y, seat = "#8496b5", flip = false }) {
  const s = flip ? -1 : 1;
  return (
    <g>
      <Solid x={x} y={y} w={7} d={3.5} h={2.2} fill={seat} />
      <polygon
        points={`${x - 7 * s},${y} ${x},${y + 3.5} ${x},${y - 8.5} ${x - 7 * s},${y - 12}`}
        fill={shade(seat, 0.9)}
      />
      <rect x={x - 1} y={y + 2} width="1.6" height="6" fill={shade(seat, 0.7)} />
    </g>
  );
}

// Long low sideboard, with a couple of things stood on it.
const Sideboard = ({ x, y, accent }) => (
  <g>
    <Solid x={x} y={y - 15} w={26} d={13} h={15} fill="#c8a97f" />
    {[-13, 0, 13].map((o, i) => (
      <line key={i} x1={x + o - 6} y1={y - 12 + o * 0.5} x2={x + o + 6} y2={y - 6 + o * 0.5} stroke={shade("#c8a97f", 0.72)} strokeWidth="1" />
    ))}
    <Solid x={x - 12} y={y - 21} w={6} d={3} h={6} fill={accent} />
    <ellipse cx={x + 10} cy={y - 18} rx="5" ry="2.4" fill="#dfe7f4" />
    <path d={`M ${x + 10} ${y - 20} q -4 -8 0 -12 q 4 4 0 12`} fill="#5aa06f" />
  </g>
);

const Rug = ({ x, y, w, d, fill, opacity = 0.22 }) => (
  <g>
    <Top x={x} y={y} w={w} d={d} fill={fill} opacity={opacity} />
    <Top x={x} y={y} w={w - 6} d={d - 3} fill="#ffffff" opacity={opacity * 0.5} />
  </g>
);

// Waste bin: tapered, with a visible rim.
const Bin = ({ x, y }) => (
  <g>
    <polygon points={`${x - 7},${y - 13} ${x + 7},${y - 13} ${x + 5},${y - 1} ${x - 5},${y - 1}`} fill="#aebbd2" />
    <ellipse cx={x} cy={y - 1} rx="5" ry="2.5" fill="#93a3bd" />
    <ellipse cx={x} cy={y - 13} rx="7" ry="3.5" fill="#d7e0f0" />
    <ellipse cx={x} cy={y - 13} rx="5" ry="2.4" fill="#8194b2" />
  </g>
);

// Standard lamp. Lit only while the agent is at work, same rule as the screens.
const FloorLamp = ({ x, y, on }) => (
  <g>
    <ellipse cx={x} cy={y} rx="9" ry="4.5" fill="#0b1020" opacity="0.10" />
    <ellipse cx={x} cy={y - 2} rx="9" ry="4.5" fill="#cfd9ea" />
    <rect x={x - 1.3} y={y - 36} width="2.6" height="34" fill="#b3c0d6" />
    {on && <ellipse cx={x} cy={y - 42} rx="21" ry="15" fill="#f6df9d" opacity="0.32" className="scr-glow" />}
    <polygon points={`${x - 11},${y - 36} ${x + 11},${y - 36} ${x + 8},${y - 50} ${x - 8},${y - 50}`} fill={on ? "#f2e3ac" : "#d9cca3"} />
    <ellipse cx={x} cy={y - 36} rx="11" ry="4.4" fill={on ? "#fbf3d2" : "#e6dcbb"} />
    <ellipse cx={x} cy={y - 50} rx="8" ry="3.2" fill="#c4b48c" />
  </g>
);

// Shelving with books on it. Reused by every room and by the Director twice.
function Bookcase({ x, y, w = 16, h = 32, shelves = 3, wood = "#c9a97e" }) {
  return (
    <g>
      <Solid x={x} y={y - h} w={w} d={w / 2} h={h} fill={wood} />
      {Array.from({ length: shelves }, (_, i) => {
        const sy = y - h + 10 + i * ((h - 8) / shelves);
        return (
          <g key={i}>
            <line x1={x - w + 3} y1={sy} x2={x} y2={sy + w / 2 - 1} stroke={shade(wood, 0.66)} strokeWidth="1.3" />
            {[0, 1, 2, 3].map((b) => (
              <rect
                key={b}
                x={x - w + 4 + b * (w / 4.4)}
                y={sy - 7.5 - b * 0.7}
                width={w / 6}
                height="7"
                fill={["#c05a4a", "#4a72c0", "#5aa06f", "#c9a13f"][b]}
                opacity="0.9"
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

// Seating, built from three overlapping solids that share a footprint: a tall
// slab standing on the back half, the cushion in front of it, then an arm at
// each side. Flat quads for the back and floating cubes for the arms read as
// loose parts rather than a chair, and the paint order matters — the cushion
// spans the full width, so arms drawn before it disappear underneath.
function Seat({ x, y, w, back = 13, fill, arms = true }) {
  const d = w / 2;
  const H = 7;
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={w + 4} ry={d + 3} fill="#0b1020" opacity="0.10" />
      <Solid x={x - w * 0.4} y={y - d * 0.4 - H - back} w={w * 0.64} d={d * 0.64} h={H + back} fill={shade(fill, 0.87)} />
      <Solid x={x} y={y - H} w={w} d={d} h={H} fill={fill} />
      {arms && (
        <>
          <Solid x={x - w * 0.8} y={y - H - 5} w={w * 0.22} d={d * 0.78} h={H + 5} fill={shade(fill, 0.79)} />
          <Solid x={x + w * 0.8} y={y - H - 5} w={w * 0.22} d={d * 0.78} h={H + 5} fill={shade(fill, 0.79)} />
        </>
      )}
    </g>
  );
}

const Sofa = ({ x, y, fill = "#cdd8ee" }) => (
  <g>
    <Seat x={x} y={y} w={24} back={14} fill={fill} />
    <line x1={x} y1={y - 7} x2={x} y2={y - 1} stroke={shade(fill, 0.76)} strokeWidth="1.1" />
  </g>
);

const Armchair = ({ x, y, fill = "#cdd8ee" }) => <Seat x={x} y={y} w={12} back={12} fill={fill} />;

// Low table on legs, with an open book left on it.
const CoffeeTable = ({ x, y, accent }) => (
  <g>
    <ellipse cx={x} cy={y} rx="13" ry="6.5" fill="#0b1020" opacity="0.09" />
    {[[-9, 0], [9, 0], [0, 4.5]].map(([lx, ly], i) => (
      <rect key={i} x={x + lx - 1} y={y + ly - 8} width="2" height="8" fill="#a8916f" />
    ))}
    <Solid x={x} y={y - 10} w={13} d={6.5} h={2.4} fill="#d5c0a0" />
    <polygon points={`${x},${y - 13} ${x + 7},${y - 9.5} ${x},${y - 6} ${x - 7},${y - 9.5}`} fill="#fdfbf6" stroke="#e0d6c4" strokeWidth="0.5" />
    <line x1={x} y1={y - 13} x2={x} y2={y - 6} stroke={accent} strokeWidth="0.9" opacity="0.7" />
  </g>
);

// Chest of drawers / filing cabinet, with handles.
function Drawers({ x, y, w = 15, h = 26, n = 3, fill = "#dbe4f4" }) {
  return (
    <g>
      <Solid x={x} y={y - h} w={w} d={w / 2} h={h} fill={fill} />
      {Array.from({ length: n }, (_, i) => {
        const dy = y - h + 6 + i * ((h - 4) / n);
        return (
          <g key={i}>
            <line x1={x - w + 2} y1={dy} x2={x - 1} y2={dy + w / 2 - 1} stroke={shade(fill, 0.72)} strokeWidth="1.1" />
            <rect x={x - w / 2 - 2} y={dy + w / 4 - 3.5} width="5" height="1.8" rx="0.9" fill={shade(fill, 0.55)} />
          </g>
        );
      })}
    </g>
  );
}

// Water cooler: bottle on a stand.
const Cooler = ({ x, y }) => (
  <g>
    <Solid x={x} y={y - 18} w={8} d={4} h={18} fill="#e2e9f6" />
    <rect x={x - 3} y={y - 14} width="6" height="3" rx="1" fill="#7f8fa9" />
    <polygon points={`${x - 7},${y - 19} ${x + 7},${y - 19} ${x + 5},${y - 34} ${x - 5},${y - 34}`} fill="#9fd2ea" opacity="0.9" />
    <ellipse cx={x} cy={y - 34} rx="5" ry="2.2" fill="#7cb9d6" />
    <ellipse cx={x} cy={y - 19} rx="7" ry="3.2" fill="#cfe4f0" />
  </g>
);

const Mug = ({ x, y, accent = "#8f9fbe" }) => (
  <g>
    <ellipse cx={x} cy={y} rx="3.4" ry="1.7" fill={shade(accent, 0.7)} />
    <rect x={x - 3.4} y={y - 5} width="6.8" height="5" fill={accent} />
    <ellipse cx={x} cy={y - 5} rx="3.4" ry="1.7" fill="#f3f7ff" />
    <path d={`M ${x + 3.4} ${y - 4} q 2.6 0.6 0 3`} fill="none" stroke={accent} strokeWidth="1.1" />
  </g>
);

// Desktop printer, sheet half fed, status lights on when working.
const Printer = ({ x, y, on }) => (
  <g>
    <polygon points={`${x - 4},${y - 20} ${x + 6},${y - 15} ${x + 6},${y - 25} ${x - 4},${y - 30}`} fill="#f4f7ff" stroke="#cfd9ea" strokeWidth="0.6" />
    <Solid x={x} y={y - 14} w={15} d={7.5} h={9} fill="#8b97ad" />
    <polygon points={`${x - 12},${y - 6} ${x - 2},${y - 1} ${x + 4},${y - 4} ${x - 6},${y - 9}`} fill="#f7faff" />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={x - 8 + i * 3.2} y={y - 16.6 + i * 1.5} width="2" height="1.6" fill={on ? "#7ee0a4" : "#5b6b84"} />
    ))}
  </g>
);

// Wall-mounted whiteboard with a scribbled line on it.
const Whiteboard = ({ x, y, accent }) => (
  <WallPanel x={x} y={y} w={26} h={17} fill="#ffffff">
    <polyline
      points={`${x + 4},${y - 7} ${x + 9},${y - 11} ${x + 14},${y - 6} ${x + 21},${y - 12}`}
      fill="none"
      stroke={accent}
      strokeWidth="1.5"
      opacity="0.8"
    />
    <line x1={x + 4} y1={y - 2} x2={x + 20} y2={y + 6} stroke="#b9c6dd" strokeWidth="1" />
  </WallPanel>
);

// Coat stand, because every office has one and nobody ever uses it.
const CoatStand = ({ x, y, accent }) => (
  <g>
    <ellipse cx={x} cy={y} rx="7" ry="3.5" fill="#b3a189" />
    <rect x={x - 1.2} y={y - 42} width="2.4" height="42" fill="#a08a6d" />
    <line x1={x} y1={y - 38} x2={x - 8} y2={y - 33} stroke="#a08a6d" strokeWidth="1.8" />
    <line x1={x} y1={y - 38} x2={x + 8} y2={y - 33} stroke="#a08a6d" strokeWidth="1.8" />
    <path d={`M ${x - 8} ${y - 33} q -4 6 -1 13 q 4 2 6 -1 q -3 -6 -1 -11`} fill={accent} opacity="0.75" />
  </g>
);

function Bed({ x, y, accent, asleep, who }) {
  const H = 9;
  const L = LOOKS[who] || DEFAULT_LOOK;
  return (
    <g>
      <polygon points={`${x - 40},${y - 1} ${x - 26},${y - 8} ${x - 26},${y - 26} ${x - 40},${y - 19}`} fill="#a9b8d6" />
      <polygon points={`${x - 4},${y - 18} ${x + 32},${y} ${x - 4},${y + 18} ${x - 40},${y}`} fill="#f4f8ff" />
      <polygon points={`${x - 40},${y} ${x - 4},${y + 18} ${x - 4},${y + 18 + H} ${x - 40},${y + H}`} fill="#d3ddf0" />
      <polygon points={`${x - 4},${y + 18} ${x + 32},${y} ${x + 32},${y + H} ${x - 4},${y + 18 + H}`} fill="#c0cde6" />
      <polygon points={`${x - 24},${y - 10} ${x - 9},${y - 2} ${x - 21},${y + 5} ${x - 36},${y - 3}`} fill="#ffffff" />
      <g className={asleep ? "blanket" : ""} style={{ transformOrigin: `${x + 6}px ${y + 6}px` }}>
        <polygon points={`${x - 8},${y - 8} ${x + 28},${y + 1} ${x - 4},${y + 17} ${x - 20},${y + 7}`} fill={accent} opacity="0.62" />
      </g>
      {asleep && (
        <>
          {/* The same voxel head as the figure, so it is recognisably them. */}
          <Solid x={x - 22} y={y - 8} w={4.6} d={2.3} h={5} fill={L.skin} />
          <Solid x={x - 22} y={y - 11} w={4.9} d={2.45} h={3.2} fill={L.hair} />
          <g className="zzz">
            <text x={x - 10} y={y - 18} fontSize="11" fontWeight="700" fill="#5f6f90">z</text>
            <text x={x - 1} y={y - 27} fontSize="8" fontWeight="700" fill="#5f6f90" opacity="0.75">z</text>
          </g>
        </>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ people */

// The team as isometric voxel people, in the style of the reference sheet: a
// hair block, a head, a coloured top, two legs and two arms. Each agent gets
// its own hair and skin so they are told apart on sight out on the walkways,
// where there is no label next to them.
export const LOOKS = {
  director:   { skin: "#f2c49c", hair: "#3b2a20", legs: "#232b3d", tie: "#dbe2fb" },
  researcher: { skin: "#e5b083", hair: "#9c5326", legs: "#2f3a4f", long: true },
  editor:     { skin: "#f6d0aa", hair: "#1e1a17", legs: "#33304a" },
  designer:   { skin: "#cf9268", hair: "#4b3121", legs: "#3a2f2a", long: true },
  seo:        { skin: "#f2c49a", hair: "#c9913f", legs: "#22323d" },
  finance:    { skin: "#b87c50", hair: "#221a15", legs: "#3d2626" },
  linkedin:   { skin: "#eebe95", hair: "#5d3b23", legs: "#20303f" },
};
const DEFAULT_LOOK = { skin: "#eebe95", hair: "#3b2a20", legs: "#2b3550" };

// What an agent says when it meets another. Deliberately wordless: three dots
// in the speaker's colour, so it reads at 40px tall and needs no translation.
const Bubble = ({ accent }) => (
  <g>
    <rect x="-13" y="-65" width="26" height="15" rx="7" fill="#ffffff" stroke="#b9c6dd" strokeWidth="1" />
    {[-6, 0, 6].map((cx) => (
      <circle key={cx} cx={cx} cy="-57.5" r="1.9" fill={accent} opacity="0.85" />
    ))}
    {/* Tail last, so its white fill hides the box's bottom stroke behind it. */}
    <path d="M -5 -51 L -1.5 -45 L 2 -51" fill="#ffffff" stroke="#b9c6dd" strokeWidth="1" strokeLinejoin="round" />
  </g>
);

// The one and only body an agent has. Used in the room and, when that agent is
// out crossing the campus, by Commuter — never both at once.
//
// The limbs are grouped in opposing pairs — left leg with right arm — so one
// pair of keyframes drives a whole walk cycle. Legs swing along the ground and
// lift on the forward stroke; arms use the same cycle at a smaller amplitude.
export function Figure({ accent, wander, who, walking, say }) {
  const L = LOOKS[who] || DEFAULT_LOOK;
  const gait = walking ? " walk" : "";
  return (
    <g className={wander}>
      <g className={`fig-bob${gait}`}>
        <ellipse cx="0" cy="1" rx="9" ry="3.6" fill="#0b1020" opacity="0.15" />
        <g className="limb-a">
          <Solid x={-3.3} y={-2.4} w={3.3} d={1.65} h={2.4} fill="#1b2233" />
          <Solid x={-3.3} y={-13.4} w={2.8} d={1.4} h={11} fill={L.legs} />
        </g>
        <g className="limb-b">
          <Solid x={3.3} y={-2.4} w={3.3} d={1.65} h={2.4} fill="#1b2233" />
          <Solid x={3.3} y={-13.4} w={2.8} d={1.4} h={11} fill={L.legs} />
        </g>
        {/* Arms before the torso, which then covers the shoulder joint. Each
            arm swings against the leg on its own side. */}
        <g className="swing-b">
          <Solid x={-7.7} y={-27} w={1.8} d={0.9} h={11} fill={accent} />
          <Solid x={-7.7} y={-16} w={1.8} d={0.9} h={2.4} fill={L.skin} />
        </g>
        <g className="swing-a">
          <Solid x={7.7} y={-27} w={1.8} d={0.9} h={11} fill={accent} />
          <Solid x={7.7} y={-16} w={1.8} d={0.9} h={2.4} fill={L.skin} />
        </g>
        <Solid x={0} y={-28.5} w={7} d={3.5} h={15} fill={accent} />
        {L.tie && <polygon points="-1.3,-27.5 1.3,-27.5 0.9,-18 0,-16.4 -0.9,-18" fill={L.tie} />}
        {L.long && <Solid x={0} y={-29.8} w={5.8} d={2.9} h={7} fill={L.hair} />}
        <Solid x={0} y={-37} w={5} d={2.5} h={8.6} fill={L.skin} />
        <Solid x={0} y={-40.2} w={5.3} d={2.65} h={3.4} fill={L.hair} />
      </g>
      {say && (
        <g
          className={say.role === "host" ? "say-host" : "say-visitor"}
          style={{ animationDuration: `${say.dur}s`, animationDelay: `${say.delay}s` }}
        >
          <Bubble accent={accent} />
        </g>
      )}
    </g>
  );
}

/* --------------------------------------------------------- themed scenes */

// Each returns the workstation and the job-specific clutter for one agent,
// drawn around (x, y).
const SCENES = {
  // The corner office. Boardroom table with chairs round it, executive desk,
  // bookcases, trophy shelf, globe, sofa, coffee table, clock, and the dog's bed.
  director: ({ x, y, a, on }) => (
    <g>
      <Rug x={x + 4} y={y + 16} w={64} d={32} fill={a} opacity={0.14} />
      {/* Walnut, not white. The boardroom table used to be within a hair of the
          floor colour and the chairs looked like they were sat around nothing. */}
      <Box x={x + 2} y={y - 2} w={46} d={23} h={7} top="#c9a97e" left="#a98a63" right="#94764f" />
      <MeetChair x={x - 26} y={y + 6} seat="#93a5c4" />
      <MeetChair x={x + 30} y={y + 6} seat="#93a5c4" />
      <MeetChair x={x - 26} y={y - 16} seat="#93a5c4" flip />
      <MeetChair x={x + 30} y={y - 16} seat="#93a5c4" flip />

      <Screen x={x + 30} y={y - 30} w={30} h={22} accent={a} on={on} />
      <WallPanel x={x + 2} y={y - 46} w={18} h={12} accent={a} />
      <Whiteboard x={x - 16} y={y - 56} accent={a} />

      <Box x={x - 62} y={y + 6} w={26} d={13} h={7} top="#e6ecfa" left="#c8d4ea" right="#b6c4de" />
      <Screen x={x - 70} y={y - 2} w={16} h={12} accent={a} on={on} />
      <Mug x={x - 50} y={y + 4} accent="#8d7fd6" />
      <TaskChair x={x - 40} y={y + 20} seat="#2f3a56" />

      <Bookcase x={x - 96} y={y + 14} w={16} h={34} />

      <WallPanel x={x - 40} y={y - 40} w={16} h={10} fill="#f2ede1">
        <polygon points={`${x - 34},${y - 36} ${x - 30},${y - 34} ${x - 30},${y - 40} ${x - 34},${y - 42}`} fill="#d9b356" />
        <rect x={x - 34} y={y - 34} width="4" height="2" fill="#b9933c" />
      </WallPanel>

      <g>
        <line x1={x + 74} y1={y + 10} x2={x + 74} y2={y + 2} stroke="#8b98ad" strokeWidth="1.6" />
        <circle cx={x + 74} cy={y - 5} r="8" fill="#a8c8e8" />
        <path d={`M ${x + 66} ${y - 5} q 8 -6 16 0 q -8 6 -16 0`} fill="#7fae7f" opacity="0.8" />
        <ellipse cx={x + 74} cy={y - 5} rx="8" ry="3" fill="none" stroke="#7f93b0" strokeWidth="0.8" />
      </g>

      <Sofa x={x + 52} y={y + 32} fill="#c6d3ee" />
      <CoffeeTable x={x + 22} y={y + 42} accent={a} />
      <CoatStand x={x + 96} y={y + 6} accent={a} />

      <circle cx={x - 4} cy={y - 52} r="7" fill="#ffffff" stroke="#b9c6dd" strokeWidth="1" />
      <line x1={x - 4} y1={y - 52} x2={x - 4} y2={y - 57} stroke="#5f6f90" strokeWidth="1.2" />
      <line x1={x - 4} y1={y - 52} x2={x} y2={y - 51} stroke="#5f6f90" strokeWidth="1.2" />

      {/* the dog's bed */}
      <g>
        <ellipse cx={x - 34} cy={y + 34} rx="17" ry="9" fill="#c9b79f" />
        <ellipse cx={x - 34} cy={y + 33} rx="12.5" ry="6.2" fill="#e6dbc9" />
      </g>
    </g>
  ),

  // Three monitors, a ranking chart, a whiteboard and the box that crunches it.
  seo: ({ x, y, a, on }) => (
    <g>
      <Box x={x} y={y} w={38} d={19} h={6} />
      <Screen x={x - 22} y={y - 10} w={17} h={13} accent={a} on={on} />
      <Screen x={x - 2} y={y - 14} w={19} h={15} accent={a} on={on} />
      <Screen x={x + 20} y={y - 8} w={17} h={13} accent={a} on={on} />
      <Mug x={x + 14} y={y + 4} accent="#4f7f68" />
      <WallPanel x={x - 40} y={y - 30} w={20} h={14} fill="#ffffff">
        <polyline points={`${x - 36},${y - 20} ${x - 30},${y - 24} ${x - 26},${y - 22} ${x - 22},${y - 29}`} fill="none" stroke="#199e70" strokeWidth="1.6" />
      </WallPanel>
      <Whiteboard x={x - 14} y={y - 44} accent={a} />
      {/* the tower under the desk */}
      <Solid x={x + 30} y={y + 12} w={9} d={4.5} h={22} fill="#4a5570" />
      {[0, 1].map((i) => (
        <rect key={i} x={x + 27} y={y + 16 + i * 4} width="5" height="1.6" fill={on ? "#7ee0a4" : "#6d7a95"} />
      ))}
      <Drawers x={x + 52} y={y + 8} w={13} h={22} n={2} />
    </g>
  ),

  // Paper, pens, a reading lamp and the printer that keeps it all coming.
  editor: ({ x, y, a, on }) => (
    <g>
      <Box x={x} y={y} w={36} d={18} h={6} top="#f0e6d6" left="#d8c9b4" right="#c8b8a2" />
      {[0, 3, 6].map((o, i) => (
        <polygon key={i} points={`${x - 12},${y - 6 - o} ${x + 6},${y + 3 - o} ${x - 4},${y + 9 - o} ${x - 22},${y - o}`} fill="#ffffff" stroke="#dcd2c2" strokeWidth="0.7" />
      ))}
      <polygon points={`${x + 8},${y - 4} ${x + 22},${y + 3} ${x + 16},${y + 7} ${x + 2},${y}`} fill="#ffffff" stroke="#d8cfc0" strokeWidth="0.7" />
      <line x1={x + 6} y1={y - 2} x2={x + 18} y2={y + 4} stroke={a} strokeWidth="1.4" />
      <g>
        <polygon points={`${x + 24},${y - 8} ${x + 30},${y - 5} ${x + 30},${y + 1} ${x + 24},${y - 2}`} fill="#b7a184" />
        {[0, 2, 4].map((o, i) => (
          <line key={i} x1={x + 26 + o} y1={y - 9 - o} x2={x + 26 + o} y2={y - 16 - o} stroke={i === 1 ? a : "#7d6a52"} strokeWidth="1.3" />
        ))}
      </g>
      {on && <ellipse cx={x - 26} cy={y - 14} rx="16" ry="10" fill="#f3d98f" opacity="0.3" className="scr-glow" />}
      <line x1={x - 26} y1={y - 4} x2={x - 26} y2={y - 18} stroke="#8b98ad" strokeWidth="1.6" />
      <polygon points={`${x - 32},${y - 18} ${x - 20},${y - 18} ${x - 23},${y - 25} ${x - 29},${y - 25}`} fill="#e8d7a8" />
      <WallPanel x={x - 44} y={y - 30} w={18} h={22} fill="#efe6d6" accent="#c3ab84" />
      <Mug x={x - 12} y={y + 6} accent="#9d7fb8" />
      {/* printer on its own stand, and a stack of proofs beside it */}
      <Box x={x + 46} y={y + 4} w={17} d={8.5} h={16} top="#e0d5c2" left="#c9bda8" right="#b8ab96" />
      <Printer x={x + 46} y={y + 4} on={on} />
      {[0, 2.5, 5].map((o, i) => (
        <polygon key={i} points={`${x + 62},${y + 20 - o} ${x + 74},${y + 26 - o} ${x + 62},${y + 32 - o} ${x + 50},${y + 26 - o}`} fill="#fbf8f1" stroke="#ded3c1" strokeWidth="0.6" />
      ))}
    </g>
  ),

  // Easel, canvas, swatches, a camera and a graphics tablet.
  designer: ({ x, y, a, on }) => (
    <g>
      <line x1={x - 6} y1={y + 10} x2={x - 14} y2={y - 26} stroke="#a98a63" strokeWidth="2.4" />
      <line x1={x + 12} y1={y + 12} x2={x - 2} y2={y - 26} stroke="#a98a63" strokeWidth="2.4" />
      {on && <ellipse cx={x - 2} cy={y - 20} rx="24" ry="18" fill={a} opacity="0.14" className="scr-glow" />}
      <polygon points={`${x - 20},${y - 12} ${x + 4},${y - 24} ${x + 4},${y - 44} ${x - 20},${y - 32}`} fill="#ffffff" stroke="#c9b79c" strokeWidth="1.1" />
      <polygon points={`${x - 16},${y - 18} ${x},${y - 26} ${x},${y - 38} ${x - 16},${y - 30}`} fill={a} opacity="0.6" />
      <Box x={x + 28} y={y + 2} w={22} d={11} h={5} top="#ecdfd0" left="#d5c5b2" right="#c4b4a0" />
      {["#d95926", "#199e70", "#3987e5", "#c98500"].map((c, i) => (
        <ellipse key={c} cx={x + 18 + i * 7} cy={y - 1 + i * 3} rx="3.2" ry="2" fill={c} />
      ))}
      {/* graphics tablet and camera on the side table */}
      <Box x={x + 54} y={y + 16} w={18} d={9} h={13} top="#dfe7f4" left="#c3cee3" right="#b1bed6" />
      <polygon points={`${x + 54},${y + 10} ${x + 66},${y + 16} ${x + 54},${y + 22} ${x + 42},${y + 16}`} fill="#4a5570" />
      <polygon points={`${x + 54},${y + 12} ${x + 63},${y + 16.5} ${x + 54},${y + 21} ${x + 45},${y + 16.5}`} fill="#5f6b88" />
      <g>
        <Solid x={x + 40} y={y - 8} w={8} d={4} h={6} fill="#3b4258" />
        <circle cx={x + 40} cy={y - 6} r="3.4" fill="#7fa8cf" stroke="#2b3040" strokeWidth="1" />
        <rect x={x + 44} y={y - 11} width="2.4" height="1.8" fill="#e07a3a" />
      </g>
      {/* wall of swatches */}
      <WallPanel x={x - 46} y={y - 26} w={22} h={16} fill="#ffffff">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={x - 42 + (i % 3) * 6} y={y - 22 + Math.floor(i / 3) * 6} width="4.6" height="4.6"
            fill={["#d95926", "#199e70", "#3987e5", "#c98500", "#d55181", "#6b52c9"][i]} opacity="0.85" />
        ))}
      </WallPanel>
    </g>
  ),

  // A vault, the numbers on the wall, a calculator and a stack of coin.
  finance: ({ x, y, a, on }) => (
    <g>
      <Box x={x - 26} y={y - 10} w={20} d={10} h={26} top="#c9d4e6" left="#9fb0c9" right="#8d9fba" />
      <circle cx={x - 26} cy={y + 4} r="7" fill="#7c8ea9" />
      <circle cx={x - 26} cy={y + 4} r="4" fill="#aebdd2" />
      <line x1={x - 30} y1={y + 1} x2={x - 22} y2={y + 7} stroke="#5f7089" strokeWidth="1.5" />
      <Box x={x + 22} y={y + 2} w={26} d={13} h={6} />
      <Screen x={x + 12} y={y - 8} w={16} h={12} accent={a} on={on} />
      <WallPanel x={x - 6} y={y - 30} w={26} h={18} fill="#ffffff">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={x + i * 5.5} y={y - 22 - i * 2.5} width="3.4" height={7 + i * 3} fill={i === 3 ? a : "#9fb0c9"} />
        ))}
      </WallPanel>
      {/* desk calculator, straight off the reference */}
      <g>
        <polygon points={`${x + 30},${y + 1} ${x + 42},${y + 7} ${x + 34},${y + 11} ${x + 22},${y + 5}`} fill="#2f3444" />
        <polygon points={`${x + 31},${y + 2.4} ${x + 37},${y + 5.4} ${x + 34.5},${y + 6.8} ${x + 28.5},${y + 3.8}`} fill="#c9d6c6" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={x + 27 + c * 3 + r * 1.6} y={y + 5.4 + r * 1.5 + c * 0.9} width="1.9" height="1.3"
              fill={r === 2 && c === 2 ? "#d0553f" : r === 0 && c === 0 ? "#5aa06f" : "#8a93a8"} />
          ))
        )}
      </g>
      {/* coin stacks and a strongbox */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <ellipse cx={x + 52 + i * 9} cy={y + 16 - i * 2} rx="5" ry="2.5" fill="#d9b356" />
          <rect x={x + 47 + i * 9} y={y + 11 - i * 2} width="10" height="5" fill="#c9a13f" />
          <ellipse cx={x + 52 + i * 9} cy={y + 11 - i * 2} rx="5" ry="2.5" fill="#e8ca77" />
        </g>
      ))}
      <Drawers x={x - 54} y={y + 14} w={14} h={24} n={4} fill="#cdd8ea" />
    </g>
  ),

  // Pinboard of leads, a magnifier, a filing cabinet and a wall of clippings.
  researcher: ({ x, y, a, on }) => (
    <g>
      <Box x={x} y={y} w={34} d={17} h={6} />
      <Screen x={x - 4} y={y - 10} w={19} h={14} accent={a} on={on} />
      <Box x={x + 30} y={y - 4} w={13} d={7} h={18} top="#dbe4f4" left="#bccbe4" right="#aabcd8" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={x + 24} y1={y - 2 + i * 5} x2={x + 34} y2={y + 3 + i * 5} stroke="#93a4c2" strokeWidth="1.2" />
      ))}
      <WallPanel x={x - 42} y={y - 28} w={24} h={18} fill="#f6efdc">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={x - 38 + (i % 2) * 9} y={y - 24 + Math.floor(i / 2) * 7} width="6" height="5" fill={i === 0 ? a : "#d9c9a5"} />
        ))}
      </WallPanel>
      <circle cx={x + 14} cy={y - 2} r="4.5" fill="none" stroke="#8b98ad" strokeWidth="1.6" />
      <line x1={x + 17} y1={y + 1} x2={x + 22} y2={y + 5} stroke="#8b98ad" strokeWidth="1.8" />
      <Mug x={x - 20} y={y + 4} accent="#4e8ea3" />
      {/* stacks of cuttings and a second pinboard */}
      <Drawers x={x + 54} y={y + 12} w={14} h={26} n={4} />
      {[0, 3].map((o, i) => (
        <polygon key={i} points={`${x + 54},${y - 16 - o} ${x + 66},${y - 10 - o} ${x + 54},${y - 4 - o} ${x + 42},${y - 10 - o}`} fill="#fdfaf2" stroke="#ded3c1" strokeWidth="0.6" />
      ))}
      <Whiteboard x={x - 12} y={y - 44} accent={a} />
    </g>
  ),

  // Ring light, phone on a tripod, and the wall of posts that came out of it.
  linkedin: ({ x, y, a, on }) => (
    <g>
      <Box x={x} y={y} w={32} d={16} h={6} />
      <Screen x={x - 4} y={y - 10} w={18} h={14} accent={a} on={on} />
      <line x1={x + 26} y1={y + 8} x2={x + 26} y2={y - 16} stroke="#8b98ad" strokeWidth="1.8" />
      {on && <circle cx={x + 26} cy={y - 22} r="13" fill="#ffffff" opacity="0.5" className="scr-glow" />}
      <circle cx={x + 26} cy={y - 22} r="9" fill="none" stroke="#e6edf8" strokeWidth="3.2" />
      <rect x={x + 23} y={y - 27} width="6" height="10" rx="1.4" fill="#39445c" />
      <rect x={x + 23.8} y={y - 26.2} width="4.4" height="8" rx="1" fill={a} opacity={on ? 0.95 : 0.45} />
      <WallPanel x={x - 40} y={y - 26} w={20} h={14} fill="#ffffff" accent={a} />
      <Mug x={x - 16} y={y + 4} accent="#3f6fa8" />
      {/* three framed posts on the back wall */}
      {[0, 1, 2].map((i) => (
        <WallPanel key={i} x={x - 16 + i * 15} y={y - 44 + i * 7.5} w={12} h={9} fill="#ffffff" accent={a} />
      ))}
      <Drawers x={x + 52} y={y + 12} w={13} h={22} n={3} />
    </g>
  ),
};

const STATE_COLOUR = {
  idle: "#94a3b8",
  working: "#059669",
  blocked: "#dc2626",
  reporting: "#2E3EEE",
  asleep: "#7c89a6",
};

export { STATE_COLOUR };

/* -------------------------------------------------------------------- room */

export default function OfficeRoom({ seat, agent, index, selected, asleep, away, waitAt, say, onSelect }) {
  const p = slabPoints(seat);
  const accent = agent?.meta?.accent || "#2E3EEE";
  const state = asleep ? "asleep" : agent?.state || "idle";
  const working = state === "working";
  const blocked = state === "blocked";
  const isDirector = agent?.key === "director";

  const wanderClass = working ? "at-desk" : `wander-${index % 6}`;
  const Scene = SCENES[agent?.key] || SCENES.researcher;

  const deskX = deskAnchorX(seat, agent?.key);
  const bedX = seat.cx + seat.w * 0.46;

  // Furniture keeps its own size but spreads out with the room, so the
  // Director's larger floor does not end up with everything huddled in the
  // middle. Positions are quoted for a standard 165x82 room.
  const rx = seat.w / 165;
  const ry = seat.d / 82;
  const px = (dx) => seat.cx + dx * rx;
  const py = (dy) => seat.cy + dy * ry;

  return (
    <g
      className={`room float-${index % 4}${selected ? " selected" : ""}`}
      onClick={() => onSelect(agent?.key)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(agent?.key)}
      aria-label={`${seat.label}, ${state}`}
    >
      <g filter="url(#isoShadow)">
        <polygon points={p.left} fill={isDirector ? "#b9c8e6" : "#c8d6ee"} />
        <polygon points={p.right} fill={isDirector ? "#a7b9dd" : "#b6c7e6"} />
        <polygon
          className="room-plate"
          points={p.top}
          fill="url(#grad-slab)"
          stroke={accent}
          strokeWidth={selected ? 3.4 : isDirector ? 2.6 : 1.8}
          strokeOpacity={selected ? 1 : 0.78}
        />
      </g>

      {/* The floor tint pulses. It carries a base opacity so that switching the
          animation off leaves a tint rather than flooding the whole room. */}
      {working && <polygon points={p.top} fill={accent} opacity="0.16" className="lit" />}
      {blocked && <polygon points={p.top} fill="#dc2626" opacity="0.18" className="lit-bad" />}

      {/* Rugs and floor markings go down before anything stands on them. */}
      <Rug x={px(-52)} y={py(20)} w={50} d={25} fill={accent} opacity={0.16} />
      <Rug x={px(16)} y={py(46)} w={24} d={12} fill="#8fa3c4" opacity={0.18} />

      <Scene x={deskX} y={seat.cy - 2} a={accent} on={working} />

      {/* Shared furnishings. Every position is quoted for a standard 165x82
          room and kept inside |dx|/w + |dy|/d < 0.85, because the floor is a
          diamond and anything placed on the bounding box hangs off a corner. */}
      {/* Anchored to the desk, not the room centre. Behind the occupant the
          figure hid it completely, and at the room centre it landed on top of
          the Director's sofa. The Director's chair lives by the executive desk
          inside its own scene instead. */}
      {!isDirector && <TaskChair x={deskX + 12} y={seat.cy + 26} seat={shade(accent, 0.55)} />}
      <Bin x={px(-88)} y={py(22)} />
      <FloorLamp x={px(-112)} y={py(2)} on={working} />
      <Plant x={px(2)} y={py(-46)} />
      <Bookcase x={px(42)} y={py(-32)} w={15} h={30} />
      <Plant x={px(88)} y={py(-22)} scale={0.8} />
      <Cooler x={px(118)} y={py(2)} />
      <Armchair x={px(34)} y={py(44)} fill="#c8d4ec" />
      {/* The Director already has a sofa and table in the scene itself. */}
      {isDirector ? <Sideboard x={px(60)} y={py(-38)} accent={accent} /> : <CoffeeTable x={px(4)} y={py(52)} accent={accent} />}

      <Bed x={bedX} y={seat.cy + 12} accent={accent} asleep={asleep} who={agent?.key} />

      {/* Empty while its agent is out on the campus. The room keeps its desk,
          screens and bed; only the occupant is somewhere else.

          When someone is on their way over, the occupant stops what it is doing
          and waits at the meeting spot instead of wandering, so the visitor
          arrives to find them standing there rather than chasing them round. */}
      {!asleep && !away && (
        <g
          transform={
            waitAt
              ? `translate(${waitAt.x} ${waitAt.y})`
              : `translate(${working ? deskX + 30 : seat.cx} ${working ? seat.cy + 16 : seat.cy + 10})`
          }
        >
          <Figure
            accent={accent}
            wander={waitAt ? undefined : wanderClass}
            who={agent?.key}
            walking={!waitAt && !working}
            say={say}
          />
        </g>
      )}

      <circle cx={seat.cx - seat.w + 20} cy={seat.cy} r="5" fill={STATE_COLOUR[state]} />
      {(working || blocked) && (
        <circle cx={seat.cx - seat.w + 20} cy={seat.cy} r="8.5" fill="none" stroke={STATE_COLOUR[state]} strokeWidth="1.5" opacity="0.5" className="lit" />
      )}

      <text x={seat.cx} y={seat.cy + seat.d + 36} textAnchor="middle" className="room-label">{seat.label}</text>
      <text x={seat.cx} y={seat.cy + seat.d + 52} textAnchor="middle" className="room-sub">
        {asleep ? "Asleep" : working ? agent?.detail || agent?.currentTask || "Working" : seat.sub}
      </text>
    </g>
  );
}
