// Editor, Graphic Designer, SEO Expert, Finance Manager and Director.
// The first three wrap logic already proven in lib/ rather than reimplementing
// it; the value here is that each now has a goal, a state and an audit trail.
import { forSite } from "../prisma";
import { runAgent, say } from "./runtime";
import { titleBrief, editorialStandard } from "../voice";
import { buildCostReport, FINANCE_REPORT_KEY } from "./costs";

/* ------------------------------------------------- held articles, swept */

// QA holding a draft used to be the end of it. A held article sits at review
// with qaPassed false, publish-due will not touch it, nothing re-drafts it, and
// it waits for a human who is deliberately not in this loop: "SIC Codes" sat
// like that overnight purely because the draft had been cut off mid-sentence.
//
// So a held article goes back to the queue and is written again. Three attempts
// and no more, because a topic that fails QA three times is not a flaky draft,
// it is a bad topic, and retrying for ever would just bill for the same
// rejection every hour. The attempt count is the number of Editor runs against
// the article: those are recorded whether the draft passed or was held, so
// nothing extra needs storing.
//
// No model call here. It is a sweep, and it runs before the Director so a
// recovered article is back in the queue in time for the same tick to write it.
// Was 3. Dropped to 2 on 18 Aug 2026 on cost evidence, not taste.
//
// Over the previous 8 days, passes beyond the first cost $7.23 on Smart SME —
// 30% of everything that title spent — and 24 of its 53 drafted articles went
// round more than once. Fleet, which re-edits less, ran at half the cost per
// published article on the same code.
//
// 2 means one draft plus one repair. The repair pass is where nearly all the
// value is: an article that is still held after being told once what is wrong
// is usually wrong at the brief, not the prose, and a third pass mostly buys a
// more expensive way of reaching the same hold.
//
// Articles are parked as "idea", not deleted, so nothing is lost and the
// research survives for a recommission.
const MAX_DRAFT_ATTEMPTS = 2;

