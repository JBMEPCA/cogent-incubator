import { cronGuard, forEachSite } from "@/lib/cron";
import { forSite } from "@/lib/prisma";
import { applySuggestion } from "@/lib/seo-agent";
import { isWordPressConfigured } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The SEO Analyst's suggestions apply themselves.
//
// Before this, the audit ran twice a day and every link it found waited for a
// human to click it. 807 had banked up by 25 August; clearing them by hand
// took a one-off script and put 576 links on the sites in an afternoon. The
// audit then rebuilt 103 more overnight, which is the whole argument: a queue
// that refills faster than anyone empties it is not a review surface, it is a
// leak. JB's instruction on 26 August was one word, "sweep".
//
// Nothing here trusts the suggestion. applySuggestion re-reads the live post
// and refuses anything whose exact anchor text has moved, is already linked,
// or no longer exists — 231 of yesterday's 807 died that way, correctly. This
// route only decides WHEN to try, never WHETHER the edit is safe.
const PER_SITE_CAP = 25; // a day's audit is ~20 links per title
const WRITE_GAP_MS = 1300; // reads as editing, not scraping, to sg-security
const DEADLINE_MS = 210_000; // leaves room inside maxDuration for the last write
const ADVICE_EXPIRY_DAYS = 7;

// Links are mechanical and reversible. Titles and body copy change what a
// reader sees, so they stay on the dashboard for a human.
const AUTO_KINDS = ["internal_link", "brand_link"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const started = Date.now();

  return Response.json(
    await forEachSite(async ({ site, creds }) => {
      const db = forSite(site.id);

      // Advice is a note to a human, never an edit. It cannot be applied, so
      // left alone it accumulates for ever; 63 of the 115 cleared yesterday
      // were link advice the sweep itself had already made true.
      const stale = await db.seoSuggestion.updateMany({
        where: {
          status: "pending",
          kind: "advice",
          createdAt: { lt: new Date(Date.now() - ADVICE_EXPIRY_DAYS * 864e5) },
        },
        data: { status: "dismissed", error: `advisory only; expired after ${ADVICE_EXPIRY_DAYS} days unread` },
      });

      if (!isWordPressConfigured(creds?.wordpress)) {
        return { skipped: "no WordPress credential for this title", adviceExpired: stale.count };
      }

      const pending = await db.seoSuggestion.findMany({
        where: { status: "pending", kind: { in: AUTO_KINDS } },
        orderBy: { createdAt: "asc" },
        take: PER_SITE_CAP,
      });

      let applied = 0;
      let refused = 0;
      let deferred = 0;

      for (const suggestion of pending) {
        if (Date.now() - started > DEADLINE_MS) {
          deferred = pending.length - applied - refused;
          break;
        }
        try {
          await applySuggestion(site, suggestion, creds.wordpress);
          await db.seoSuggestion.update({
            where: { id: suggestion.id },
            data: { status: "applied", appliedAt: new Date(), error: null },
          });
          applied++;
        } catch (e) {
          // A refusal is the guard doing its job, not a fault: the copy moved,
          // or the anchor is already a link. Recorded so it is visible, and
          // left out of the pending count so it cannot be retried for ever.
          await db.seoSuggestion.update({
            where: { id: suggestion.id },
            data: { status: "failed", error: e.message?.slice(0, 300) },
          });
          refused++;
        }
        await sleep(WRITE_GAP_MS);
      }

      return { applied, refused, deferred, adviceExpired: stale.count };
    })
  );
}
