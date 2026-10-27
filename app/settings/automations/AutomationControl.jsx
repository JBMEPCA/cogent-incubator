"use client";

import { useActionState } from "react";
import { setAutomation } from "@/lib/app-settings-actions";

// One switch: a segmented control whose buttons each submit their own value.
// Saving on click rather than behind a Save button, because a switch you have
// to remember to save is how "I paused it" turns into "it sent anyway".
export default function AutomationControl({ automationKey, value, options }) {
  const [state, action, pending] = useActionState(setAutomation, null);
  return (
    <form action={action} className="auto-control">
      <input type="hidden" name="key" value={automationKey} />
      <div className="auto-seg" role="group">
        {options.map((o) => (
          <button
            key={o.value}
            name="value"
            value={o.value}
            disabled={pending}
            aria-pressed={o.value === value}
            className={o.value === value ? "is-on" : undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
      {state?.message && <p className={state.ok ? "field-note" : "field-err"}>{state.message}</p>}
    </form>
  );
}
