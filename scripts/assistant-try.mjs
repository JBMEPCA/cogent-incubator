// Try the home page assistant from a terminal, against live data, without its
// tables and without sending anything.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/assistant-try.mjs "first request" ["follow-up" ...]
//
// Conversations live in memory, sends to Lucas are dry runs, and proposals are
// printed but never confirmed. Model calls are real and cost real money (a few
// pence a request); reads of Gmail, Mailchimp and WordPress are real too.
import { runAssistant } from "../lib/assistant/run.js";
import { prisma } from "../lib/prisma.js";

function memoryStore() {
  const convs = new Map();
  const messages = [];
  const actions = [];
  let n = 0;
  const id = () => `mem${++n}`;
  return {
    actions,
    async conversation(cid) {
      return convs.get(cid) || null;
    },
    async createConversation(userId, title) {
      const c = { id: id(), userId, title, updatedAt: new Date() };
      convs.set(c.id, c);
      return c;
    },
    async history(cid) {
      return messages.filter((m) => m.cid === cid).map(({ role, content }) => ({ role, content }));
    },
    async appendMessage(cid, role, content) {
      messages.push({ cid, role, content: JSON.parse(JSON.stringify(content)) });
      convs.get(cid).updatedAt = new Date();
    },
    async startTurn() {
      return { id: id() };
    },
    async endTurn(tid, data) {
      console.log(`  turn: ${data.toolCalls.map((c) => `${c.name}${c.ok ? "" : "(failed)"}`).join(", ") || "no tools"}; ${data.inputTokens} in / ${data.outputTokens} out; $${data.costUsd.toFixed(4)}${data.error ? `; ERROR ${data.error}` : ""}`);
    },
    async createAction(data) {
      const a = { id: id(), ...data };
      actions.push(a);
      console.log(`  ACTION [${a.status}] ${a.tool}\n    ${String(a.preview).replace(/\n/g, "\n    ")}`);
      return a;
    },
    async actionsSince() {
      return [];
    },
    async spentToday() {
      return 0;
    },
    async dailyCap() {
      return 5;
    },
  };
}

const prompts = process.argv.slice(2);
if (!prompts.length) {
  console.error('Usage: ... scripts/assistant-try.mjs "request" ["follow-up" ...]');
  process.exit(1);
}

const store = memoryStore();
let conversationId = null;
let total = 0;
for (const prompt of prompts) {
  console.log(`\n> ${prompt}`);
  const r = await runAssistant({ store, userId: "try", conversationId, prompt, dryRun: true });
  conversationId = r.conversationId;
  total += r.costUsd || 0;
  console.log(r.error ? `  ERROR: ${r.error}` : `\n${r.reply}`);
}
console.log(`\nTotal $${total.toFixed(4)}`);
await prisma.$disconnect();
