// The home page To Do's: a shared notepad of tasks, each with an optional
// "when by" date and a tick.
//
// Each task is its own GlobalSetting row (todo:<id>, JSON value) rather than
// one list in one row, so two people adding at once cannot overwrite each
// other, and no migration was needed. If the list ever wants assignees or
// per-title tasks, it has outgrown this and should become a table; the
// per-title Todo model is the launch checklist and is a different thing.

import { fleetRead } from "./prisma";

export const TODO_PREFIX = "todo:";

/**
 * Every task, open ones first by due date (undated last, then oldest first),
 * then ticked ones, most recently ticked first.
 */
export async function listTodos() {
  const rows = await fleetRead().globalSetting.findMany({ where: { key: { startsWith: TODO_PREFIX } } });
  const todos = [];
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value);
      todos.push({ id: r.key.slice(TODO_PREFIX.length), ...v });
    } catch {
      // A row that will not parse is skipped rather than breaking the list.
    }
  }
  const open = todos
    .filter((t) => !t.done)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.createdAt.localeCompare(b.createdAt));
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  return [...open, ...done];
}
