import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { runAssistant } from "@/lib/assistant/run";
import { prismaStore, conversationView, clearConversation } from "@/lib/assistant/store";

export const dynamic = "force-dynamic";
// A request can read a few mailboxes and build a newsletter proof, which runs
// past a minute. The loop itself is capped at twelve tool calls.
export const maxDuration = 300;

// The home page prompt box. Admins only: the proxy already requires a session,
// and canEdit() is the boundary between a session and an account that may send
// mail and change posts.
async function caller() {
  const session = await auth();
  if (!session?.user?.id || !(await canEdit())) return null;
  return session.user.id;
}

/** The current conversation (or ?c=<id>), as the thread the page draws. */
export async function GET(request) {
  const userId = await caller();
  if (!userId) return Response.json({ error: "Admins only." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("c");
  return Response.json({ view: await conversationView(userId, id || null) });
}

/** Clear chat: start an empty conversation so a reload stays clear. */
export async function DELETE() {
  const userId = await caller();
  if (!userId) return Response.json({ error: "Admins only." }, { status: 403 });
  return Response.json({ view: await clearConversation(userId) });
}

/** Ask. Body: { prompt, conversationId? }. Answers with the updated thread. */
export async function POST(request) {
  const userId = await caller();
  if (!userId) return Response.json({ error: "Admins only." }, { status: 403 });
  const { prompt, conversationId } = await request.json().catch(() => ({}));
  const r = await runAssistant({ store: prismaStore, userId, conversationId: conversationId || null, prompt });
  const view = r.conversationId ? await conversationView(userId, r.conversationId) : null;
  return Response.json({ ...r, view }, { status: r.error && !r.conversationId ? 400 : 200 });
}
