"use client";

// Print to PDF is how the report reaches the client: the page is laid out for it.
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Save as PDF
    </button>
  );
}
