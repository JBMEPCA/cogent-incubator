"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "./permissions";
import { pushRelease } from "./press-intake";

// The one thing the Press Releases page can change.
//
// Fleet-wide, so nothing is bound to a site: the release itself says which
// title it belongs to, and that is not something a form should be able to
// restate. requireEditor is the boundary — a viewer who found the action id
// cannot publish to ten magazines with it.

/**
 * useActionState-shaped: ({ ok, message, url }).
 *
 * The result has to be readable, because this is the one button in the app that
 * both spends real money and puts something on a live website, and "done" would
 * not tell anyone which of those happened.
 */
export async function pushPressRelease(feedItemId, force, _prev, _formData) {
  await requireEditor();
  if (!feedItemId) return { ok: false, message: "No release given." };

  let r;
  try {
    r = await pushRelease({ feedItemId, force: force === true });
  } catch (e) {
    return { ok: false, message: `It failed outright: ${e.message?.slice(0, 300) || e}` };
  }
  revalidatePath("/press");

  if (r.error) return { ok: false, message: r.error };

  if (r.published) {
    // What happened to the reply matters as much as the post. linkAskMode
    // defaults to `draft`, so "emailed them back" is often "wrote it into the
    // press@ Drafts folder", and saying "sent" either way would be a lie.
    const reply =
      r.replied === "sent" ? "Sender emailed the link."
      : r.replied === "draft" ? "The thank-you is waiting in the press@ Drafts folder — it was not sent."
      : "No reply went out: no human address to write to, or replies are switched off.";
    return { ok: true, message: `Published. ${reply}`, url: r.published, cost: r.costUsd };
  }
  if (r.scheduled) {
    return {
      ok: true,
      cost: r.costUsd,
      message: `Written and scheduled for ${new Date(r.goLive).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — it is under embargo until then. The sender is thanked when it goes live.`,
    };
  }
  if (r.held) {
    return {
      ok: false,
      cost: r.costUsd,
      // The embargo hold is the one a second click can answer, so the page
      // needs to know that this particular no is not final.
      needsForce: Boolean(r.embargo),
      message: r.embargo
        ? "This release is embargoed and the date could not be read with certainty. Check the email, then publish it anyway if it is clear."
        : `Still held: ${r.held}. The selection was overridden, but the quote, figure and quality checks were not.`,
    };
  }
  if (r.skipped) return { ok: false, message: `Could not use it: ${r.skipped}`, cost: r.costUsd };
  return { ok: false, message: "Nothing came back from the desk.", cost: r.costUsd };
}
