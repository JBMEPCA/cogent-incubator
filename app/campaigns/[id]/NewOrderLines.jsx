"use client";

import { useEffect, useState } from "react";
import OrderLine from "@/app/components/OrderLine";
import { SAVE_FORM } from "./save-form";

// Elements added on the campaign page. They are part of the master Save, and
// clear once it has stored them (they come back as saved lines).

let nextKey = 1;

export default function NewOrderLines({ sites, each }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const clear = () => setRows([]);
    window.addEventListener("campaign-saved", clear);
    return () => window.removeEventListener("campaign-saved", clear);
  }, []);
  const add = () => {
    setRows((r) => [...r, nextKey++]);
    window.dispatchEvent(new Event("campaign-dirty"));
  };
  return (
    <>
      {rows.map((k) => (
        <div key={k} className="ol-new">
          <OrderLine
            prefix={`new:${k}:`}
            sites={sites}
            form={SAVE_FORM}
            each={each}
            actions={
              <button type="button" className="btn-ghost ol-x" onClick={() => setRows((r) => r.filter((x) => x !== k))}>
                Remove
              </button>
            }
          />
        </div>
      ))}
      <div>
        <button type="button" className="btn-ghost" onClick={add}>
          + Add element
        </button>
        {rows.length > 0 && (
          <span className="micro" style={{ color: "var(--muted)", marginLeft: 10 }}>
            New elements are stored when you press Save changes.
          </span>
        )}
      </div>
    </>
  );
}
