"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireEditor } from "./permissions";
import { beginPush, runPush } from "./press-intake";

// The one thing the Press Releases page can change.
//
// Fleet-wide, so nothing is bound to a site: the release itself says which
// title it belongs to, and that is not something a form should be able to
// restate. requireEditor is the boundary — a viewer who found the action id
// cannot publish to ten magazines with it.
//
// The action ANSWERS IMMEDIATELY and does the work afterwards. Writing a
// release takes fifty to ninety seconds, and the first version simply returned
// when it was done: JB's first two pushes both ran correctly — one published to
// Gym Business News, one held again on a factual fault the gate was right about
// — and neither answer ever reached the browser, which sat on "Writing it
// up..." indefinitely. A request held open that long behind the auth proxy is
// not something to build on, so the outcome now goes to the database and the
// page reads it back. after() keeps the work running once the response is sent.

/**
 * useActionState-shaped: { ok, message }.
 *
 * Everything that can be refused is refused before returning — no such row,
 * already published, no WordPress, already being written — because those are
 * answers a person can act on. Once it is accepted, the row itself reports.
 */
export async function pushPressRelease(feedItemId, force, _prev, _formData) {
  await requireEditor();
  if (!feedItemId) return { ok: false, message: "No release given." };

  let start;
  try {
    start = await beginPush({ feedItemId });
  } catch (e) {
    return { ok: false, message: `It failed outright: ${e.message?.slice(0, 300) || e}` };
  }
  if (start.error) return { ok: false, message: start.error };

  after(async () => {
    try {
      await runPush(start, force === true);
    } catch (e) {
      // runPush closes its own run on every path it can reach. This is the one
      // it cannot: it is here so a crash is a log line rather than silence.
      console.error(`[press] push ${start.feedItemId} died: ${e?.message || e}`);
    }
  });

  revalidatePath("/press");
  return {
    ok: true,
    working: true,
    message: "Writing it now. It takes a minute or two, and this page will update itself when it lands.",
  };
}
