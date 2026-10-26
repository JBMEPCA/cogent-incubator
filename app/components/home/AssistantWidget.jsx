import AssistantBox from "./AssistantBox";
import { auth } from "@/lib/auth";
import { conversationView } from "@/lib/assistant/store";

// The prompt box at the top of the home page: Lucas asks for small things and
// a tool loop on Vercel does them (lib/assistant). Admins only, because it can
// send mail and change posts; a viewer sees nothing at all.
export default async function AssistantWidget({ canEdit }) {
  if (!canEdit) return null;
  const session = await auth().catch(() => null);
  let view = null;
  let unavailable = null;
  try {
    view = await conversationView(session?.user?.id);
  } catch (e) {
    // Before the migration is applied the tables do not exist. Say so on the
    // card rather than taking the whole home page down.
    unavailable = /does not exist|P2021/.test(String(e?.message || e))
      ? "The assistant's tables are not in the database yet (migration 20261026120000_assistant)."
      : `The assistant could not load: ${String(e?.message || e).split("\n")[0]}`;
  }
  return <AssistantBox initial={view} unavailable={unavailable} />;
}
