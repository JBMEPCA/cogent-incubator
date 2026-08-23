// The Backlink Manager.
//
// Owns the whole loop from "we mentioned someone" to "they linked us": reads
// new articles for brand mentions, drafts the ask, watches the inbox for
// replies and watches their sites for the link. It does not send. Approval
// stays a human job on /outreach, so the agent's output is drafts and facts,
// never mail on the wire.
//
// It reports by name rather than by count. "3 emails sent" tells you nothing
// you can act on; "Malwarebytes replied, Sage has gone quiet for a fortnight"
// is the thing you would actually want to know.
import { forSite } from "../prisma";
import { runAgent } from "./runtime";

const list = (names, max = 6) => {
  if (!names.length) return "none";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} and ${names.length - max} more` : shown;
};

export async function runBacklink(site, trigger = "daily_sweep") {
  const db = forSite(site.id);
  return runAgent(site, "backlink", trigger, "Chasing links for new coverage", async ({ progress, say }) => {
    const {
      runBacklinkOutreach,
      runBacklinkCheck,
      runReplyCheck,
      runBounceCheck,
      isOutreachConfigured,
      outreachSetupHint,
      outreachStats,
    } = await import("../outreach");

    // The agent is handed a site row, not a context, so it fetches the title's
    // credentials once here and passes them down rather than letting each of the
    // four calls below decrypt them again.
    const { siteCredentials } = await import("../site");
    const { creds } = await siteCredentials(site.id);

    if (!isOutreachConfigured(creds)) {
      return { summary: `Standing by: ${outreachSetupHint(creds)}` };
    }

    // Everything sent since the last turn, captured before this run changes any
    // statuses, so the report covers the gap rather than the instant.
    const me = await db.agent.findFirst({ where: { key: "backlink" }, select: { lastRunAt: true } });
    const since = me?.lastRunAt || new Date(Date.now() - 86400000);
    const sentSince = await db.outreachEmail.findMany({
      where: { sentAt: { gte: since } },
      select: { brandName: true },
    });

    await progress("Reading new articles for brands we have written about");
    const drafted = await runBacklinkOutreach(site, creds);

    await progress("Checking which emails bounced");
    const bounces = await runBounceCheck(site, creds);

    await progress("Checking the inbox for replies");
    const replies = await runReplyCheck(site, creds);

    await progress("Checking their sites for the link");
    const links = await runBacklinkCheck(site);

    // Links from outside the outreach list, which is most of them. The check
    // above can only ever see the brands we emailed; this sees anyone who sent
    // us a reader.
    await progress("Looking for new sites sending us traffic");
    let referrers = { available: false, newly: [], found: [] };
    try {
      const { recordReferrers } = await import("../referrers");
      referrers = await recordReferrers(site, creds.google_analytics);
    } catch {
      // Same reasoning as the snapshot below: a GA4 wobble should not fail a
      // sweep whose drafting, bounce, reply and link checks have all succeeded.
    }

    // Written after the link check, so today's row already reflects anything
    // won in this sweep. Search Console only serves a rolling window, so this
    // is the only place the history comes from — a day not written here is a
    // day that cannot be recovered later.
    await progress("Recording today's authority snapshot");
    try {
      const { snapshotSearchMetrics } = await import("../metrics");
      const snap = await snapshotSearchMetrics(site, creds.google_analytics, 90);
      if (snap?.skipped) await progress("Authority snapshot skipped: " + snap.skipped);
    } catch (e) {
      // A Search Console wobble must not fail a sweep whose real work — the
      // drafting, the bounce, reply and link checks — has already succeeded.
      //
      // But it must not vanish either. This is the ONLY place the authority
      // history is written, and the comment above says why that matters: Search
      // Console serves a rolling window, so a day not written here is a day
      // that cannot be recovered later. A bare catch meant the graph could stop
      // updating for weeks with nothing anywhere to say it had.
      await say(
        "director",
        "Could not record the authority snapshot for " + site.name,
        e.message + ". Search Console history is written nowhere else, so days missed here are lost.",
        "conflict"
      );
    }

    const stats = await outreachStats(site.id);
    const emailed = sentSince.map((r) => r.brandName);

    // The Director gets the names. Anything that needs JB personally is flagged
    // as a question rather than a report, because those are the ones that sit in
    // the queue unread otherwise.
    const noInbox = "cannot see the inbox, gmail.readonly is not delegated";
    const lines = [
      `Emailed since the last sweep: ${list(emailed)}`,
      `Replied: ${replies.available ? list(replies.replied) : noInbox}`,
      `Bounced, nobody at that address: ${bounces.available ? list(bounces.bounced) : noInbox}`,
      `Links confirmed live: ${links.linked || "none"}`,
      // Named, not counted. A new referring domain is the one line in this
      // report worth reading on the day it appears, and "1 new referrer" is not
      // something anyone can act on.
      referrers.available
        ? `New sites linking to us: ${list(referrers.newly.map((r) => r.domain))} (${referrers.found.length} known in total)`
        : "New sites linking to us: no GA4 property set, so nothing to see",
      `Waiting on a reply: ${stats.sent - stats.linked}`,
      `Drafts waiting for approval: ${stats.pending}`,
    ];

    // Held back rather than sent, which is a different job from approving: these
    // need an address typed in, so they are worth naming separately from the
    // queue or they read as progress when they are actually stuck.
    const stuck = stats.bounced + stats.failed;
    if (stuck) lines.push(`Blocked on a bad or guessed address: ${stuck}`);

    if (stats.pending > 0) {
      await say(
        "director",
        `${stats.pending} outreach ${stats.pending === 1 ? "email" : "emails"} waiting for approval`,
        `${lines.join("\n")}\n\nNothing sends until JB approves it on /outreach.`,
        "question"
      );
    } else {
      await say("director", "Backlink sweep complete", lines.join("\n"), "report");
    }

    const parts = [];
    if (drafted.created) parts.push(`${drafted.created} new draft${drafted.created === 1 ? "" : "s"}`);
    if (replies.replied.length) parts.push(`${replies.replied.length} replied`);
    if (bounces.bounced.length) parts.push(`${bounces.bounced.length} bounced`);
    if (links.linked) parts.push(`${links.linked} linked`);
    if (!parts.length) parts.push("nothing new");

    return {
      summary: `${parts.join(", ")} (${stats.linked} links won from ${stats.sent} sent)`,
    };
  });
}
