// Agent runtime: state transitions, real token accounting, and the message bus
// the Director reads. Every model call an agent makes is costed from actual
// usage, so the Finance Manager reports measurements rather than estimates.
import Anthropic from "@anthropic-ai/sdk";
import { prisma, forSite } from "../prisma";
import { AGENTS, costOf } from "./registry";
import { startMetering, drainMetering } from "./meter";

const DEFAULT_MODEL = "claude-opus-4-8";

export async function ensureAgents(siteId) {
  const db = forSite(siteId);
  for (const a of Object.values(AGENTS)) {
    await db.agent.upsert({
      // Agent's primary key is (siteId, key) now, so a unique lookup has to
      // name both. forSite() can stamp the site onto `create`, but it cannot
      // rewrite a `where` that Prisma has already rejected as not-unique.
      where: { siteId_key: { siteId, key: a.key } },
      update: { name: a.name, role: a.role, goal: a.goal },
      create: { key: a.key, name: a.name, role: a.role, goal: a.goal },
    });
  }
}

export async function setState(key, state, currentTask = null, detail = null) {
  await prisma.agent.update({
    where: { key },
    data: {
      state,
      currentTask,
      detail,
      ...(state === "working" ? { startedAt: new Date() } : {}),
      ...(state === "idle" ? { startedAt: null } : {}),
    },
  });
}

// A platform timeout kills a run outright: nothing reaches the endedAt write,
// and because `ok` defaults to true the row reads as a clean success costing
// $0. That is how the Editor came to be killed on every scheduled tick for two
// days without anything on the page looking wrong. Anything still open long
// past the 60s function limit is dead, so close it honestly.
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

export async function reapStaleRuns() {
  const stale = await prisma.agentRun.findMany({
    where: { endedAt: null, startedAt: { lt: new Date(Date.now() - RUN_TIMEOUT_MS) } },
    select: { id: true, agentKey: true },
  });
  if (!stale.length) return 0;

  await prisma.agentRun.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { ok: false, error: "killed before it finished (function timed out)", endedAt: new Date() },
  });

  // Left alone the agent also stays on "working" for ever, which is the one
  // state the office draws as someone sat at their desk.
  for (const r of stale) {
    await prisma.agent.updateMany({
      where: { key: r.agentKey, state: "working" },
      data: { state: "idle", currentTask: null, startedAt: null, detail: "Last run was cut short before it finished" },
    });
  }
  return stale.length;
}

export async function say(fromKey, toKey, subject, body = null, kind = "report") {
  return prisma.agentMessage.create({ data: { fromKey, toKey, subject, body, kind } });
}

/**
 * Run one agent turn. Handles state, timing, cost accounting and failure
 * capture, and hands the body a `think()` that meters every model call.
 */
export async function runAgent(key, trigger, task, body) {
  const run = await prisma.agentRun.create({ data: { agentKey: key, trigger, summary: task } });
  await setState(key, "working", task, null);

  let totals = { input: 0, output: 0, cost: 0, model: null };
  startMetering();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const think = async ({ system, user, maxTokens = 4000, model = DEFAULT_MODEL, images = [] }) => {
    const content = images.length
      ? [...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } })), { type: "text", text: user }]
      : user;
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content }],
    });
    const u = res.usage || {};
    const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    const outTok = u.output_tokens || 0;
    totals.input += inTok;
    totals.output += outTok;
    totals.cost += costOf(model, inTok, outTok);
    totals.model = model;
    if (res.stop_reason === "refusal") throw new Error("model refused");
    let text = "";
    for (const b of res.content) if (b.type === "text") text += b.text;
    // max_tokens caps thinking AND visible output together, so adaptive
    // thinking on a tight budget returns a reply cut off mid-sentence. Every
    // caller here asks for JSON and parses it in a try/catch, so a truncated
    // reply became an empty result and a successful-looking run: the Researcher
    // reported "proposed 0 topics", ok:true, twice, for 10p a time. Failing
    // loudly is the only way that surfaces.
    if (res.stop_reason === "max_tokens") {
      throw new Error(
        `reply truncated at max_tokens (${maxTokens}); thinking and output share this budget, so raise it for this call`
      );
    }
    return text.trim();
  };

  // Lets an agent narrate what it is doing, which is what the office view shows.
  const progress = (detail) => setState(key, "working", task, detail);

  const fold = () => {
    const d = drainMetering();
    totals.input += d.input;
    totals.output += d.output;
    totals.cost += d.cost;
    totals.model = totals.model || d.model;
  };

  try {
    const result = await body({ think, progress, say: (to, subject, b, kind) => say(key, to, subject, b, kind) });
    fold();
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        ok: true,
        summary: result?.summary || task,
        articleId: result?.articleId || null,
        model: totals.model,
        inputTokens: totals.input,
        outputTokens: totals.output,
        costUsd: totals.cost,
        endedAt: new Date(),
      },
    });
    await setState(key, "idle", null, result?.summary || null);
    await prisma.agent.update({ where: { key }, data: { lastRunAt: new Date() } });
    return { ok: true, ...result, cost: totals.cost };
  } catch (e) {
    fold();
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        ok: false,
        error: e.message?.slice(0, 500),
        model: totals.model,
        inputTokens: totals.input,
        outputTokens: totals.output,
        costUsd: totals.cost,
        endedAt: new Date(),
      },
    });
    await setState(key, "blocked", task, e.message?.slice(0, 200));
    // A blocked agent is the Director's problem, so it always hears about it --
    // unless it IS the Director, in which case this only puts a report in its
    // own inbox that it will rule on next tick and reply to itself about, for
    // ever. That loop kept a one-off credit failure alive for two days.
    if (key !== "director") {
      await say(key, "director", `Blocked: ${task}`, e.message?.slice(0, 400), "conflict");
    }
    return { ok: false, error: e.message, cost: totals.cost };
  }
}

// Snapshot for the office view: every agent, what it is doing, and how it has
// been performing lately.
export async function officeState() {
  await ensureAgents();
  const agents = await prisma.agent.findMany();
  const since = new Date(Date.now() - 7 * 864e5);

  const runs = await prisma.agentRun.groupBy({
    by: ["agentKey"],
    where: { startedAt: { gte: since } },
    _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    _count: true,
  });
  const recent = await prisma.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 40,
    select: { id: true, agentKey: true, summary: true, ok: true, error: true, costUsd: true, startedAt: true, endedAt: true },
  });
  const messages = await prisma.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, fromKey: true, toKey: true, kind: true, subject: true, resolved: true, createdAt: true },
  });

  return {
    agents: agents.map((a) => {
      const s = runs.find((r) => r.agentKey === a.key);
      return {
        ...a,
        meta: AGENTS[a.key],
        weekRuns: s?._count || 0,
        weekCost: s?._sum.costUsd || 0,
        recent: recent.filter((r) => r.agentKey === a.key).slice(0, 6),
      };
    }),
    messages,
    totals: {
      weekCost: runs.reduce((s, r) => s + (r._sum.costUsd || 0), 0),
      weekRuns: runs.reduce((s, r) => s + r._count, 0),
    },
  };
}
