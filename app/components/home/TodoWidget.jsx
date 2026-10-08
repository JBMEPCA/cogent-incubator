import TodoNotes from "./TodoNotes";
import { listTodos } from "@/lib/todos";

export default async function TodoWidget({ canEdit }) {
  const todos = await listTodos().catch(() => []);
  return <TodoNotes todos={todos} canEdit={canEdit} />;
}
