"use client";

import { useEffect } from "react";

// The visible half of the read-only account.
//
// It is NOT the enforcement — lib/permissions.js is, and every action refuses a
// viewer whether or not this component is mounted. What this does is stop the
// interface lying: without it a viewer clicks Save, the action throws, and Next
// renders an error boundary over the page. That reads as "the app is broken"
// when the truth is "this account does not do that".
//
// One capture-phase listener on the document covers every form on every page,
// including the ones rendered after this mounts, which a per-form disabled prop
// would not without touching all thirteen pages that import an action.
export default function ReadOnlyGuard() {
  useEffect(() => {
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    // Capture, so it runs before React's own submit handling rather than after.
    document.addEventListener("submit", block, true);
    return () => document.removeEventListener("submit", block, true);
  }, []);

  return null;
}
