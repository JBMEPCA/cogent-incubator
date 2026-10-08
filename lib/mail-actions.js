"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "./permissions";
import { listSites, getSiteContext } from "./site";
import { noteworthyMail } from "./mail-triage";
import { markRead } from "./gmail";

/**
 * "Mark all read" on the home page and /mail: every unread message in the
 * mail-worth-reading list, across every title, marked read in Gmail itself.
 * Only that list: marketing and automated mail the list hides are left as
 * they are. Mailboxes that refuse are named, and the rest still go through.
 */
export async function markAllMailRead() {
  await requireEditor();
  const sites = await listSites();

  const results = await Promise.all(
    sites.map(async (s) => {
      try {
        const ctx = await getSiteContext(s.slug);
        if (!ctx) return { name: s.name, count: 0 };
        // Same depth as the /mail page, so everything it shows is covered.
        const mail = await noteworthyMail(ctx.site, ctx.creds, ctx.db, { max: 40 });
        if (!mail.available) return { name: s.name, count: 0 };
        const ids = mail.items.filter((m) => m.unread).map((m) => m.id);
        const r = await markRead(ctx.creds?.outreach, ids);
        return r.ok ? { name: s.name, count: r.count } : { name: s.name, count: 0, error: r.reason };
      } catch (err) {
        return { name: s.name, count: 0, error: err.message };
      }
    })
  );

  revalidatePath("/");
  revalidatePath("/mail");

  const marked = results.reduce((n, r) => n + r.count, 0);
  const failed = results.filter((r) => r.error);
  const message =
    `Marked ${marked} message${marked === 1 ? "" : "s"} as read.` +
    (failed.length ? ` Couldn't change ${failed.map((r) => r.name).join(", ")}: ${failed[0].error}` : "");
  return { ok: failed.length === 0, message };
}
