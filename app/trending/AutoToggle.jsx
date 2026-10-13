"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAutoCommission } from "@/lib/trending-actions";

// Auto-commission on or off, fleet-wide. When on, every refresh commissions the
// strongest fresh matches itself (70+ fit, 2K+ searches, under six hours old),
// at most three a title a day, each under the 40p ceiling, and takes them
// straight to live and onto LinkedIn (lib/trending.js).
export default function AutoToggle({ on: initial }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  const flip = () =>
    startTransition(async () => {
      const res = await setAutoCommission(!on);
      setOn(res.on);
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      className="fleet-nav-btn"
      title="When on, good matches (70+ fit, 2K+ searches, under 6 hours old) are commissioned, published and posted to LinkedIn automatically, up to three a title a day, each capped at 40p."
      style={on ? { color: "var(--text)", borderColor: "var(--neon-green)", boxShadow: "0 0 14px rgba(52,245,197,0.3)" } : undefined}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "var(--neon-green)" : "var(--muted)" }} />
      Auto-commission {on ? "on" : "off"}
    </button>
  );
}