export async function sweepHeldArticles(site) {
  const db = forSite(site.id);
  const held = await db.article.findMany({
    where: { status: "review", qaPassed: false },
    select: { id: true, title: true },
  });

  const result = { retried: 0, abandoned: 0 };
  for (const a of held) {
    // Attempts within THIS drafting cycle, not across the article's whole life.
    //
    // Counting every Editor run ever meant a parked article could never come
    // back: recommission it, give it a proper brief and a real source, and it
    // is abandoned again on the first tick because the counter still holds the
    // three failures from the original attempt. The Claude watermarking piece
    // was permanently unpublishable that way — redrafted successfully from a
    // verified source at 15:45 on 17 August, parked three minutes later having
    // been allowed no repair pass at all.
    //
    // A fresh draft starts a fresh cycle, so only count from the most recent
    // one. Old runs stay on the record for costing; they just stop voting.
    const lastDraft = await db.agentRun.findFirst({
      where: { agentKey: "editor", articleId: a.id, summary: { startsWith: "Drafted" } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    const attempts = await db.agentRun.count({
      where: {
        agentKey: "editor",
        articleId: a.id,
        ...(lastDraft ? { startedAt: { gte: lastDraft.startedAt } } : {}),
      },
    });

    if (attempts >= MAX_DRAFT_ATTEMPTS) {
      // Parked, not deleted. Nothing picks "idea" up again, so it leaves the
      // pipeline without throwing away the research behind it.
      await db.article.update({
        where: { id: a.id },
        data: { status: "idea", scheduledFor: null },
      });
      await say(
        "editor",
        "director",
        `Gave up on "${a.title.slice(0, 60)}"`,
        `QA held it ${attempts} times. Parked as an idea rather than drafted again.`,
        "conflict"
      );
      result.abandoned++;
    } else {
      // Body and report deliberately kept. They are what the Editor repairs
      // against: clearing them here is what forced a full rewrite and turned a
      // lowercase "royal Mail" into a binned article three drafts later.
      await db.article.update({
        where: { id: a.id },
        data: { status: "drafting", scheduledFor: null },
      });
      result.retried++;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ editor */

export async function runEditor(site, trigger = "topic_commissioned") {
  const db = forSite(site.id);
  return runAgent(site, "editor", trigger, "Writing the next commissioned article", async ({ progress, say }) => {
    // Anything carrying a brief was asked for by name, so it is written first;
    // everything else is oldest first. Without this a request would join the back
    // of a queue a dozen deep and not be written for days, which would make
    // commissioning it pointless.
    const article =
      (await db.article.findFirst({
        where: { status: "drafting", brief: { not: null } },
        orderBy: { createdAt: "asc" },
      })) ||
      (await db.article.findFirst({
        where: { status: "drafting" },
        orderBy: { createdAt: "asc" },
      }));
    if (!article) return { summary: "Nothing commissioned, queue empty" };

    // A piece that already has a body and a verdict was held by QA, not
    // commissioned from scratch. Rewriting it would throw away a good article
    // over a missing meta description, so the faults get fixed in place.
    const repairing = Boolean(article.body && article.qaReport);
    const drafting = await import("../drafting");

    let res;
    if (repairing) {
      await progress(`Fixing what QA flagged on "${article.title.slice(0, 55)}"`);
      try {
        res = await drafting.repairArticle(site, article.id);
      } catch (e) {
        // A repair that cannot start must never become the queue's problem.
        // The Editor always takes the oldest article in "drafting", so a throw
        // here means the same piece is picked again on the next tick and the
        // whole engine stops behind it: that is exactly how the site published
        // nothing between Saturday 13:35 and Monday morning. Falling back to a
        // full redraft costs a drafting call, which is worth far less than a
        // stalled queue, and it always leaves the article in a new state.
        await say("director", `Could not repair "${article.title.slice(0, 50)}"`,
          `${e.message}. Redrafting from scratch instead so the queue keeps moving.`, "report");
        await progress(`Repair failed, redrafting "${article.title.slice(0, 50)}"`);
        res = await drafting.draftArticle(site, article.id);
      }
    } else {
      await progress(`Drafting "${article.title.slice(0, 60)}"`);
      res = await drafting.draftArticle(site, article.id);
    }

    // A parked piece was not drafted and was not held: it was stopped, either
    // before writing because there was nothing to write from, or after a repair
    // that moved nothing. Reporting it as "Drafted but held" would put a piece
    // that cost nothing next to one that cost three Opus passes, in the same
    // words, in the summary line the daily report reads.
    if (res.parked) {
      await say(
        "director",
        `Parked "${res.title.slice(0, 60)}"`,
        (res.issues || []).join("; ").slice(0, 400),
        "report"
      );
      return {
        summary: `${res.unmoved ? "Parked, repair moved nothing" : "Parked before drafting"} "${res.title.slice(0, 55)}"`,
        articleId: article.id,
      };
    }

    if (!res.qaPassed) {
      await say("director", `QA held "${res.title.slice(0, 60)}"`, (res.issues || []).join("; ").slice(0, 400), "conflict");
    } else {
      await say("designer", `Draft ready: ${res.title.slice(0, 60)}`, "Needs a header image before it can be scheduled.", "request");
    }
    const verb = repairing ? (res.qaPassed ? "Fixed and passed" : "Fixed but still held") : res.qaPassed ? "Drafted" : "Drafted but held";
    return {
      summary: `${verb} "${res.title.slice(0, 60)}"`,
      articleId: article.id,
    };
  });
}

/* -------------------------------------------------------------- designer */

// How many goes the Designer gets at one article before it stops and asks for
// help. There was no limit: an article the picture gate would never pass was
// re-searched every half hour for as long as it sat in the queue, and the two
// worst cases ran twelve and six times, each reporting success. The cap is what
// turns that into one legible request for art direction.
// Two, not four. With the gate defaulting to yes, a picture that is going to
// be found is found on the first go; four attempts simply bought four rounds
// of an argument the gate no longer has. The picture desk spent £0.76 of a
// £2.25 day on 28 August and £4 across the bank holiday for one article.
const MAX_IMAGE_ATTEMPTS = 2;

/**
 * Whether the Designer has anything it can actually act on.
 *
 * The worker ladder used to ask a bare count - "any article with no image?" -
 * which stayed true after every waiting article had burned its four attempts.
 * The Designer then won the tick, announced "art direction needed" and did
 * nothing, every half hour, for the rest of the day. On 20 August 2026 that
 * no-op held the ladder above the Editor and Researcher on all three titles
 * at once: topic supply had been fixed the day before and never got a turn.
 * Same counting rule as runDesigner, so the two can never disagree.
 */
export async function imageWorkAvailable(db) {
  const waiting = await db.article.findMany({
    where: { status: { in: ["review", "approved"] }, imageUrl: null },
    take: 10,
    select: { id: true, updatedAt: true },
  });
  if (!waiting.length) return false;
  const runs = await db.agentRun.findMany({
    where: { agentKey: "designer", articleId: { in: waiting.map((a) => a.id) } },
    select: { articleId: true, startedAt: true },
  });
  return waiting.some(
    (a) => runs.filter((r) => r.articleId === a.id && r.startedAt >= a.updatedAt).length < MAX_IMAGE_ATTEMPTS
  );
}

export async function runDesigner(site, trigger = "draft_ready") {
  const db = forSite(site.id);
  return runAgent(site, "designer", trigger, "Sourcing a header image", async ({ progress, say }) => {
    // Newest first, as before, but skipping anything that has already had its
    // four goes — otherwise one unphotographable article at the front of the
    // queue blocks every article behind it, which is exactly what a retry limit
    // has to avoid. AgentRun.articleId is written when the article is picked,
    // so it counts attempts including the ones that crashed.
    const waiting = await db.article.findMany({
      where: { status: { in: ["review", "approved"] }, imageUrl: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        keyphrase: true,
        category: true,
        updatedAt: true,
        // The page the story was written from. The picture desk asks it for a
        // photograph before it asks a stock library.
        sourceUrl: true,
        sourceItem: { select: { link: true } },
      },
    });
    if (!waiting.length) return { summary: "Every article already has an image" };

    // Runs since the article was last touched, not runs ever — the same rule the
    // Editor's counter follows, for the same reason. An article the picture desk
    // has given up on is fixed by changing the thing it is searching against, so
    // rewriting the headline has to hand it a fresh set of attempts. A failed
    // attempt does not write to the article, so updatedAt still marks the last
    // real edit.
    const priorRuns = await db.agentRun.findMany({
      where: { agentKey: "designer", articleId: { in: waiting.map((a) => a.id) } },
      select: { articleId: true, startedAt: true },
    });
    const attemptsOn = (article) =>
      priorRuns.filter((r) => r.articleId === article.id && r.startedAt >= article.updatedAt).length;

    const article = waiting.find((a) => attemptsOn(a) < MAX_IMAGE_ATTEMPTS);
    if (!article) {
      return {
        summary: `${waiting.length} article(s) waiting on a picture, all past ${MAX_IMAGE_ATTEMPTS} attempts — art direction needed`,
      };
    }
    const attempt = attemptsOn(article);

    await progress(`Finding an image for "${article.title.slice(0, 55)}"`);
    const { chooseSmartImage, sourceImage } = await import("../images");

    // The source first. A press release publishes its photograph so that it
    // gets used, and it shows the actual product, site or people - which is
    // both a better picture than stock and the only picture that exists for a
    // named product. Nine finished articles were stuck on 28 August for want
    // of exactly this.
    // Why the source photo was not used is recorded, because a path that
    // fails silently cannot be diagnosed: three deploys were spent guessing at
    // this one before it said anything at all.
    const hostOfUrl = (u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return "the source";
      }
    };
    let srcNote = null;
    const src = article.sourceUrl || article.sourceItem?.link || null;
    if (src) {
      // Publishers included, on JB's instruction of 28 August: "I don't care
      // about rights to images right now, that'll be the best way." I had
      // defaulted them off on my own judgement, which cost Smart SME and Golf
      // a whole Sunday - every photograph they needed sat on hoteldive.com,
      // hospitalityinvestor.com and barberevo.com, and the engine was told not
      // to look. His call, clearly given, and narrowing it was not mine to make.
      const found = await sourceImage(site, src, { allowPublishers: true }).catch((e) => {
        srcNote = `source lookup failed: ${String(e.message).slice(0, 80)}`;
        return null;
      });
      if (!found && !srcNote) srcNote = `no usable photo found on ${hostOfUrl(src)}`;
      if (found) {
        const { verifyImage } = await import("../qa");
        const check = await verifyImage({
          site,
          imageUrl: found.url,
          title: article.title,
          keyphrase: article.keyphrase,
          fromSource: true,
        });
        if (!check.ok) srcNote = `source photo refused by the gate: ${check.reason}`;
        if (check.ok) {
          await db.article.update({
            where: { id: article.id },
            data: {
              imageUrl: found.url,
              imageAlt: check.altText,
              imageCredit: `Image: ${found.host}`,
              imageSource: `source:${found.host}`,
            },
          });
          return {
            summary: `Image taken from the source (${found.host}) for "${article.title.slice(0, 44)}"`,
            articleId: article.id,
          };
        }
      }
    }
    const { image, reason, tried } = await chooseSmartImage(site, {
      title: article.title,
      keyphrase: article.keyphrase,
      category: article.category,
      attempt,
    });

    if (!image) {
      // One message, on the last attempt, carrying what the gate actually said.
      // Reporting on every attempt produced six copies of the same sentence and
      // no information; reporting the invented sentence produced none at all.
      const lastGo = attempt + 1 >= MAX_IMAGE_ATTEMPTS;
      if (lastGo) {
        await say(
          "director",
          `No usable image after ${attempt + 1} attempts: "${article.title.slice(0, 50)}"`,
          [reason, ...(tried || []).map((t) => `- ${t}`)].filter(Boolean).join("\n") +
            "\n\nThis article will not publish without a picture. It needs art direction, a commissioned graphic, or a rewrite of the headline the picture desk is searching against.",
          "conflict"
        );
      }
      return {
        summary: `No image on attempt ${attempt + 1}/${MAX_IMAGE_ATTEMPTS} for "${article.title.slice(0, 42)}": ${reason}${srcNote ? ` | ${srcNote}` : ""}`,
        articleId: article.id,
      };
    }
    await db.article.update({
      where: { id: article.id },
      data: { imageUrl: image.url, imageAlt: image.alt, imageCredit: image.credit, imageSource: image.source },
    });
    return { summary: `Image approved for "${article.title.slice(0, 50)}"`, articleId: article.id };
  });
}

/* --------------------------------------------------------------- seo expert */

// Linking is this agent's standing brief, so its turn leads with the linking
// numbers and reports everything else afterwards. The old version summarised
// with whatever one sentence the model happened to return, which meant a sweep
// that found eleven unlinked brand mentions and a sweep that found none read
// exactly the same on the board.
//
// The import is no longer wrapped in .catch(() => ({})). That swallowed a
// genuine module error and quietly fell through to counting keyphrases, so a
// broken audit looked like a successful run with an odd summary.
export async function runSeo(site, trigger = "weekly_audit") {
  const db = forSite(site.id);
  return runAgent(site, "seo", trigger, "Auditing links and search performance", async ({ progress, say }) => {
    const { runSeoAudit, isSeoAgentConfigured, MIN_INTERNAL_LINKS } = await import("../seo-agent");
    const { siteCredentials } = await import("../site");
    const { creds } = await siteCredentials(site.id);
    if (!isSeoAgentConfigured(creds.wordpress)) {
      return { summary: "Standing by: the audit needs ANTHROPIC_API_KEY and this title's WordPress credentials" };
    }

    await progress("Checking every live article for internal links and unlinked brands");
    const res = await runSeoAudit(site, creds.wordpress);

    const parts = [];
    if (res.brandLinksFiled) parts.push(`${res.brandLinksFiled} brand link(s) queued`);
    if (res.internalFiled) parts.push(`${res.internalFiled} internal link(s) queued`);
    if (!res.brandLinksFiled && !res.internalFiled) parts.push("no new links needed");
    parts.push(`${res.postsAudited} live posts checked`);

    // The Director hears about link debt by name, not as a number. A count
    // tells you nothing you can act on; the titles tell you what is sitting on
    // the site unlinked right now.
    if (res.internalGaps) {
      await say(
        "director",
        `${res.internalGaps} live article(s) below ${MIN_INTERNAL_LINKS} internal links`,
        `Fixes are queued on /seo and need approval before they go live. Unlinked brand mentions found this sweep: ${
          res.brandsNamed?.length ? res.brandsNamed.join(", ") : "none"
        }.`,
        "report"
      );
    }

    // Kept from the old fallback: a published article with no focus keyphrase
    // cannot be tracked or optimised, and nothing else looks for them.
    const noKeyphrase = await db.article.count({
      where: { status: "published", keyphrase: null },
    });
    if (noKeyphrase) {
      await say("director", `${noKeyphrase} published articles have no focus keyphrase`,
        "These cannot be tracked or optimised until they do.", "report");
    }

    return { summary: `${parts.join(", ")}${res.summary ? `. ${res.summary}` : ""}`.slice(0, 300) };
  });
}

/* ---------------------------------------------------------------- finance */

// Advisory only, by explicit instruction: it reports and warns, and never
// blocks or downgrades another agent's work.
export async function runFinance(site, trigger = "daily_summary") {
  const db = forSite(site.id);
  return runAgent(site, "finance", trigger, "Costing the operation", async ({ think, progress, say }) => {
    await progress("Adding up spend per agent and per article");
    const report = await buildCostReport(site.id);

    await progress("Working out what to recommend");
    const advice = await think({
      maxTokens: 6000,
      system: `You are the Finance Manager of a small AI content operation. You are ADVISORY: you never block or downgrade another agent's work, you tell the Director what you see.

YOUR STANDING BRIEF is to drive down the cost of producing one article, and to keep driving it down. Cost per article is your number. Every report looks for the next saving, even when spend is comfortably inside the monthly target: "we are under budget" is not a finding, it is the starting position. Being inside the target only means the next saving is not urgent, never that you should stop looking.

THE ONE RULE: a saving that costs quality is not a saving, and proposing one is a failure of this job. The following are protected and must NEVER be what you propose cutting:
- Article length. The house standard is 1,800 to 2,600 words with a comparison table and an FAQ. Shorter articles are cheaper because output tokens dominate the bill, which makes "write less" the obvious lever and the forbidden one.
- The editorial and fact-check gates, or the revision pass. These exist because they have caught fabricated sources and defunct companies before publication. Their cost is the point.
- The picture gate that looks at actual pixels, or the resolution floor on header images.
- Publishing cadence. Fewer articles is a smaller bill, not a cheaper article.

WHERE THE REAL SAVINGS ARE. Look for work that is being done at a higher price than it needs, not for work being done at all:
- A mechanical call running on an expensive model. Routing, classifying, picking one of a shortlist and writing a search query are not editorial judgement and belong on the cheap tier.
- Effort or thinking set higher than a task needs. Thinking tokens bill at the output rate.
- The same context resent uncached across many calls, where prompt caching would apply.
- Duplicated work: two systems drafting the same queue, an agent retrying something that already succeeded, candidates fetched and then discarded.
- Failed runs. Every failure is spend with nothing published against it.
- Work that produces something nobody uses.

Give 2 to 4 recommendations, each genuinely actionable and grounded in the numbers supplied. Prefer a specific, named lever over generic advice like "monitor spend". Quantify the saving where the numbers support it, and say "unknown" where they do not. NEVER invent a figure.

If you genuinely cannot find a lever this cycle, say so plainly and name the single measurement that would let you find one next time, rather than padding with advice you cannot support.

Reply ONLY with JSON:
{"headline":"one sentence on the state of costs","recommendations":[{"title":"short","detail":"one or two sentences","saving":"e.g. ~$4/month, or null"}]}`,
      user: `Spend, last 30 days: $${report.spend30.toFixed(4)} across ${report.runs30} agent runs
Spend, last 7 days: $${report.spend7.toFixed(4)}
Published articles, 30 days: ${report.published30}
Cost per produced article (failures included), all in: ${report.perArticle ? "$" + report.perArticle.toFixed(3) : "nothing published yet"}

COST PER ARTICLE BY PIPELINE — this is the number your brief is about:
- Long-form batch publisher: ${report.perArticleScripted ? "$" + report.perArticleScripted.toFixed(3) + " each across " + report.scriptedCount + " article(s), $" + report.scriptedSpend30.toFixed(3) + " total" : "none recorded"}
- Agent pipeline: ${report.perArticleAgent ? "$" + report.perArticleAgent.toFixed(3) + " each, $" + report.agentSpend30.toFixed(3) + " total" : "none recorded"}
Target: about $0.20 per article (16p). The batch publisher writes the long
guides and is the expensive path by design; the agent pipeline writes shorter
pieces. Judge each against what it produces, and do not propose making the long
path cheaper by making it write short.
Projected monthly AI spend at current pace: $${report.projectedMonthly.toFixed(2)}
Fixed infrastructure per month: $${report.fixedMonthly.toFixed(2)}

By agent, last 30 days:
${report.byAgent.map((a) => `- ${a.key}: $${a.cost.toFixed(4)} over ${a.runs} runs (${a.share}% of spend), ${a.tokens.toLocaleString()} tokens`).join("\n")}

Failed runs in the last 30 days: ${report.failed30}${report.failedAgents.length ? ` (${report.failedAgents.join(", ")})` : ""}`,
    });

    let parsed = { headline: null, recommendations: [] };
    try {
      parsed = JSON.parse(advice.replace(/^```json?\s*|\s*```$/g, "").trim());
    } catch {
      const m = advice.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }

    // Persist for the Costs tab so the page never has to call the model itself.
    await db.engineSetting.upsert({
      // EngineSetting is keyed (siteId, key), so an upsert must name both.
      where: { siteId_key: { siteId: site.id, key: FINANCE_REPORT_KEY } },
      update: { value: JSON.stringify({ ...report, ...parsed, generatedAt: new Date().toISOString() }) },
      create: { key: FINANCE_REPORT_KEY, value: JSON.stringify({ ...report, ...parsed, generatedAt: new Date().toISOString() }) },
    });

    const worst = report.byAgent[0];
    if (worst && worst.share > 55 && report.spend30 > 1) {
      await say("director", `${worst.key} is ${worst.share}% of all spend`,
        `$${worst.cost.toFixed(2)} of $${report.spend30.toFixed(2)} over 30 days. Worth checking it is not retrying.`, "report");
    }
    if (report.failed30 > 3) {
      await say("director", `${report.failed30} failed agent runs in 30 days`,
        `Failures still cost tokens: ${report.failedAgents.join(", ")}.`, "report");
    }

    return {
      summary:
        `30 days: $${report.spend30.toFixed(2)} over ${report.runs30} runs` +
        (report.perArticle ? `, $${report.perArticle.toFixed(2)} per article` : "") +
        `, projecting $${report.projectedMonthly.toFixed(2)}/month`,
    };
  });
}

/* ---------------------------------------------------------------- director */

// Everything reports here. The Director's real job is arbitration: the SEO goal
// and the quality goal genuinely pull against each other, and something has to
// decide which wins for a given piece.
export async function runDirector(site, trigger = "tick") {
  const db = forSite(site.id);
  return runAgent(site, "director", trigger, "Reviewing the team", async ({ think, progress, say }) => {
    // Section coverage is measured against the title's live site, so the
    // Director needs its WordPress credential the same as the Editor does.
    const { siteCredentials } = await import("../site");
    const { creds } = await siteCredentials(site.id);

    await progress("Reading open reports from the team");
    const open = await db.agentMessage.findMany({
      where: { toKey: "director", resolved: false },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const proposed = await db.researchTopic.findMany({
      // JB's own suggestions are deliberately excluded: they are handled below,
      // and listing them here would let the Director strike out the very thing
      // it was asked for.
      where: { status: "proposed", source: { not: "jb" } },
      orderBy: [{ score: "desc" }],
      take: 10,
    });
    const inFlight = await db.article.count({ where: { status: "drafting" } });
    // The finished shelf, which the in-flight guard below cannot see. Without
    // this the Director kept commissioning at full pace after the daily targets
    // were halved on 22 August: the weekend wrote 42 articles into 12 slots at
    // 25p each, and the surplus became an 18-article bank. Two days of stock is
    // a buffer; more is money turned into news that publishes stale. JB's own
    // requests still bypass this, exactly as they bypass the in-flight guard.
    const SHELF_DAYS = 2;
    const banked = await db.article.count({
      where: { status: { in: ["review", "approved"] }, qaPassed: true },
    });
    const shelfFull = banked >= SHELF_DAYS * Math.max(1, Math.round(Number(site.articlesPerDayTarget) || 3));
    const needsImage = await db.article.count({ where: { status: { in: ["review", "approved"] }, imageUrl: null } });

    const actions = [];

    // A suggestion from JB jumps the queue and ignores the backlog guard below.
    // That guard exists to stop the team drafting speculative work nobody asked
    // for, and a request from the publisher is the opposite of speculative — with
    // a dozen articles already in flight it would otherwise never be picked up at
    // all. Oldest first, one per tick, so a burst of ideas still comes out in the
    // order they were asked for.
    const requested = await db.researchTopic.findFirst({
      where: { status: "proposed", source: "jb" },
      orderBy: { createdAt: "asc" },
    });
    if (requested) {
      const { alreadyCovered } = await import("./dedupe");
      const clash = await alreadyCovered(site, requested.title);
      if (clash) {
        // Even JB's own requests get this check. Writing the same guide twice
        // helps nobody, and two near-identical pages compete with each other in
        // search rather than adding a second entry point.
        await db.researchTopic.update({
          where: { id: requested.id },
          data: { status: "rejected", rationale: `Already covered by "${clash.title}" (${clash.status})` },
        });
        await say("director", `Skipped a request already covered`, `"${requested.title}" duplicates "${clash.title}"`, "report");
        actions.push(`skipped duplicate request "${requested.title.slice(0, 40)}"`);
      } else {
      await progress(`Commissioning JB's request: ${requested.title.slice(0, 50)}`);
      await db.article.create({
        data: {
          title: requested.title,
          type: "seo_original",
          status: "drafting",
          brief: requested.query || null,
        },
      });
      await db.researchTopic.update({ where: { id: requested.id }, data: { status: "commissioned" } });
      await say("editor", `Commissioned by JB: ${requested.title.slice(0, 60)}`, requested.query || null, "request");
      actions.push(`commissioned JB's request "${requested.title.slice(0, 50)}"`);
      }
    }

    // Commission work only when the queue is genuinely short. Drafting articles
    // nobody publishes is the most expensive mistake this system can make.
    //
    // The Researcher is deliberately given a wide brief so the site stays
    // topical and covers every kind of SME. The Director is the backstop: it
    // commissions the best fit and can strike out anything that has wandered
    // too far, rather than the Researcher self-censoring into a narrow rut.
    if (shelfFull) {
      actions.push(`shelf full (${banked} banked, target ${site.articlesPerDayTarget}/day) — commissioning nothing`);
    }
    if (!shelfFull && inFlight < 2 && proposed.length) {
      // Strike anything the site already covers before the model ever sees it.
      // Cheaper and more reliable than asking it to spot duplicates: this is an
      // exact lookup against the article table, not a judgement call, and it
      // stops the shortlist being filled with work already done.
      const { coverageCheck } = await import("./dedupe");
      const fresh = [];
      const nearMisses = new Map();
      for (const t of proposed) {
        const { certain, maybe } = await coverageCheck(site, t.title);
        if (certain) {
          await db.researchTopic.update({
            where: { id: t.id },
            data: { status: "rejected", rationale: `Already covered by "${certain.title}" (${certain.status})` },
          });
          actions.push(`struck duplicate "${t.title.slice(0, 40)}"`);
          continue;
        }
        // Close but not conclusive. Passed to the model with the article it
        // resembles rather than rejected here, because at this range the two
        // are as likely to be a genuine second angle as a repeat.
        if (maybe) nearMisses.set(t.id, maybe);
        fresh.push(t);
      }
      if (!fresh.length) {
        await say("researcher", "Every proposed topic is already covered", "The queue needs genuinely new ground, not variations on published articles.", "request");
      }
      // Keep a seat for a small-firm story.
      //
      // These score low and always will: `score` measures search opportunity,
      // and a rest home in Lyndhurst has none of it next to "best CRM for small
      // business UK". Their worth is the opposite thing, a named small company
      // with a real reason to link back, which is the one currency this site
      // cannot write its way to. Ranked on score alone they never reach the
      // shortlist and the whole lane is decorative. So one gets a seat whenever
      // one exists, taking the lowest-scoring ordinary topic's place. A seat,
      // not a pass: the Director still weighs it against the rest below and can
      // strike it out like anything else.
      const shortlist = fresh.slice(0, 6);
      if (!shortlist.some((t) => t.source === "chamber")) {
        const smallFirm = fresh.find((t) => t.source === "chamber");
        if (smallFirm) shortlist.splice(Math.max(0, shortlist.length - 1), 1, smallFirm);
      }
      if (shortlist.length) {
      const { sectionGaps, gapBriefing } = await import("../sections");
      const gaps = await sectionGaps(site, creds.wordpress);
      const quota = gapBriefing(gaps, site.sectionTarget);

      // The Director's standing brief is to hold the publication's shape, which
      // it cannot do without being shown the shape. Measured over commissions
      // rather than published articles so drift is caught while it is still
      // being commissioned, not a month later when it is already on the site.
      const recent = await db.article.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { type: true },
      });
      const wireShare = recent.length
        ? Math.round((recent.filter((a) => a.type === "pr_rewrite").length / recent.length) * 100)
        : 0;
      const shortBy = Object.fromEntries(gaps.map((g) => [g.name, g.commissionable ? g.short : 0]));
      const verdict = await think({
        maxTokens: 6000,
        system: `${titleBrief(site)}
${editorialStandard(site)}
You are the Director. The publication covers anything genuinely useful to those readers, across every one of its sections.

YOUR STANDING BRIEF is to hold the shape of the publication. This title is a reference library that also runs a newsroom, and the newsroom is the half that gives a reader a reason to come back tomorrow and puts it on the media lists PR agencies work from. Left alone that balance drifts towards evergreen every time, because a guide can always be commissioned and news can only be found. Catching that drift is your job and nobody else's: no other agent sees the mix.

THE TARGET is roughly one commission in three coming from the wire. The current figure is given to you below.
- Below target: when a wire topic is anywhere near the best on merit, commission it.
- At or above target: judge purely on merit and ignore the mix entirely.
- NEVER commission a weak wire item to hit the number, and never strike out a strong topic because the mix already looks healthy. The mix is a tiebreak, exactly like the section quota.

THE HARD LINE, which outranks the target: news must be tied to a real event actually on the wire. You cannot commission news into existence. If nothing on the wire is worth writing, commission the best guide and let the figure sit low. A fabricated or backdated news story is a far worse outcome than a quiet week, and the section quota is deliberately built so it can never ask you for one. The formats and their tiers are in the editorial standard above, and you may never promote a format up a tier.

Range is wanted, so judge generously. Only strike a topic out if it genuinely serves someone other than the readers named at the top of this prompt: general consumer advice, or personal finance wearing a professional hat. The size of the organisation in a story is NOT grounds to strike it out — who this title serves is set by the readers line and by nothing else.
${quota ? `\n${quota}\n\nThe quota breaks ties. When two topics are close in merit, commission the one that fills a short section; when they are not close, commission the better one. Never strike a topic out for being in a full section.\n` : ""}
From the numbered shortlist, choose the ONE to commission now, and list any that should be struck out.

Reply ONLY with JSON: {"commission": <index>, "why": "one sentence", "reject": [{"index": <n>, "reason": "one sentence"}]}`,
        user: `NEWS MIX, last ${recent.length} commissions: ${wireShare}% came from the wire (target about 33%).${
          wireShare < 33 ? " BELOW TARGET, so a wire topic close on merit should win." : " At or above target, so judge on merit alone."
        }\n\n${shortlist
          .map(
            (t, i) =>
              `${i}. ${t.title}\n   section: ${t.category || "unassigned"}${
                shortBy[t.category] ? ` (SHORT by ${shortBy[t.category]})` : ""
              }, source: ${t.source}, score ${t.score ?? "n/a"}\n   ${t.rationale || ""}${
                nearMisses.has(t.id)
                  ? `\n   ⚠ CLOSE TO AN EXISTING ARTICLE: "${nearMisses.get(t.id).title}". Strike this out if it would say the same things; commission it only if it is a genuinely different angle that the existing piece does not cover.`
                  : ""
              }`
          )
          .join("\n\n")}`,
      });

      let ruling = {};
      try {
        ruling = JSON.parse(verdict.replace(/^```json?\s*|\s*```$/g, "").trim());
      } catch {
        const m = verdict.match(/\{[\s\S]*\}/);
        if (m) try { ruling = JSON.parse(m[0]); } catch {}
      }

      for (const r of Array.isArray(ruling.reject) ? ruling.reject : []) {
        const t = shortlist[r.index];
        if (!t) continue;
        await db.researchTopic.update({ where: { id: t.id }, data: { status: "rejected", rationale: r.reason || t.rationale } });
        await say("researcher", `Struck out: ${t.title.slice(0, 55)}`, r.reason, "ruling");
        actions.push(`struck out "${t.title.slice(0, 40)}"`);
      }

      const pick = shortlist[Number.isInteger(ruling.commission) ? ruling.commission : 0] || shortlist[0];
      if (pick && pick.status !== "rejected" && !(ruling.reject || []).some((r) => shortlist[r.index]?.id === pick.id)) {
        // A wire pick is a news rewrite, not an SEO original, and the two are
        // written from entirely different prompts in lib/drafting.js. Hardcoding
        // seo_original here meant every news peg the Researcher found was drafted
        // as an evergreen guide, which is half of why the News section has stayed
        // empty. The other half is the quota, which deliberately cannot push News.
        //
        // Matched on title because ResearchTopic carries no link back to the item;
        // a feedItemId column on ResearchTopic is the durable fix. If no item
        // matches, this falls back to seo_original rather than drafting a news
        // piece with no source behind it: a pr_rewrite without a real event is
        // exactly what docs/editorial-standard.md forbids.
        //
        // A small-firm pick is the same shape and needs the same treatment, but
        // it is matched on the LINK: proposeSmallFirmStories writes the source
        // item's URL into `query`, which is exact where a title match is a
        // guess. It also means `query` must not reach `keywords` below, because
        // the Editor is told to work keywords into the headline and a URL there
        // ends up in the title.
        const chamberPick = pick.source === "chamber";
        // The id first, the title match only as a fallback.
        //
        // This used to resolve a wire-sourced topic by exact title match on
        // pick.query, and query does not hold a headline: the Researcher writes
        // a composite there, like
        //   "Wire: water, irrigation and sustainability - Drone images reveal..."
        // so findFirst never matched, wireItem came back null, and a news story
        // was commissioned as an evergreen guide with nothing to cite. Three
        // golf articles died that way on 19 August at roughly £0.40 each, each
        // refused for exactly the fault this lookup was supposed to prevent.
        //
        // ResearchTopic.sourceItemId now carries the id the Researcher resolved,
        // so the normal path is a primary-key read. The title match stays for
        // topics proposed before that existed.
        const wireItem = chamberPick
          ? pick.query
            ? await db.feedItem.findFirst({ where: { link: pick.query } })
            : null
          : pick.sourceItemId
            ? await db.feedItem.findFirst({ where: { id: pick.sourceItemId } })
            : pick.source === "wire"
              ? await db.feedItem.findFirst({ where: { title: pick.query || pick.title } })
              : null;

        await db.article.create({
          // The section travels with the article. Without it the quota could
          // only ever be a wish: the Editor picks CATEGORY from the subject at
          // draft time, so a topic commissioned to fill Marketing could land in
          // Operations and the gap would still be open next tick. It also lets
          // sectionGaps() count this article as pending and stop the next three
          // research runs commissioning for the same hole.
          data: {
            title: pick.title,
            type: wireItem ? "pr_rewrite" : "seo_original",
            status: "drafting",
            keywords: chamberPick ? null : pick.query || null,
            // The angle the commissioning editor saw, so the Editor writes the
            // story that was picked rather than a general piece about the firm.
            brief: chamberPick ? pick.rationale || null : null,
            category: pick.category || null,
            sourceItemId: wireItem?.id || null,
            sourceUrl: wireItem?.link || null,
          },
        });
        // Claim the wire item so the next research run does not surface it again.
        if (wireItem) {
          await db.feedItem.update({ where: { id: wireItem.id }, data: { status: "drafted" } });
        }
        await db.researchTopic.update({ where: { id: pick.id }, data: { status: "commissioned" } });
        await say("editor", `Commissioned: ${pick.title.slice(0, 60)}`, ruling.why || pick.rationale, "request");
        actions.push(`commissioned "${pick.title.slice(0, 50)}"`);
      }
      }
    }

    if (needsImage) actions.push(`${needsImage} article(s) waiting on imagery`);

    // Rule on anything the team has escalated.
    if (open.length) {
      await progress(`Ruling on ${open.length} open report(s)`);
      const ruling = await think({
        maxTokens: 6000,
        system: `${titleBrief(site)}

You are the Director of the AI content team. Your team: Researcher (finds topics), SEO Expert (search performance), Editor (writes, refuses to publish invented facts), Graphic Designer (images), Finance Manager (advisory cost reporting).

Your job is to stop them undoing each other's work. The recurring tension: what maximises search performance is not always what makes an article good, and the quality gates will hold work that the SEO goal wants shipped. Decide which wins for each case, and be concrete.

Reply ONLY with JSON: [{"subject":"...","ruling":"one or two sentences","action":"none|retry|reject|escalate"}]`,
        user: `Open reports:\n${open.map((m) => `- from ${m.fromKey} [${m.kind}] ${m.subject}${m.body ? `: ${m.body.slice(0, 300)}` : ""}`).join("\n")}`,
      });
      let rulings = [];
      try {
        rulings = JSON.parse(ruling.replace(/^```json?\s*|\s*```$/g, "").trim());
      } catch {
        const m = ruling.match(/\[[\s\S]*\]/);
        if (m) try { rulings = JSON.parse(m[0]); } catch {}
      }
      for (const r of Array.isArray(rulings) ? rulings : []) {
        // No falling back to open[0]. An unmatched subject used to close
        // whichever report happened to be first, which resolved the wrong one
        // and left the real one open to be ruled on again next hour.
        const target = open.find((o) => o.subject === r.subject);
        if (!target) continue;
        await db.agentMessage.update({ where: { id: target.id }, data: { resolved: true } });
        // Never reply to yourself. A ruling addressed back to the Director
        // lands in its own inbox, gets ruled on next tick, and produces another
        // one: a transient API credit failure on 2 August was still being
        // re-ruled at full token cost two days later because of this.
        if (target.fromKey !== "director") {
          await say(target.fromKey, `Ruling: ${r.subject || target.subject}`.slice(0, 180), r.ruling, "ruling");
        }
        actions.push(`ruled on "${(r.subject || target.subject).slice(0, 40)}"`);
      }
      // Close everything read this tick, named in the rulings or not. Anything
      // the Director declined to rule on will not become more actionable by
      // being re-read every hour, and leaving it open was what let the inbox
      // grow to 47 stale reports it paid to reconsider each time.
      await db.agentMessage.updateMany({
        where: { id: { in: open.map((o) => o.id) }, resolved: false },
        data: { resolved: true },
      });
    }

    return {
      summary: actions.length ? actions.join("; ").slice(0, 300) : "Team on track, nothing to arbitrate",
    };
  });
}
