"use server";

import { after } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";
import { confirmTool } from "./assistant/tools";

// The Confirm and Cancel buttons on the assistant's action cards.
//
// Confirm runs the input stored when the action was proposed, never anything
// the model says afterwards: what Lucas read in the preview is what happens.
// The pending -> running claim is a single conditional update, so two clicks
// (or two tabs) cannot send the same reply twice.

async function claim(id, status) {
  await requireEditor();
  const session = await auth();
  const who = session?.user?.name || session?.user?.id || "unknown";
  const { count } = await prisma.assistantAction.updateMany({
    where: { id, status: "pending" },
    data: { status, confirmedBy: who, confirmedAt: new Date() },
  });
  return count === 1;
}

const finish = (id, status, result) =>
  prisma.assistantAction.update({ where: { id }, data: { status, result: String(result).slice(0, 1000) } });

/** { ok, status, message } */
export async function confirmAction(id) {
  if (!(await claim(id, "running"))) return { ok: false, message: "That one has already been confirmed or cancelled." };
  const action = await prisma.assistantAction.findUnique({ where: { id } });
  const tool = confirmTool(action.tool);
  if (!tool) {
    await finish(id, "failed", `Unknown action ${action.tool}`);
    return { ok: false, status: "failed", message: `Unknown action ${action.tool}` };
  }

  try {
    if (tool.background) {
      // The press desk takes a minute or two. Started now, finished after the
      // response, and the card reads its outcome back from the row.
      const { start, run } = await tool.execute(action.input);
      after(async () => {
        try {
          const r = await run();
          const outcome = r.published ? "published" : r.scheduled ? "scheduled" : r.held ? `held: ${r.held}` : r.skipped ? `skipped: ${r.skipped}` : r.error ? `failed: ${r.error}` : "finished";
          await finish(id, r.error ? "failed" : "done", `Press desk ${outcome}${r.url ? ` ${r.url}` : ""}`);
        } catch (e) {
          await finish(id, "failed", e?.message || e);
        }
      });
      await finish(id, "running", `Writing "${start.title}" now; this card updates when it lands.`);
      return { ok: true, status: "running", message: "Started." };
    }
    const result = await tool.execute(action.input);
    await finish(id, "done", result);
    return { ok: true, status: "done", message: result };
  } catch (e) {
    const message = String(e?.message || e);
    await finish(id, "failed", message);
    return { ok: false, status: "failed", message };
  }
}

export async function cancelAction(id) {
  if (!(await claim(id, "cancelled"))) return { ok: false, message: "That one has already been confirmed or cancelled." };
  await finish(id, "cancelled", "Cancelled; nothing was sent or changed.");
  return { ok: true, status: "cancelled" };
}
