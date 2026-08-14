// Researcher: finds what to write next, from free sources only.
//
//  1. Search Console  - queries the site already impresses for. Anything ranking
//                       position 8-30 is an existing near-miss, which is far
//                       cheaper to win than a cold keyword.
//  2. Google autocomplete + People Also Ask - the actual phrasing people type.
//  3. The newswire     - 1,000+ ingested items for genuine news pegs.
//  4. Competitor gaps  - topics rivals cover that we do not.
//
// No paid keyword API: search volume is inferred from GSC impressions, which is
// real data for this site rather than a vendor's national estimate.
import { forSite } from "../prisma";
import { getGoogleAccessToken, googlePost, isGoogleConfigured } from "../google";
import { runAgent } from "./runtime";
import { titleBrief, userAgent } from "../voice";

// Set per title in runResearcher: a fleet magazine must not crawl as another
// publication's bot.
let UA = { "user-agent": "Mozilla/5.0 (compatible; CogentResearch/1.0)" };

/* -------------------------------------------------------- small firm lane */

// The backlink engine can only email the companies our articles name, and while
// the wire is Google, Microsoft and HMRC that is exactly who it emails: nine of
// nine sent, nothing won. Those companies were never going to link to a
// publication this size.
//
// Chamber of commerce and trade body feeds are the opposite seam. They are full
// of named local firms with a real story, no press office, and every reason to
// be pleased about national coverage and link to it unprompted. Nineteen live
// feeds and 191 ingested items were sitting unused.
//
// The risk is obvious, so the gate below is deliberately harsh: most chamber
// copy is membership notices and sponsorship of under-sevens football teams,
// and reprinting that would cost more in credibility than any link is worth.
const SMALL_FIRM_CATEGORIES = ["UK chambers", "Sector bodies", "Startup ecosystem"];
const SMALL_FIRM_PICKS = 2;
// Per publisher, so no single chamber can fill the slate on its own.
const SMALL_FIRM_PER_BRAND = 4;
const SMALL_FIRM_POOL = 60;

/*
 * Take a spread across publishers, not the most recent 30.
 *
 * There are 216 unread items in these categories and the lane was reading the
 * newest 30 of them. Chambers publish at wildly different rates, so that slate
 * was ten items from Edinburgh and nothing from the other thirty feeds, and it
 * only ever saw the last day or two: anything good that arrived while a busy
 * chamber was mid-flow was never looked at again. Round-robin by brand covers
 * far more of the pool for the same number of tokens.
 */
async function smallFirmCandidates(db) {
  const items = await db.feedItem.findMany({
    where: {
      status: "new",
      brand: { category: { in: SMALL_FIRM_CATEGORIES } },
    },
    orderBy: { discoveredAt: "desc" },
    take: 400,
    select: {
      id: true,
      title: true,
      summary: true,
      link: true,
      brand: { select: { name: true } },
    },
  });

  const perBrand = new Map();
  for (const i of items) {
    const key = i.brand?.name || "?";
    const list = perBrand.get(key) || [];
    if (list.length < SMALL_FIRM_PER_BRAND) list.push(i);
    perBrand.set(key, list);
  }
  // Interleave so the cap applies evenly rather than favouring whichever brand
  // happens to sort first.
  const lists = [...perBrand.values()];
  const out = [];
  for (let n = 0; n < SMALL_FIRM_PER_BRAND && out.length < SMALL_FIRM_POOL; n++) {
    for (const list of lists) {
      if (list[n] && out.length < SMALL_FIRM_POOL) out.push(list[n]);
    }
  }
  return out;
}

