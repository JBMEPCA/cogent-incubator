"use client";

import { useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { addTodo, setTodoDone, clearDoneTodos } from "@/lib/todo-actions";

// To Do's, drawn as a notepad: yellow top, lined paper, a task box and a
// "when by" date, and a tick for each saved task. Ticks show at once and save
// in the background; ticked tasks sink to the bottom until cleared.

const UK = "Europe/London";
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: UK });

function dueLabel(due) {
  if (!due) return null;
  const today = todayKey();
  const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString("en-CA", { timeZone: UK });
  if (due === today) return { text: "Today", tone: "soon" };
  if (due === tomorrow) return { text: "Tomorrow", tone: "soon" };
  const text = new Date(`${due}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return { text: due < today ? `${text} · overdue` : text, tone: due < today ? "late" : "" };
}

export default function TodoNotes({ todos, canEdit }) {
  const [state, action, pending] = useActionState(addTodo, null);
  const [, startTransition] = useTransition();
  const [shown, tick] = useOptimistic(todos, (list, { id, done }) =>
    list.map((t) => (t.id === id ? { ...t, done } : t))
  );
  const form = useRef(null);

  useEffect(() => {
    if (state?.ok) form.current?.querySelector("input[name=text]")?.focus();
  }, [state]);

  const toggle = (id, done) =>
    startTransition(async () => {
      tick({ id, done });
      await setTodoDone(id, done);
    });

  const doneCount = shown.filter((t) => t.done).length;
  const openCount = shown.length - doneCount;

  return (
    <section className="dw dw-span-4 dw-notes" aria-label="To Do's">
      <header className="dw-notes-top">
        <h2>To Do&apos;s</h2>
        <span>{openCount ? `${openCount} to do` : "All done"}</span>
      </header>

      <div className="dw-notes-paper">
        {canEdit && (
          <form ref={form} action={action} className="dw-notes-add">
            <input name="text" placeholder="Add task" aria-label="Add task" maxLength={300} required autoComplete="off" />
            <div className="dw-notes-add-row">
              <label>
                When by
                <input type="date" name="due" />
              </label>
              <button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
            {state && !state.ok && <p className="dw-notes-err">{state.message}</p>}
          </form>
        )}

        {shown.length ? (
          <ul className="dw-notes-list">
            {shown.map((t) => {
              const due = !t.done && dueLabel(t.due);
              return (
                <li key={t.id} className={t.done ? "is-done" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={t.done}
                      disabled={!canEdit}
                      onChange={(e) => toggle(t.id, e.target.checked)}
                    />
                    <span className="dw-notes-text">{t.text}</span>
                  </label>
                  {due && <span className={`dw-notes-due ${due.tone}`}>{due.text}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dw-notes-empty">Nothing on the list.</p>
        )}

        {canEdit && doneCount > 0 && (
          <button type="button" className="dw-notes-clear" onClick={() => startTransition(() => clearDoneTodos())}>
            Clear {doneCount} ticked
          </button>
        )}
      </div>
    </section>
  );
}
