// Where the assistant keeps its conversations, spend and action log.
//
// Kept behind one small interface so the loop in run.js can be exercised
// against an in-memory store (scripts/assistant-try.mjs) before the tables
// exist on a database.
import { prisma } from "../prisma";
import { ukDayStart } from "../schedule";

export const CAP_KEY = "assistant_daily_cap_usd";
export const DEFAULT_CAP_USD = 5;

/** The daily cap in dollars, from GlobalSetting, falling back to $5. */
export async function dailyCap() {
  const row = await prisma.globalSetting.findUnique({ where: { key: CAP_KEY } }).catch(() => null);
  const v = Number(row?.value);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_CAP_USD;
}

export const prismaStore = {
  async conversation(id, userId) {
    if (!id) return null;
    return prisma.assistantConversation.findFirst({ where: { id, userId } });
  },

  createConversation(userId, title) {
    return prisma.assistantConversation.create({ data: { userId, title: title.slice(0, 120) } });
  },

  async history(conversationId) {
    const rows = await prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
    return rows.map((r) => ({ role: r.role, content: r.content }));
  },

  async appendMessage(conversationId, role, content) {
    await prisma.assistantMessage.create({ data: { conversationId, role, content } });
    await prisma.assistantConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  },

  startTurn(data) {
    return prisma.assistantTurn.create({ data });
  },

  endTurn(id, data) {
    return prisma.assistantTurn.update({ where: { id }, data: { ...data, endedAt: new Date() } });
  },

  createAction(data) {
    return prisma.assistantAction.create({ data });
  },

  /** Proposals a person settled since a point, so the next turn can be told what happened. */
  actionsSince(conversationId, since) {
    return prisma.assistantAction.findMany({
      where: { conversationId, confirmedBy: { not: null }, confirmedAt: { gte: since } },
      orderBy: { confirmedAt: "asc" },
      select: { id: true, tool: true, status: true, result: true },
    });
  },

  async spentToday() {
    const agg = await prisma.assistantTurn.aggregate({ _sum: { costUsd: true }, where: { startedAt: { gte: ukDayStart() } } });
    return agg._sum.costUsd || 0;
  },

  dailyCap,
};

/**
 * Clear chat. The home page always opens the user's latest conversation, so an
 * empty one becomes the latest. Nothing is deleted: the turns are the spend and
 * audit record.
 */
export async function clearConversation(userId) {
  const conv = await prismaStore.createConversation(userId, "New conversation");
  return { id: conv.id, title: conv.title, items: [] };
}

/** The thread the home page draws: messages as text, and every action card. */
export async function conversationView(userId, conversationId = null) {
  const conv = conversationId
    ? await prisma.assistantConversation.findFirst({ where: { id: conversationId, userId } })
    : await prisma.assistantConversation.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (!conv) return null;
  const [messages, actions] = await Promise.all([
    prisma.assistantMessage.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } }),
    prisma.assistantAction.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return { id: conv.id, title: conv.title, items: threadItems(messages, actions) };
}

/**
 * Flatten stored API messages into what a person reads: what they asked, what
 * the assistant said, and the action cards, in order. Tool calls and results
 * are plumbing and are left out, apart from a one-line "looked at" trail.
 */
export function threadItems(messages, actions) {
  const items = [];
  for (const m of messages) {
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content || [];
    if (m.role === "user") {
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (text) items.push({ kind: "user", text, at: m.createdAt });
    } else {
      const tools = blocks.filter((b) => b.type === "tool_use").map((b) => b.name);
      if (tools.length) items.push({ kind: "tools", tools, at: m.createdAt });
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (text) items.push({ kind: "assistant", text, at: m.createdAt });
    }
  }
  items.sort((x, y) => new Date(x.at) - new Date(y.at));
  // A card is made mid-turn, before the reply that talks about it, but reads
  // naturally under that reply ("it's on the card below"). So each one goes
  // after the first assistant reply written after it.
  for (const a of actions) {
    const card = { kind: "action", id: a.id, tool: a.tool, preview: a.preview, status: a.status, result: a.result, at: a.createdAt };
    const i = items.findIndex((x) => x.kind === "assistant" && new Date(x.at) >= new Date(a.createdAt));
    if (i === -1) items.push(card);
    else items.splice(i + 1, 0, card);
  }
  return items;
}
