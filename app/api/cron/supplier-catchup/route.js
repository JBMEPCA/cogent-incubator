import { forEachSite, cronGuard } from "@/lib/cron";
import { isWordPressConfigured } from "@/lib/wordpress";
import { catchUpSuppliers } from "@/lib/suppliers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Supplier pages for posts published outside the app's publish routes (see
// catchUpSuppliers in lib/suppliers.js). Hourly from the Cloudflare worker.
// Each title gets an equal share of the time, so one busy title cannot starve
// the rest.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const end = Date.now() + 240000;
  const out = await forEachSite(async ({ db, creds, index, total }) => {
    const wp = creds.wordpress;
    if (!isWordPressConfigured(wp)) return { skipped: "WordPress not configured" };
    const share = (end - Date.now()) / Math.max(1, total - index);
    return catchUpSuppliers(wp, db, { stop: Date.now() + share - 5000 });
  });
  return Response.json(out);
}
