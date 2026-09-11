"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SiteMark from "./SiteMark";

// The section nav on a phone.
//
// The desktop header is a single row holding a title badge, six section links,
// an engine-room light, a live status caption and three utility links. On a
// 375px screen that same row wrapped to five lines and pushed the page it was
// introducing below the fold: the nav was taller than the content.
//
// So on narrow screens the row collapses to badge + one button, and everything
// it used to hold moves into a sheet. A sheet rather than a dropdown because
// these are touch targets: eight 48px rows at reading size beat eight 30px
// links stacked in a column, and the room is free once you are drawing over the
// page anyway.
//
// The title rail stays where it is, along the bottom. Between the two, the two
// axes of the app stay as separate on a phone as they are on a desktop: which
// title (the rail), and which page within it (this).

function Burger({ open }) {
  return (
    <span className={`burger${open ? " is-open" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function MobileNav({ sections, base, rest, site, live }) {
  const pathname = usePathname();

  // Which page the sheet was opened on, rather than a bare boolean. Navigation
  // then closes it by definition: the moment the pathname changes, the sheet is
  // open for somewhere you no longer are. A boolean needs an effect watching
  // the pathname to do the same job, and that effect fires a second render of
  // the whole header on every navigation in the app.
  const [openedOn, setOpenedOn] = useState(null);
  const open = openedOn === pathname;

  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenedOn(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll while the sheet is over it. Restoring
    // whatever was there rather than clearing it keeps this from fighting
    // anything else that sets it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => setOpenedOn(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="mnav-toggle"
        aria-expanded={open}
        aria-controls="mobile-nav-sheet"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpenedOn(open ? null : pathname)}
      >
        <Burger open={open} />
        {/* The engine light the header caption used to carry. Worth keeping on
            the button rather than losing with the rest of the row: whether the
            title is running is the one thing worth knowing without tapping. */}
        <span className={`mnav-pip agent-dot${site.engineEnabled ? " online" : ""}`} aria-hidden="true" />
      </button>

      <div className={`mnav-scrim${open ? " is-open" : ""}`} onClick={close} aria-hidden="true" />

      <div
        id="mobile-nav-sheet"
        ref={panelRef}
        className={`mnav-sheet${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Sections"
        tabIndex={-1}
        // Hidden from assistive tech and from the tab order while closed, which
        // a transform alone does not do: an off-screen sheet is still focusable.
        inert={open ? undefined : true}
      >
        <div className="mnav-head">
          <SiteMark site={site} size={34} showStatus={false} />
          <span className="mnav-head-name">
            {site.name}
            <em>{site.engineEnabled ? "Engine running" : "Engine off"}</em>
          </span>
          <button type="button" className="mnav-close" onClick={close} aria-label="Close menu">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="mnav-list" aria-label="Sections">
          {sections.map((s) => {
            const active = s.seg === "" ? rest === "/" : rest.startsWith(s.seg);
            return (
              <Link
                key={s.seg || "dash"}
                href={`${base}${s.seg}`}
                className={`mnav-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                // Tapping the section you are already on changes no pathname, so
                // nothing would close the sheet.
                onClick={close}
              >
                {s.label}
              </Link>
            );
          })}
          <Link
            href={`${base}/engine-room`}
            className={`mnav-item${rest.startsWith("/engine-room") ? " is-active" : ""}`}
            aria-current={rest.startsWith("/engine-room") ? "page" : undefined}
            onClick={close}
          >
            Engine Room
            <span className={`agent-dot${site.engineEnabled ? " online" : ""}`} />
          </Link>
        </nav>

        <div className="mnav-foot">
          {live && (
            <a
              href={live}
              target="_blank"
              rel="noopener noreferrer"
              className="mnav-item mnav-item-out"
              onClick={close}
            >
              Visit site
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <Link href="/" className="mnav-item mnav-item-quiet" onClick={close}>
            All titles
          </Link>
          <a href="/logout" className="mnav-item mnav-item-quiet" onClick={close}>
            Sign out
          </a>
        </div>
      </div>
    </>
  );
}
