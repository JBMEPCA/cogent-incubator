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

    if (!isOutreachConfigured()) {
      return { summary: `Standing by: ${outreachSetupHint()}` };
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
    const drafted = await runBacklinkOutreach();

    await progress("Checking which emails bounced");
    const bounces = await runBounceCheck();

    await progress("Checking the inbox for replies");
    const replies = await runReplyCheck();

    await progress("Checking their sites for the link");
    const links = await runBacklinkCheck();

    const stats = await outreachStats();
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
