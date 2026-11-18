import { forEachSite, cronGuard } from "@/lib/cron";
import { isWordPressConfigured } from "@/lib/wordpress";
import { profilesDue, fillProfile } from "@/lib/suppliers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Website and logo for supplier pages the publisher has just created.
//
// lib/suppliers.js marks a new page "due" and calls this straight away; the
// daily cron in vercel.json catches anything that call missed. Each page is
// tried once (lib/supplier-logo.js has the rules), so a page whose logo could
// not be confirmed stays on initials and costs nothing on later runs. Pages
// made by hand or by the backfill are never touched.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const stop = Date.now() + 270000;

  const out = await forEachSite(async ({ creds }) => {
    const wp = creds.wordpress;
    if (!isWordPressConfigured(wp)) return { skipped: "WordPress not configured" };
    const due = await profilesDue(wp);
    const done = [];
    for (const t of due) {
      if (Date.now() > stop - 40000) break;
      const r = await fillProfile(wp, t.id, t.name, { website: t.website });
      done.push({ name: t.name, ...r });
    }
    return { due: due.length, done };
  });
  return Response.json(out);
}
