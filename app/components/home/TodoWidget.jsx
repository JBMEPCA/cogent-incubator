import TodoNotes from "./TodoNotes";
import { listTodos } from "@/lib/todos";

const ukDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export default async function TodoWidget({ canEdit }) {
  const todos = await listTodos().catch(() => []);
  const now = new Date();
  const next = new Date(now.getTime() + 864e5);
  return <TodoNotes todos={todos} canEdit={canEdit} today={ukDay(now)} tomorrow={ukDay(next)} />;
}
