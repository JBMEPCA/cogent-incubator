"use client";
import { useEffect, useRef, useState } from "react";

// Interactive force-directed map of the site's link graph. Cyan nodes are
// articles (sized by connections), violet nodes are outbound domains.
// Drag nodes, hover to highlight connections, click to open, wheel to zoom.
export default function LinkMap({ data }) {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [hover, setHover] = useState(null);
  const [zoom, setZoom] = useState(1);
  const sim = useRef({ nodes: [], dragging: null, raf: 0 });

  const W = 1100;
  const H = 560;

  useEffect(() => {
    // Seed on a golden-angle spiral rather than a tight ring. A ring starts
    // every node almost on top of its neighbours, which is what made the
    // opening frames explode.
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const count = data.nodes.length || 1;
    const ns = data.nodes.map((n, i) => {
      const r = (n.kind === "post" ? 150 : 250) * Math.sqrt((i + 0.5) / count) + 40;
      const a = i * GOLDEN;
      return { ...n, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r * 0.72, vx: 0, vy: 0 };
    });
    sim.current.nodes = ns;
    const byId = Object.fromEntries(ns.map((n) => [n.id, n]));

    // One physics iteration. Shared by the warm-up and the render loop so both
    // behave identically.
    const applyForces = (alpha, tick, drift) => {
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i], b = ns[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          // Floor the squared distance: without this, two coincident nodes give
          // a near-infinite force and the whole graph detonates.
          let d2 = Math.max(dx * dx + dy * dy, 900);
          if (d2 < 40000) {
            const f = Math.min((2600 / d2) * alpha * 60, 6);
            const d = Math.sqrt(d2);
            dx /= d; dy /= d;
            a.vx -= dx * f; a.vy -= dy * f;
            b.vx += dx * f; b.vy += dy * f;
          }
        }
      }
      for (const e of data.edges) {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = a.kind === "post" && b.kind === "post" ? 170 : 120;
        const f = ((d - target) / d) * alpha * 1.6;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
      for (const n of ns) {
        n.vx += (W / 2 - n.x) * alpha * 0.055;
        n.vy += (H / 2 - n.y) * alpha * 0.075;
        if (sim.current.dragging !== n.id) {
          n.x += n.vx *= 0.86;
          n.y += n.vy *= 0.86;
        }
        if (drift) {
          // Barely-there ambient movement. Any larger and it reads as a shimmer
          // rather than the graph being alive.
          n.x += Math.sin(tick / 90 + n.seed) * 0.05;
          n.y += Math.cos(tick / 105 + n.seed) * 0.04;
        }
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(24, Math.min(H - 24, n.y));
      }
    };

    // Settle the layout off-screen before the first paint, so the map opens
    // already arranged instead of visibly thrashing its way there.
    for (let i = 0; i < 260; i++) {
      applyForces(Math.max(0.004, 0.09 * Math.exp(-i / 90)), i, false);
    }
    for (const n of ns) { n.vx = 0; n.vy = 0; }
    setNodes(ns.map((n) => ({ ...n })));

    let tick = 0;
    const step = () => {
      // Starts low because the warm-up already did the heavy lifting.
      const alpha = Math.max(0.004, 0.02 * Math.exp(-tick / 120));
      applyForces(alpha, tick, true);
      tick++;
      setNodes(ns.map((n) => ({ ...n })));
      sim.current.raf = requestAnimationFrame(step);
    };
    sim.current.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(sim.current.raf);
  }, [data]);

  const onPointerDown = (id) => (e) => {
    e.preventDefault();
    sim.current.dragging = id;
  };
  useEffect(() => {
    const move = (e) => {
      const id = sim.current.dragging;
      if (!id || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const n = sim.current.nodes.find((x) => x.id === id);
      if (n) {
        n.x = ((e.clientX - rect.left) / rect.width) * W;
        n.y = ((e.clientY - rect.top) / rect.height) * H;
        n.vx = 0; n.vy = 0;
      }
    };
    const up = () => (sim.current.dragging = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const connected = new Set();
  if (hover) {
    connected.add(hover);
    for (const e of data.edges) {
      if (e.from === hover) connected.add(e.to);
      if (e.to === hover) connected.add(e.from);
    }
  }
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", cursor: "grab", borderRadius: 12 }}
        onWheel={(e) => setZoom((z) => Math.max(0.6, Math.min(2.2, z - e.deltaY * 0.001)))}
      >
        <g transform={`translate(${(W / 2) * (1 - zoom)} ${(H / 2) * (1 - zoom)}) scale(${zoom})`}>
          {data.edges.map((e, i) => {
            const a = byId[e.from], b = byId[e.to];
            if (!a || !b) return null;
            const hot = hover && (e.from === hover || e.to === hover);
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={hot ? "var(--neon-cyan)" : "rgba(101,125,255,0.22)"}
                strokeWidth={hot ? 1.8 : 0.8}
                style={hot ? { filter: "drop-shadow(0 0 4px rgba(34,211,238,0.9))" } : undefined}
              />
            );
          })}
          {nodes.map((n) => {
            const dim = hover && !connected.has(n.id);
            const r = n.kind === "post" ? 7 + Math.min(11, n.degree * 2.2) : 5;
            const fill = n.kind === "post" ? "var(--neon-cyan)" : "var(--neon-violet)";
            return (
              <g
                key={n.id}
                opacity={dim ? 0.18 : 1}
                onPointerDown={onPointerDown(n.id)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onDoubleClick={() => n.url && window.open(n.url, "_blank")}
                style={{ cursor: "pointer", transition: "opacity 0.25s" }}
              >
                <circle cx={n.x} cy={n.y} r={r + 5} fill={fill} opacity={0.14}>
                  <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="3.4s" repeatCount="indefinite" />
                </circle>
                <circle
                  cx={n.x} cy={n.y} r={r} fill={fill}
                  style={{ filter: `drop-shadow(0 0 ${hover === n.id ? 14 : 6}px ${n.kind === "post" ? "rgba(34,211,238,0.9)" : "rgba(167,139,250,0.8)"})` }}
                />
                <text
                  x={n.x} y={n.y - r - 7}
                  textAnchor="middle"
                  fill={hover === n.id ? "var(--text)" : "var(--muted)"}
                  fontSize={n.kind === "post" ? 10.5 : 9}
                  fontWeight={hover === n.id ? 700 : 400}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {n.label.length > 34 ? n.label.slice(0, 32) + "…" : n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {hover && byId[hover] && (
        <div
          className="micro"
          style={{ position: "absolute", bottom: 10, left: 14, color: "var(--neon-cyan)" }}
        >
          {byId[hover].kind === "post"
            ? `${byId[hover].degree} connections · double-click to open`
            : `outbound: ${byId[hover].label}`}
        </div>
      )}
    </div>
  );
}
