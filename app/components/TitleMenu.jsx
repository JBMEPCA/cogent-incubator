"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// The small menu beside the title badge: the three links that are about
// leaving this title rather than working in it. They used to be three loose
// links at the far right of the header, competing with the sections for room.
//
// Switching to another title is the rail's job, so it is not repeated here.
// Desktop only: below 760px the phone sheet already holds all three.

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function TitleMenu({ site, live }) {
  const pathname = usePathname();

  // Keyed on the page it was opened on, as in MobileNav: navigating closes it
  // without an effect watching the pathname.
  const [openedOn, setOpenedOn] = useState(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpenedOn(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenedOn(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="title-menu site-util" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`title-menu-btn${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${site.name} menu`}
        onClick={() => setOpenedOn(open ? null : pathname)}
      >
        <Chevron />
      </button>

      {open && (
        <div className="title-menu-list" role="menu">
          {live && (
            <a href={live} target="_blank" rel="noopener noreferrer" role="menuitem"
              className="title-menu-item site-visit-nav" onClick={close}>
              Visit site
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <Link href="/" role="menuitem" className="title-menu-item" onClick={close}>
            All titles
          </Link>
          <a href="/logout" role="menuitem" className="title-menu-item" onClick={close}>
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
