"use client";

import { Children, useState } from "react";

// The first ten of a list, then "Show more" ten at a time, so the Trending
// Topics page stays short however much is going on. The rows are rendered on
// the server and handed in as children; this only decides how many to show.

const STEP = 10;

function MoreButton({ shown, total, onMore }) {
  return (
    <button type="button" className="btn-ghost" onClick={onMore} style={{ alignSelf: "center", marginTop: 12, fontSize: 13 }}>
      Show more ({Math.min(STEP, total - shown)} of {total - shown} more)
    </button>
  );
}

/** A plain list: cards or rows in a flex column. */
export function ShowMore({ children, className, style }) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(STEP);
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", ...style }}>
      {items.slice(0, shown)}
      {items.length > shown && <MoreButton shown={shown} total={items.length} onMore={() => setShown((n) => n + STEP)} />}
    </div>
  );
}

/** Table rows: goes inside <tbody>, with the button in a full-width last row. */
export function ShowMoreRows({ children, colSpan }) {
  const rows = Children.toArray(children);
  const [shown, setShown] = useState(STEP);
  return (
    <>
      {rows.slice(0, shown)}
      {rows.length > shown && (
        <tr>
          <td colSpan={colSpan} style={{ textAlign: "center", paddingTop: 4 }}>
            <MoreButton shown={shown} total={rows.length} onMore={() => setShown((n) => n + STEP)} />
          </td>
        </tr>
      )}
    </>
  );
}
