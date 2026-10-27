"use client";

import { useActionState } from "react";
import { checkConnectionsNow, recheckTitles } from "@/lib/app-settings-actions";

const ACTIONS = { shared: checkConnectionsNow, titles: recheckTitles };

/** A button that runs one of the connection checks and says how it went. */
export default function CheckButton({ which, label, busyLabel }) {
  const [state, action, pending] = useActionState(ACTIONS[which], null);
  return (
    <form action={action} className="conn-check">
      <button className="btn" disabled={pending}>{pending ? busyLabel : label}</button>
      {state?.message && <span className={state.ok ? "field-note" : "field-err"}>{state.message}</span>}
    </form>
  );
}
