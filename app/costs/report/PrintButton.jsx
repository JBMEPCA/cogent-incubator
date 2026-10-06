"use client";

import { useEffect } from "react";

// The browser's own print-to-PDF is the export: the page is laid out at A4, so
// "Save as PDF" produces the file to send without a PDF renderer on the server.
//
// `auto` opens the print dialog as soon as the page is ready, for the button on
// Group costs. It waits for the web fonts, or the PDF can catch the fallback
// face mid-swap.
export default function PrintButton({ auto = false }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!cancelled) setTimeout(() => window.print(), 250);
    });
    return () => {
      cancelled = true;
    };
  }, [auto]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: "9px 18px",
        borderRadius: 10,
        border: 0,
        background: "linear-gradient(135deg, #3987e5, #22d3ee)",
        color: "#05070f",
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      Download PDF
    </button>
  );
}
