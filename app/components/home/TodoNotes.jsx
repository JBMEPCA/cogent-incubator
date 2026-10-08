"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { addTodo, setTodoDone, clearDoneTodos } from "@/lib/todo-actions";
import { TODO_PEOPLE } from "@/lib/todo-people";

// To Do's, drawn as a notepad: yellow top and ruled paper. Every row (the
// task box, the "when by" line, each task, wrapped text included) is one or
// more 40px lines, so writing sits on the rules the way it does on paper.
// Ticks show at once and save in the background; ticked tasks sink to the
// bottom until cleared.

const COLOR = Object.fromEntries(TODO_PEOPLE.map((p) => [p.key, p.color]));

// `today` and `tomorrow` come from the server (UK days, "2026-10-08"), so
// the server's render and the browser's agree.
function dueLabel(due, today, tomorrow) {
  if (!due) return null;
  if (due === today) return { text: "Today", tone: "soon" };
  if (due === tomorrow) return { text: "Tomorrow", tone: "soon" };
  const text = new Date(`${due}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return due < today ? { text: `${text}, overdue`, tone: "late" } : { text, tone: "" };
}

function Person({ who }) {
  if (!who) return null;
  return (
    <span className="dw-notes-who" style={{ background: COLOR[who] || "#8e8e93" }} title={`For ${who}`}>
      {who}
    </span>
  );
}

export default function TodoNotes({ todos, canEdit, today, tomorrow }) {
  const [state, action, pending] = useActionState(addTodo, null);
  const [, startTransition] = useTransition();
  const [shown, tick] = useOptimistic(todos, (list, { id, done }) =>
    list.map((t) => (t.id === id ? { ...t, done } : t))
  );
  const [filter, setFilter] = useState("");
  const form = useRef(null);

  useEffect(() => {
    if (state?.ok) form.current?.querySelector("input[name=text]")?.focus();
  }, [state]);

  const toggle = (id, done) =>
    startTransition(async () => {
      tick({ id, done });
      await setTodoDone(id, done);
    });

  const visible = filter ? shown.filter((t) => t.who === filter) : shown;
  const doneCount = shown.filter((t) => t.done).length;
  const openCount = shown.length - doneCount;
  const lateCount = shown.filter((t) => !t.done && t.due && t.due < today).length;
  const mine = (k) => shown.filter((t) => !t.done && t.who === k).length;

  return (
    <section className="dw dw-span-4 dw-notes" aria-label="To Do's">
      <header className="dw-notes-top">
        <h2>To Do&apos;s</h2>
        <span>
          {openCount ? `${openCount} to do` : "All done"}
          {lateCount > 0 && <b className="dw-notes-late"> · {lateCount} overdue</b>}
        </span>
      </header>

      <div className="dw-notes-paper">
        {canEdit && (
          <form ref={form} action={action} className="dw-notes-add">
            <input
              name="text"
              className="dw-notes-task"
              placeholder="Add task"
              aria-label="Add task"
              maxLength={300}
              required
              autoComplete="off"
            />
            <div className="dw-notes-line dw-notes-fields">
              <label>
                When by
                <input type="date" name="due" />
              </label>
              <label>
                For
                <select name="who" defaultValue="">
                  <option value="">Anyone</option>
                  {TODO_PEOPLE.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.key}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
            {state && !state.ok && <p className="dw-notes-line dw-notes-err">{state.message}</p>}
          </form>
        )}

        <div className="dw-notes-line dw-notes-filter" role="group" aria-label="Show tasks for">
          <button type="button" aria-pressed={!filter} onClick={() => setFilter("")}>
            All
          </button>
          {TODO_PEOPLE.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={filter === p.key}
              onClick={() => setFilter(filter === p.key ? "" : p.key)}
              style={{ "--who": p.color }}
            >
              {p.key}
              {mine(p.key) > 0 && <small>{mine(p.key)}</small>}
            </button>
          ))}
        </div>

        <ul className="dw-notes-list">
          {visible.length === 0 && (
            <li className="dw-notes-empty">{filter ? `Nothing for ${filter}.` : "Nothing on the list."}</li>
          )}
          {visible.map((t) => {
            const due = !t.done && dueLabel(t.due, today, tomorrow);
            return (
              <li key={t.id} className={t.done ? "is-done" : ""}>
                <label>
                  <input type="checkbox" checked={t.done} disabled={!canEdit} onChange={(e) => toggle(t.id, e.target.checked)} />
                  <span className="dw-notes-text">{t.text}</span>
                </label>
                <span className="dw-notes-meta">
                  {due && <span className={`dw-notes-due ${due.tone}`}>{due.text}</span>}
                  <Person who={t.who} />
                </span>
              </li>
            );
          })}
        </ul>

        {canEdit && doneCount > 0 && (
          <div className="dw-notes-line">
            <button type="button" className="dw-notes-clear" onClick={() => startTransition(() => clearDoneTodos())}>
              Clear {doneCount} ticked
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