export async function proposeSmallFirmStories(site, think, say) {
  const db = forSite(site.id);
  const items = await smallFirmCandidates(db);
  if (items.length < 3) return { saved: 0, why: `only ${items.length} candidate items` };

  const raw = await think({
    maxTokens: 1200,
    system: `${titleBrief(site)}

You are the commissioning editor.

Below are items from chamber of commerce, trade body and startup feeds. You are looking for the rare one that names a REAL TRADING BUSINESS and carries something another SME owner would genuinely learn from: how they solved a problem, won work, handled a rule change, grew, or adopted something that worked.

THE FIRM MUST BE SMALL. Roughly under 50 staff: an independent business, a founder-led firm, a single-site operator, a young company. This is the whole point of the lane and it is the test most items fail. A plc, a household name, a national chain, a bank, a utility, a university spin-out with institutional backing, or a large accountancy, law or recruitment group does NOT qualify, however genuinely it trades. If you cannot tell the size from the item, judge on the signals you have: a firm described by its town, its founder, its trade or its staff count is probably small; one described by its market position, its national footprint or its group is not. When it is genuinely ambiguous, reject it.

REJECT, and reject most of them:
- any company big enough to have a press office (British Gas, Stagecoach and the like)
- membership announcements, "X joins the chamber", partner news
- sponsorship, charity days, awards, golf, football teams
- chamber's own events, training courses and networking
- anything about a university, council, chamber or trade body rather than a business
- generic guidance with no named company in it

A piece commissioned from this list must be able to stand up as national trade journalism about a named firm. If nothing clears that bar, return an empty array. Returning nothing is the correct and expected answer most of the time.

Reply ONLY with JSON:
[{"item":<the number of the item in the list>,"firm":"the company name","title":"a headline for OUR article","angle":"one sentence on what an SME reader takes away","score":<0-100>}]`,
    user: items
      .map((i, n) => `${n + 1}. [${i.brand?.name || "?"}] ${i.title}${i.summary ? ` — ${i.summary.slice(0, 200)}` : ""}`)
      .join("\n"),
  });

  let picks = [];
  let parseFailed = false;
  try {
    picks = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "").trim());
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) try { picks = JSON.parse(m[0]); } catch {}
    if (!Array.isArray(picks) || !picks.length) parseFailed = true;
  }
  // "Nothing cleared the bar" and "the reply did not parse" are the same zero
  // from the outside, and telling them apart later costs another paid run.
  if (parseFailed) return { saved: 0, why: `reply did not parse, ${raw.length} chars` };
  if (!Array.isArray(picks) || !picks.length) {
    return { saved: 0, why: `nothing cleared the bar out of ${items.length} items` };
  }

  let saved = 0;
  for (const p of picks.slice(0, SMALL_FIRM_PICKS)) {
    if (!p?.firm || !p?.title) continue;
    if (await db.researchTopic.findFirst({ where: { title: p.title } })) continue;

    // Carry the source item through. Writing about a REAL named small firm from
    // a headline alone is how you invent a turnover figure for a business that
    // can read the article, so the link travels with the topic and the Director
    // hands it to the Editor as source material to write from.
    const item = items[Number(p.item) - 1];

    await db.researchTopic.create({
      data: {
        title: p.title,
        category: "Case Studies",
        // Tagged so the trial can be measured against the ordinary wire lane
        // rather than disappearing into the same funnel.
        source: "chamber",
        query: item?.link || null,
        rationale: `${p.firm}: ${p.angle || "named small firm, reachable for outreach"}`,
        score: Number.isFinite(p.score) ? Math.max(0, Math.min(100, p.score)) : null,
      },
    });
    saved++;
  }

  if (saved) {
    await say("director", `${saved} small-firm ${saved === 1 ? "story" : "stories"} found`,
      picks.slice(0, saved).map((p) => `${p.firm}: ${p.title}`).join("; ").slice(0, 400), "request");
  }
  return {
    saved,
    why: saved ? null : `${picks.length} offered, all filtered as duplicates`,
  };
}

/* --------------------------------------------------------- search console */

