"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";
import { TODO_PREFIX } from "./todos";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function read(id) {
  const row = await prisma.globalSetting.findUnique({ where: { key: `${TODO_PREFIX}${id}` } });
  return row ? JSON.parse(row.value) : null;
}

const write = (id, value) =>
  prisma.globalSetting.update({ where: { key: `${TODO_PREFIX}${id}` }, data: { value: JSON.stringify(value) } });

/** useActionState-shaped: { ok, message }. */
export async function addTodo(_prev, formData) {
  await requireEditor();
  const text = String(formData.get("text") || "").trim().slice(0, 300);
  const due = String(formData.get("due") || "").trim();
  if (!text) return { ok: false, message: "Write the task first." };
  if (due && !DAY.test(due)) return { ok: false, message: "That date doesn't look right." };

  const value = { text, due: due || null, done: false, createdAt: new Date().toISOString(), doneAt: null };
  await prisma.globalSetting.create({ data: { key: `${TODO_PREFIX}${randomUUID()}`, value: JSON.stringify(value) } });
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function setTodoDone(id, done) {
  await requireEditor();
  const t = await read(id);
  if (!t) return;
  await write(id, { ...t, done: !!done, doneAt: done ? new Date().toISOString() : null });
  revalidatePath("/");
}

/** Removes every ticked task. Open ones are never touched. */
export async function clearDoneTodos() {
  await requireEditor();
  const rows = await prisma.globalSetting.findMany({ where: { key: { startsWith: TODO_PREFIX } } });
  const ids = rows
    .filter((r) => {
      try {
        return JSON.parse(r.value).done === true;
      } catch {
        return false;
      }
    })
    .map((r) => r.key);
  if (ids.length) await prisma.globalSetting.deleteMany({ where: { key: { in: ids } } });
  revalidatePath("/");
}
