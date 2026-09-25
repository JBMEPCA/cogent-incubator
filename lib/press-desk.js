// What the press desk decided, for a human to look at.
//
// The desk itself (lib/press-intake.js) runs with nobody in the loop, which is
// the point: a release is live within the hour or it is not worth having. But
// JB's titles are moving to majority PR-fed, and a judgement that nobody ever
// sees is a judgement nobody can correct. So this reads back every release the
// desk has handled across every title, says plainly which were used and which
// were not, and gives the reason for each.
//
// Read-only. The pushing back the other way lives in lib/press-actions.js.
//
// Everything here comes from rows the desk already writes — one FeedItem per
// email, keyed `gmail:<message id>`, and the Article it became. Nothing new is
// stored for this screen except the sender line below, because a screen about
// who wrote to us that cannot name them is not much of a screen.
import { fleetRead, prisma } from "./prisma";
import { siteUrl } from "./site-url";

// The sender, written onto the FeedItem summary by the desk.
//
// FeedItem has no column for it and this is a live database with ten titles'
// work in it, so a migration for one display field is the wrong trade. The
// summary already carries `[skipped: ...]` the same way; this follows it.
// Rows written before 25 Sep 2026 have no sender line and show a dash.
export const fromLine = (a) =>
  a?.email ? `[from: ${a.name ? `${a.name} ` : ""}<${a.email}>]` : "";

/** Pull the desk's own annotations back off a summary. */
export function pressMeta(summary) {
  const text = String(summary || "");
  const from = text.match(/^\[from: (?:([^<\]]*?)\s*)?<([^>\]]+)>\]/m);
  const skipped = text.match(/^\[skipped: ([^\]]*)\]/m);
  return {
    fromName: from?.[1]?.trim() || null,
    fromEmail: from?.[2]?.trim() || null,
    skipped: skipped?.[1]?.trim() || null,
    // The release itself, with our annotations taken back off the front.
    body: text.replace(/^\[(from|skipped): [^\]]*\]\s*/gm, "").trim(),
  };
}

// Marks an AgentRun as a push that is still running. lib/press-intake.js opens
// one before it answers the browser and closes it when the release lands, so an
// open run with this prefix is the only "working on it" state there is.
export const PUSH_MARK = "pushing:";

export const OUTCOMES = {
  live: { label: "Published", chip: "chip-audience", used: true },
  scheduled: { label: "Scheduled", chip: "chip-brand", used: true },
  held: { label: "Held", chip: "chip-monetise", used: false },
  rejected: { label: "Not used", chip: "chip-general", used: false },
  pending: { label: "In progress", chip: "chip-content", used: false },
};

/**
 * Why a release is sitting in Held.
 *
 * Three different things land here and they need different answers from a
 * human, so the reason has to distinguish them rather than say "needs review":
 * an embargo nobody could read is a decision to make, a quality gate refusal is
 * a draft to re-run, and a missing picture is a file to go and find.
 */
function holdReason(article) {
  if (!article) return "Held before drafting — usually an embargo whose time could not be read with certainty.";
  if (!article.body) return "Held before a draft was written.";
  let report;
  try {
    report = JSON.parse(article.qaReport || "{}");
  } catch {
    return String(article.qaReport || "").slice(0, 300) || "Held by the quality gate.";
  }
  const faults = (report.mechanical || []).filter(Boolean).slice(0, 3).join(" ");
  const said = [report.summary, faults].filter(Boolean).join(" ").trim();
  return said.slice(0, 400) || "Held by the quality gate, with no reason recorded.";
}

/** The photo line the desk writes into its own run summary. Worth surfacing:
    a release whose pictures were behind a Drive link falls silently to stock,
    and this is the only place that says so. */
function photoNote(summary) {
  return String(summary || "").match(/\[photo: ([^\]]*)\]/)?.[1] || null;
}