async function gscOpportunities(ga) {
  const property = ga?.gscSiteUrl;
  if (!isGoogleConfigured() || !property) return [];
  try {
    const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
    const end = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 93 * 864e5).toISOString().slice(0, 10);
    const data = await googlePost(
      token,
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      { startDate: start, endDate: end, dimensions: ["query"], rowLimit: 250 }
    );
    return (data.rows || []).map((r) => ({
      query: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: r.position,
      ctr: r.ctr,
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------ autocomplete / questions */

async function autocomplete(seed) {
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=en-GB&gl=uk&q=${encodeURIComponent(seed)}`,
      { headers: UA, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.[1]) ? json[1] : [];
  } catch {
    return [];
  }
}

// Question-shaped variants are what win featured snippets, so probe the
// interrogative prefixes explicitly rather than hoping they surface.
async function questionsFor(seed) {
  const prefixes = ["how to", "what is", "do i need", "can i", "how much"];
  const out = new Set();
  for (const p of prefixes) {
    for (const s of await autocomplete(`${p} ${seed}`)) out.add(s);
    if (out.size > 40) break;
  }
  return [...out];
}

/* ------------------------------------------------------------- gap finding */

async function existingTitles() {
  const arts = await db.article.findMany({ select: { title: true }, take: 200 });
  return arts.map((a) => a.title);
}

function alreadyCovered(site, topic, titles) {
  const words = topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  if (!words.length) return false;
  return titles.some((t) => {
    const lt = t.toLowerCase();
    const hits = words.filter((w) => lt.includes(w)).length;
    return hits / words.length > 0.65;
  });
}

/* -------------------------------------------------------------- the agent */

export async function runResearcher(site, trigger = "tick") {
  const db = forSite(site.id);
  UA = { "user-agent": userAgent(site, "Research/1.0") };
  return runAgent(site, "researcher", trigger, "Finding topics worth covering", async ({ think, progress, say }) => {
    const { siteCredentials } = await import("../site");
    const { creds } = await siteCredentials(site.id);

    await progress("Reading Search Console for near-miss queries");
    const gsc = await gscOpportunities(creds.google_analytics);

    // Position 8-30 with real impressions: we are already visible, just not
    // winning. Cheapest possible ranking gains.
    const nearMiss = gsc
      .filter((r) => r.position >= 7.5 && r.position <= 30 && r.impressions >= 5)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 25);

    await progress("Pulling autocomplete and People Also Ask phrasing");
    const seeds = nearMiss.slice(0, 4).map((r) => r.query);
    if (!seeds.length) seeds.push("small business ai", "uk small business software");
    let questions = [];
    for (const s of seeds.slice(0, 4)) questions = questions.concat(await questionsFor(s));
    questions = [...new Set(questions)].slice(0, 60);

    await progress("Checking the newswire for news pegs");
    // Take the most recent 40 of 965 items and you see whichever handful of
    // feeds post most often, which is why three runs in a row returned the same
    // Business Rates story and the same Leeds gym. Sample wide, then cap each
    // brand so 165 companies get a hearing instead of the six noisiest.
    const wirePool = await db.feedItem.findMany({
      where: { status: "new", publishedAt: { gte: new Date(Date.now() - 14 * 864e5) } },
      orderBy: { publishedAt: "desc" },
      take: 400,
      include: { brand: { select: { name: true } } },
    });
    const perBrand = new Map();
    const wire = [];
    for (const item of wirePool) {
      const seen = perBrand.get(item.brandId) || 0;
      if (seen >= 2) continue;
      perBrand.set(item.brandId, seen + 1);
      wire.push(item);
      if (wire.length >= 100) break;
    }

    const titles = await existingTitles();

    await progress("Checking which homepage sections are short");
    const { sectionGaps, gapBriefing, SECTIONS } = await import("../sections");
    const gaps = await sectionGaps(site, creds.wordpress);
    const quota = gapBriefing(gaps);

    await progress("Judging which openings are genuinely worth writing");
    const raw = await think({
      maxTokens: 12000,
      system: `${titleBrief(site)}

You are the research editor.

YOUR STANDING BRIEF is to keep the site supplied with BOTH kinds of article: an evergreen reference library AND brand news. A title that publishes only evergreen guides gives a reader no reason to return tomorrow, and gives a PR agency no reason to send it anything, which is why its wire runs thin. Wire items are first-class candidates, not a tiebreak.

BRAND-CENTRIC COVERAGE IS THE PRIORITY. Half of your six or better must come
from the wire and name a real company: a launch, a funding round, a product
update, a piece of research, a partnership, a rebrand, an award, a set of
results. This is not only about freshness. Every company named in an article is
a company the Backlink Manager can then approach for a link, and links are the
one thing the site cannot write its way to. A guide that names eight providers
is worth more than one that names none, and a news piece about a named company
is worth more again because that company has a reason to share it.

Prefer wire items where a UK SME would recognise the company or could plausibly
buy from it. A funding round at a B2B SaaS an owner might use is a story; a
funding round at a semiconductor fab is not.

Also propose evergreen guides whose natural shape is a comparison or a
shortlist, because those name providers by the handful: "best X for UK small
business", "X versus Y versus Z", "the tools that do X". Prefer those over
abstract how-tos when both would serve the reader equally.

Choose the 6 best content opportunities from the evidence supplied. Three sources, judged on the same bar, not ranked against each other:
- Search Console near-misses. The site already ranks 8-30 for these, so a proper article is the cheapest possible win. Prefer high impressions.
- Real question phrasing from autocomplete, which wins featured snippets.
- News pegs from the wire, where a UK SME owner would actually change a decision.

Breadth is wanted. Range across the full spread of your readers' concerns and
across every section this title runs, not just the one or two that feel most
central. A topic does not have to sit in the obvious section to belong here.
Being topical is a virtue. Follow what owners are actually searching for.
${quota ? `\n${quota}\n` : ""}
Rules:
- Every pick must declare the homepage section it belongs in, exactly one of:
  ${SECTIONS.join(" | ")}. Choose the section the finished article would sit in,
  not the one that is short.
- Reject anything already covered by the existing titles listed.
- The one hard test: would a UK small business owner read this to run their
  business better? If yes it qualifies, whatever the sector. If it is really
  consumer advice, or aimed at large corporates, or a personal-finance topic
  that happens to mention business, reject it.
- Do NOT down-rank a wire item for being news. Judge it on whether an owner would
  change a decision, exactly as you judge a guide on whether they would act on it.
  A wire item that clears that bar belongs in the six on merit.
- Never propose a news topic that is not backed by one of the wire items listed
  below. News untied to a real event cannot be written, only invented, and the
  section quota deliberately cannot push for it. See docs/editorial-standard.md.
- Titles must be specific and searchable, not clever. Never use em dashes.

Reply ONLY with JSON:
[{"title":"...","category":"one of the sections above","source":"gsc|autocomplete|wire|gap","query":"the search query or wire item this came from","rationale":"one sentence on why this is worth writing now","score":<0-100 opportunity>}]`,
      user: `SEARCH CONSOLE NEAR-MISSES (position 7.5-30, last 90 days):
${nearMiss.map((r) => `- "${r.query}" pos ${r.position.toFixed(1)}, ${r.impressions} impressions, ${r.clicks} clicks`).join("\n") || "(no Search Console data yet)"}

QUESTION PHRASING FROM AUTOCOMPLETE:
${questions.map((q) => `- ${q}`).join("\n") || "(none)"}

NEWSWIRE (last 14 days):
${wire.map((w) => `- [${w.brand.name}] ${w.title}`).join("\n") || "(none)"}

ALREADY PUBLISHED (do not duplicate):
${titles.map((t) => `- ${t}`).join("\n")}`,
    });

    let picks = [];
    let parseFailed = false;
    try {
      picks = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "").trim());
    } catch {
      const m = raw.match(/\[[\s\S]*\]/);
      if (m) {
        try {
          picks = JSON.parse(m[0]);
        } catch {
          parseFailed = true;
        }
      } else {
        parseFailed = true;
      }
    }
    if (!Array.isArray(picks)) {
      parseFailed = true;
      picks = [];
    }

    let saved = 0;
    for (const p of picks) {
      if (!p?.title || alreadyCovered(site, p.title, titles)) continue;
      const dupe = await db.researchTopic.findFirst({ where: { title: p.title } });
      if (dupe) continue;
      // And against what is already queued, on wording rather than an exact
      // string. Run twice against the same 40 wire items and the model returns
      // the same stories in different words: three runs produced three takes on
      // the Business Rates story and three on one Leeds gym, which reads as a
      // backlog of 18 and is really 9. The bar is lower here than for published
      // articles because the cost of being wrong is lower — the higher-scored
      // twin survives either way, where a wrong call against a live article
      // silently loses a legitimate second angle.
      const { titleOverlap } = await import("./dedupe");
      const queued = await db.researchTopic.findMany({
        where: { status: "proposed" },
        select: { title: true },
      });
      if (queued.some((q) => titleOverlap(q.title, p.title) >= 0.42)) continue;
      const evidence = nearMiss.find((n) => n.query === p.query);
      await db.researchTopic.create({
        data: {
          title: p.title,
          // Only a section we actually have. A hallucinated name here would
          // create a seventh WP category at publish time.
          category: SECTIONS.includes(p.category) ? p.category : null,
          source: p.source || "gap",
          query: p.query || null,
          rationale: p.rationale || null,
          score: Number.isFinite(p.score) ? Math.max(0, Math.min(100, p.score)) : null,
          impressions: evidence?.impressions ?? null,
          clicks: evidence?.clicks ?? null,
          position: evidence?.position ?? null,
        },
      });
      saved++;
    }

    if (saved) {
      await say("director", `${saved} new topic${saved === 1 ? "" : "s"} proposed`, picks.map((p) => p.title).join("; ").slice(0, 500), "request");
    }

    // Runs after the main sweep so a barren chamber week costs one extra call
    // and nothing else. It fails soft on purpose: this is a trial lane and it
    // must never be the reason the Researcher's real work does not get saved.
    let smallFirm = 0;
    let smallFirmWhy = "lane did not run";
    try {
      await progress("Looking for a named small firm worth writing about");
      const r = await proposeSmallFirmStories(site, think, say);
      smallFirm = r.saved;
      smallFirmWhy = r.why;
    } catch (e) {
      // Still must not fail the Researcher's real work. But swallowing this
      // silently made a thrown error and an honestly quiet chamber week look
      // identical from the outside, which is the exact trap this codebase keeps
      // falling into: a failure that reports as a clean zero.
      smallFirmWhy = `errored: ${e.message?.slice(0, 90)}`;
    }

    const stillShort = gaps.filter((g) => g.commissionable && g.short > 0);
    return {
      // Saying only "Proposed 0 topics" hides which of three very different
      // things happened: the reply did not parse, the model offered nothing, or
      // it offered plenty and the duplicate filters ate them all. A run that
      // produces nothing and reports ok:true is otherwise undebuggable without
      // paying for another one.
      summary:
        `Proposed ${saved} topics` +
        (smallFirm ? ` + ${smallFirm} small-firm` : ` [small-firm: ${smallFirmWhy}]`) +
        (saved < picks.length ? ` (${picks.length - saved} of ${picks.length} filtered as duplicates)` : "") +
        (parseFailed ? ` [REPLY DID NOT PARSE, ${raw.length} chars returned]` : picks.length === 0 ? " [model offered none]" : "") +
        ` from ${nearMiss.length} near-miss queries, ${questions.length} questions, ${wire.length} wire items` +
        (stillShort.length ? `; sections short: ${stillShort.map((g) => `${g.name} ${g.short}`).join(", ")}` : "; every section at target"),
      saved,
    };
  });
}
