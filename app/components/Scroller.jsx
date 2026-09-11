"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A horizontal scroll container for the things that are genuinely wider than a
// phone: the fourteen-column fleet analytics table, the week calendar, the
// office floor plan.
//
// The app already wrapped those in a bare `<div style={{ overflowX: "auto" }}>`,
// which is correct and completely invisible. On a phone that is the whole
// problem: a table clipped flush at the screen edge looks like a table that
// ends there, so the six columns to the right of the fold are never found.
//
// So this adds the one thing the bare div was missing — an edge that says
// "there is more" — and takes it away again at both ends, which is why the
// state is measured rather than painted unconditionally. A permanent fade on a
// table that fits is worse than no fade at all: it promises columns that do not
// exist. `overscroll-behavior-x: contain` (in the stylesheet) stops a sideways
// swipe on a table from turning into a browser back-gesture, which is the other
// way wide tables go wrong on a phone.

export default function Scroller({ children, className = "", style, ...rest }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState("none");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A pixel of slack: fractional layout widths otherwise leave a container
    // that cannot scroll reporting one scrollable pixel, and the fade flickers
    // on at the right edge of a table that fits perfectly.
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) return setEdge("none");
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft < max - 1;
    setEdge(left && right ? "both" : left ? "left" : right ? "right" : "none");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // Content arriving late, the window rotating, or a panel beside this one
    // reflowing all change the answer, and none of them fire a scroll event.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  return (
    <div className={`scroller-wrap${className ? ` ${className}` : ""}`} data-edge={edge}>
      <div ref={ref} className="scroller" style={style} {...rest}>
        {children}
      </div>
    </div>
  );
}