/**
 * Every release the desk has handled, newest first, across the whole group.
 *
 * Dry-run rows are excluded. scripts/press-dry-run.mjs --sample writes real
 * FeedItems keyed `gmail:dry-<timestamp>`, its --cleanup was blocked by the
 * tenant guard, and eighteen of them are still in the database. They look
 * exactly like held releases, and on a screen with a publish button that is not
 * a cosmetic problem: pushing one would put a stale Toyota release live on
 * Fleet.
 */
export async function pressBoard({ days = 30, titleSlug = null } = {}) {
  const db = fleetRead();
  const since = new Date(Date.now() - days * 864e5);
  const now = new Date();

  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  const bySiteId = new Map(sites.map((s) => [s.id, s]));
  const wanted = titleSlug ? sites.find((s) => s.slug === titleSlug) : null;

  const items = await db.feedItem.findMany({
    where: {
      link: { startsWith: "gmail:" },
      NOT: { link: { startsWith: "gmail:dry-" } },
      discoveredAt: { gte: since },
      ...(wanted ? { siteId: wanted.id } : {}),
    },
    include: {
      brand: { select: { name: true, prContactName: true, prContactEmail: true } },
      articles: {
        select: {
          id: true, title: true, status: true, body: true, qaPassed: true, qaReport: true,
          wpPostId: true, publishedAt: true, costUsd: true, imageUrl: true, category: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { discoveredAt: "desc" },
    take: 500,
  });

  // The desk's own run summaries, for the photo line. One query, not one per row.
  const articleIds = items.flatMap((i) => i.articles.map((a) => a.id));
  const runs = articleIds.length
    ? await db.agentRun.findMany({
        where: { trigger: { in: ["press", "press-push"] }, articleId: { in: articleIds } },
        select: { articleId: true, summary: true, startedAt: true },
        orderBy: { startedAt: "desc" },
      })
    : [];
  const runByArticle = new Map();
  for (const r of runs) if (!runByArticle.has(r.articleId)) runByArticle.set(r.articleId, r);

  // Pushes in flight. An open press-push AgentRun names the feed item it is
  // working on, so a row being written shows as working rather than as a button
  // to press again. Ten minutes because reapStaleRuns closes a run whose
  // function was killed, and a row must never be stuck looking busy for ever.
  const openPushes = await db.agentRun.findMany({
    where: { trigger: "press-push", endedAt: null, startedAt: { gte: new Date(Date.now() - 10 * 60000) } },
    select: { summary: true, startedAt: true },
  });
  const pushing = new Map();
  for (const r of openPushes) {
    // Plain string work rather than a built regex: `\S` inside a template
    // literal is not an escape JavaScript knows, so it collapses to a literal S
    // and the pattern silently matches nothing at all.
    const s = String(r.summary || "");
    if (!s.startsWith(PUSH_MARK)) continue;
    pushing.set(s.slice(PUSH_MARK.length).split(/\s/)[0], r.startedAt);
  }

  const rows = items.map((item) => {
    const site = bySiteId.get(item.siteId);
    const article = item.articles.find((a) => a.status === "published") || item.articles[0] || null;
    const meta = pressMeta(item.summary);

    let outcome = "pending";
    if (article?.status === "published") outcome = article.publishedAt > now ? "scheduled" : "live";
    else if (item.status === "dismissed") outcome = "rejected";
    else if (item.status === "shortlisted") outcome = "held";

    const host = site ? siteUrl(site) : null;
    return {
      id: item.id,
      siteSlug: site?.slug || null,
      siteName: site?.name || "—",
      siteAccent: site?.accentHex || null,
      subject: item.title,
      receivedAt: item.publishedAt || item.discoveredAt,
      handledAt: item.discoveredAt,
      fromName: meta.fromName || item.brand?.prContactName || null,
      fromEmail: meta.fromEmail || item.brand?.prContactEmail || null,
      company: item.brand?.name?.startsWith("Press desk (") ? null : item.brand?.name || null,
      outcome,
      // Why it went the way it did, in the words the desk itself recorded.
      reason: outcome === "rejected" ? meta.skipped : outcome === "held" ? holdReason(article) : null,
      articleId: article?.id || null,
      articleTitle: article?.title || null,
      category: article?.category || null,
      // ?p=<id> is the one URL that works without storing the permalink:
      // WordPress resolves it to whatever the slug turned out to be.
      articleUrl: host && article?.wpPostId && outcome === "live" ? `${host}/?p=${article.wpPostId}` : null,
      goLiveAt: outcome === "scheduled" ? article.publishedAt : null,
      costUsd: article?.costUsd ?? null,
      photo: photoNote(runByArticle.get(article?.id)?.summary),
      // Being written right now, by a person's click.
      pushing: pushing.get(item.id) || null,
      // Held before a draft existed is the unclear-embargo hold, and the only
      // one a second click can answer. It used to be worked out from what the
      // action returned; now that the action returns before the work is done,
      // the answer has to come off the row.
      needsForce: outcome === "held" && !article?.body,
      // Pushing a release a week after it was sent is rarely what anyone
      // means, so the button asks twice past this age.
      stale: Date.now() - new Date(item.discoveredAt).getTime() > 72 * 3600000,
      // A row the desk claimed and never finished — a tick killed mid-write, or
      // a crash. It clears itself within a tick or two; past an hour it is
      // stuck, and the only way out is to run it again.
      stuck: Date.now() - new Date(item.discoveredAt).getTime() > 3600000,
    };
  });

  const count = (fn) => rows.filter(fn).length;

  // Every penny the desk spent, including on the releases it threw away.
  // Deliberately not netted off against the dry-run rows above: those were run
  // by scripts/press-sample.mjs, which writes no AgentRun at all, so none of
  // this is theirs.
  const spend = await db.agentRun.aggregate({
    where: { trigger: { in: ["press", "press-push"] }, startedAt: { gte: since }, ...(wanted ? { siteId: wanted.id } : {}) },
    _sum: { costUsd: true },
  });

  const used = count((r) => OUTCOMES[r.outcome].used);
  const totals = {
    received: rows.length,
    live: count((r) => r.outcome === "live"),
    scheduled: count((r) => r.outcome === "scheduled"),
    held: count((r) => r.outcome === "held"),
    rejected: count((r) => r.outcome === "rejected"),
    pending: count((r) => r.outcome === "pending"),
    used,
    spendUsd: spend._sum.costUsd || 0,
    // Every penny the desk spent this window over the pieces that made it out
    // — the sorting spent on the ones it threw away included, because that is
    // what a usable piece actually costs.
    perUsedUsd: used ? (spend._sum.costUsd || 0) / used : null,
  };

  const byTitle = sites
    .map((s) => {
      const mine = rows.filter((r) => r.siteSlug === s.slug);
      return {
        slug: s.slug,
        name: s.name,
        site: s,
        received: mine.length,
        live: mine.filter((r) => r.outcome === "live").length,
        held: mine.filter((r) => r.outcome === "held").length,
        rejected: mine.filter((r) => r.outcome === "rejected").length,
      };
    })
    .filter((t) => t.received > 0 || !titleSlug);

  const lastRun = await db.agentRun.findFirst({
    where: { trigger: { in: ["press", "press-push"] } },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });

  return { rows, totals, byTitle, days, titleSlug, lastRunAt: lastRun?.startedAt || null };
}

/**
 * Whether the "you're live" reply is actually being sent.
 *
 * It defaults to `draft` — replies are written into the press@ Drafts folder
 * and nothing leaves the building — and the default is the current fleet state,
 * because the setting has never been written. Anyone looking at a screen that
 * offers to "push it and email them back" needs to know that.
 */
export async function replyMode() {
  const row = await prisma.globalSetting.findUnique({ where: { key: "press_link_ask" } }).catch(() => null);
  const v = String(row?.value || "").trim().toLowerCase();
  return ["draft", "send", "off"].includes(v) ? v : "draft";
}

export const REPLY_MODE_NOTE = {
  draft: "Replies are written into the press@ Drafts folder and not sent. Nobody is being thanked automatically.",
  send: "The sender is emailed the link as soon as a release goes live.",
  off: "No reply is sent to senders at all.",
};
