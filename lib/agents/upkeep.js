// Weekly upkeep: jobs that look after what is already published, rather
// than producing more of it. Added 9 Oct 2026 after a review of what the engine
// room spent its week on found nothing at all looking back at live articles.
//
//   nearly_there  SEO picks the articles Google ranks 5th to 20th; the Editor
//                 drafts a sharper search title, description and opening.
//   gap_check     the Researcher reads what rival titles published this week
//                 and proposes the stories we missed.
//   refresh_old   the Editor reads articles over 90 days old for wording that
//                 has gone out of date.
//   internal_links SEO links the week's new articles to older ones, on Haiku.
//
// Internal links are the one exception to "nothing goes live without a
// person": they only wrap words already in the post, and the seo-apply cron
// applies them as it always has. Everything else here is filed as a suggestion
// on the title's SEO page and waits for a person, which is the rule since 4 Oct
// 2026 (commit 231cd19): the sweep must not publish words nobody approved.
// Topics from the gap check go to the Director like any other proposal.

import { forSite } from "../prisma";
import { runAgent, say } from "./runtime";
import { titleBrief } from "../voice";
import { getGoogleAccessToken, googlePost, isGoogleConfigured } from "../google";
import { fetchPostByUrl, fetchPosts, isWordPressConfigured } from "../wordpress";
import { locate, insideBlockquote, alreadyLinked, internalLinkCount } from "../seo-agent";
import { siteHost } from "../voice";
import { acceptableSeoTitle } from "../seo-title";
import { titleOverlap, alreadyCovered } from "./dedupe";
import { sectionNames } from "../sections";

const SONNET = "claude-sonnet-5";

async function credentialsFor(site) {
  const { siteCredentials } = await import("../site");
  const { creds } = await siteCredentials(site.id);
  return creds;
}

// Lenient JSON from a model reply: fences and text either side are ignored.
function readJson(raw) {
  const text = String(raw || "").replace(/^```(?:json)?|```$/gm, "").trim();
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const a = text.indexOf(open);
    const b = text.lastIndexOf(close);
    if (a < 0 || b <= a) continue;
    try {
      return JSON.parse(text.slice(a, b + 1));
    } catch {
      /* try the other shape */
    }
  }
  return null;
}

const plain = (html = "") =>
  String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const numbersIn = (s = "") => new Set((String(s).match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, "")));

// A rewrite may reword, never add a figure: every number in it must already be
// in the text it was written from.
function addsNumbers(source, rewrite, allowed = []) {
  const known = new Set([...numbersIn(source), ...allowed.map(String)]);
  return [...numbersIn(rewrite)].some((n) => !known.has(n));
}

const noDashes = (s = "") => !/[—–]/.test(s);

/* ---------------------------------------------------------- search console */

// Pages with their position and traffic over the last 28 days, plus the
// queries each page is seen for. Never stored: the job runs weekly and the
// numbers are only meaningful fresh.
export async function searchPages(ga, { days = 28 } = {}) {
  const property = ga?.gscSiteUrl;
  if (!isGoogleConfigured() || !property) return null;
  const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
  const end = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days + 3) * 864e5).toISOString().slice(0, 10);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const [pages, pairs] = await Promise.all([
    googlePost(token, url, { startDate: start, endDate: end, dimensions: ["page"], rowLimit: 500 }),
    googlePost(token, url, { startDate: start, endDate: end, dimensions: ["page", "query"], rowLimit: 2000 }),
  ]);
  const queries = {};
  for (const r of pairs.rows || []) {
    (queries[r.keys[0]] ||= []).push({ query: r.keys[1], impressions: r.impressions, position: r.position });
  }
  return (pages.rows || []).map((r) => ({
    url: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position,
    queries: (queries[r.keys[0]] || []).sort((a, b) => b.impressions - a.impressions).slice(0, 5),
  }));
}

// The opening paragraph as stored, when it is plain prose we can safely swap:
// not in a quote, no links or embeds to lose, long enough to be the real intro.
export function openingParagraph(content = "") {
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(content))) {
    const inner = m[1];
    const text = plain(inner);
    if (text.length < 80) continue;
    if (insideBlockquote(content, m.index)) return null;
    if (/<(a|img|iframe|script|span)\b/i.test(inner)) return null;
    return { html: m[0], text };
  }
  return null;
}

// Interviews carry the Leaders hub eyebrow and are verbatim Q&A: never edited.
const isInterview = (post) => /franchise-eyebrow/.test(post?.title?.raw || post?.title?.rendered || "");

async function pendingFor(db, wpPostId, prefix) {
  return db.seoSuggestion.count({ where: { wpPostId, status: "pending", title: { startsWith: prefix } } });
}

/* ------------------------------------------------------------ nearly there */

const NEARLY = { min: 5, max: 20, minImpressions: 30, perRun: 5 };

export async function runNearlyThere(site, trigger = "nearly_there") {
  const db = forSite(site.id);
  return runAgent(site, "editor", trigger, "Sharpening articles that nearly rank", async ({ think, progress }) => {
    const creds = await credentialsFor(site);
    if (!isWordPressConfigured(creds.wordpress)) return { summary: "No WordPress credential, nothing to sharpen" };

    await progress("SEO is reading Search Console for pages ranking 5th to 20th");
    const pages = await searchPages(creds.google_analytics);
    if (!pages) return { summary: "No Search Console connection for this title yet" };

    const near = pages
      .filter((p) => p.position >= NEARLY.min && p.position <= NEARLY.max && p.impressions >= NEARLY.minImpressions)
      .sort((a, b) => b.impressions - a.impressions);
    if (!near.length) return { summary: "No page ranks 5th to 20th with enough impressions yet" };

    // Resolve to posts until we have enough that are editable and not already
    // waiting on a decision from a previous week.
    const picked = [];
    for (const p of near) {
      if (picked.length >= NEARLY.perRun) break;
      const post = await fetchPostByUrl(creds.wordpress, p.url).catch(() => null);
      if (!post || isInterview(post)) continue;
      if (await pendingFor(db, post.id, "Nearly there")) continue;
      picked.push({ page: p, post });
    }
    if (!picked.length) return { summary: `${near.length} near-miss pages, all already waiting on a decision or not editable` };

    await say(
      site.id,
      "seo",
      "editor",
      `${picked.length} articles nearly ranking`,
      picked.map((x) => `${x.post.title?.raw || ""} (position ${x.page.position.toFixed(1)})`).join("; ").slice(0, 500),
      "request"
    );

    await progress(`drafting search titles and openings for ${picked.length} articles`);
    const brief = titleBrief(site);
    const results = await Promise.all(
      picked.map(async ({ page, post }) => {
        const content = post.content?.raw || "";
        const opening = openingParagraph(content);
        const headline = plain(post.title?.raw || post.title?.rendered || "");
        const currentSeoTitle = post.meta?._yoast_wpseo_title || "";
        const raw = await think({
          model: SONNET,
          maxTokens: 6000,
          system: `${brief}

You are the Editor. This article already ranks on Google's first or second page but just below the clicks. Make the search result more clickable and the opening answer the searcher faster, without changing what the article says.

Write:
- seo_title: the line Google shows. 40 to 60 characters. Lead with the specific thing the top queries ask about. No em or en dashes, no clickbait, no "ultimate guide".
- meta_description: 130 to 155 characters, one or two plain sentences saying what the reader will learn. No dashes.
- opening: a rewrite of the opening paragraph${opening ? "" : " (there is no editable opening, so return null)"} that answers the main query in its first sentence. Use ONLY facts already in the article text given. Never add a number, name or claim. Same length or shorter. British English. No dashes. Plain text, no HTML.

Reply with ONLY JSON: {"seo_title": "...", "meta_description": "...", "opening": "..." or null}`,
          user: `Headline: ${headline}
Current search title: ${currentSeoTitle || "(none set, Google uses the headline)"}
Position ${page.position.toFixed(1)}, ${page.impressions} impressions and ${page.clicks} clicks in 28 days.
Queries it is seen for: ${page.queries.map((q) => `"${q.query}" (pos ${q.position.toFixed(1)}, ${q.impressions} impr)`).join("; ") || "none reported"}

Opening paragraph:
${opening?.text || "(not editable)"}

Article text:
${plain(content).slice(0, 6000)}`,
        });
        return { page, post, headline, opening, content, j: readJson(raw) };
      })
    );

    let filed = 0;
    for (const { page, post, headline, opening, content, j } of results) {
      if (!j) continue;
      const evidence = `Ranks ${page.position.toFixed(1)} on average${page.queries[0] ? ` for "${page.queries[0].query}"` : ""}, with ${page.impressions} impressions and ${page.clicks} clicks in the last 28 days.`;
      const impact = Math.min(95, 40 + Math.round(Math.log10(Math.max(10, page.impressions)) * 15));
      const seoTitle = String(j.seo_title || "").trim();
      const metaDesc = String(j.meta_description || "").trim();
      const titleOk = acceptableSeoTitle(seoTitle) && seoTitle.length <= 60 && !addsNumbers(content, seoTitle, [new Date().getFullYear()]);
      const descOk = metaDesc.length >= 110 && metaDesc.length <= 160 && noDashes(metaDesc) && !addsNumbers(content, metaDesc);
      if (titleOk || descOk) {
        await db.seoSuggestion.create({
          data: {
            kind: "title_update",
            wpPostId: post.id,
            targetUrl: page.url,
            title: `Nearly there: search title for ${headline}`.slice(0, 120),
            detail: `${evidence} A search title and description that answer that query should lift the click rate. This changes only what Google shows; the headline on the page stays as it is.`,
            impact,
            payload: JSON.stringify({ ...(titleOk ? { seoTitle } : {}), ...(descOk ? { metaDesc } : {}) }),
          },
        });
        filed++;
      }
      const rewrite = String(j.opening || "").trim();
      if (
        opening &&
        rewrite &&
        noDashes(rewrite) &&
        rewrite.length <= opening.text.length * 1.15 &&
        rewrite.length >= opening.text.length * 0.5 &&
        !addsNumbers(content, rewrite) &&
        locate(content, opening.html)
      ) {
        const tag = opening.html.match(/^<p[^>]*>/i)[0];
        await db.seoSuggestion.create({
          data: {
            kind: "content_edit",
            wpPostId: post.id,
            targetUrl: page.url,
            title: `Nearly there: opening for ${headline}`.slice(0, 120),
            detail: `${evidence} The rewrite answers the search in its first sentence, using only facts already in the article.`,
            impact: impact - 5,
            payload: JSON.stringify({ find: opening.html, replaceWith: `${tag}${rewrite.replace(/</g, "&lt;")}</p>` }),
          },
        });
        filed++;
      }
    }
    return { summary: `Filed ${filed} suggestion${filed === 1 ? "" : "s"} for ${picked.length} nearly-ranking articles, waiting on the SEO page` };
  });
}

/* --------------------------------------------------------------- gap check */

export async function runGapCheck(site, trigger = "gap_check") {
  const db = forSite(site.id);
  return runAgent(site, "researcher", trigger, "Checking what rival titles covered", async ({ think, progress, say: tell }) => {
    const since = new Date(Date.now() - 7 * 864e5);
    // Rival publications are PrBrand rows filed as "(competitor)" by the
    // alignment seed; the feed scan already brings their stories in.
    const rival = await db.feedItem.findMany({
      where: {
        discoveredAt: { gte: since },
        brand: { category: { contains: "(competitor)" } },
      },
      orderBy: { discoveredAt: "desc" },
      take: 80,
      select: { id: true, title: true, summary: true, link: true, brand: { select: { name: true } } },
    });
    if (!rival.length) return { summary: "No rival stories in the last week (no competitor feeds, or they were quiet)" };

    await progress(`comparing ${rival.length} rival stories with our own coverage`);
    const [ours, queued] = await Promise.all([
      db.article.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 45 * 864e5) } },
        select: { title: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.researchTopic.findMany({ where: { status: { in: ["proposed", "commissioned"] } }, select: { title: true }, take: 200 }),
    ]);
    const covered = [...ours, ...queued].map((r) => r.title);
    // Cheap first pass, so the model only sees stories we plausibly missed.
    const candidates = rival.filter((r) => !covered.some((t) => titleOverlap(t, r.title) >= 0.35)).slice(0, 40);
    if (!candidates.length) return { summary: `All ${rival.length} rival stories this week are already covered` };

    const SECTIONS = sectionNames(site);
    const raw = await think({
      model: SONNET,
      maxTokens: 8000,
      system: `${titleBrief(site)}

You are the Researcher. Below are stories rival trade titles published this week that we have not covered. Choose at most 4 that genuinely matter to OUR readers and that we can report properly from the underlying news (not by rewriting the rival). Skip anything that is the rival's own opinion, promotion, events or paywalled exclusives.

For each, give our own headline (not theirs), the section it belongs in (${SECTIONS.join(" | ")}), and one sentence on why our readers need it.

Reply with ONLY JSON: [{"ref": "R3", "title": "...", "section": "...", "rationale": "..."}]. An empty list is a fine answer.`,
      user: candidates.map((c, i) => `R${i + 1} | ${c.brand.name} | ${c.title} | ${(c.summary || "").slice(0, 200)}`).join("\n"),
    });
    const picks = Array.isArray(readJson(raw)) ? readJson(raw).slice(0, 4) : [];

    let saved = 0;
    for (const p of picks) {
      const src = candidates[Number(String(p.ref || "").replace(/\D/g, "")) - 1];
      const title = String(p.title || "").trim();
      if (!src || title.length < 15) continue;
      if (covered.some((t) => titleOverlap(t, title) >= 0.42)) continue;
      if (await alreadyCovered(site, title)) continue;
      await db.researchTopic.create({
        data: {
          title,
          category: SECTIONS.includes(p.section) ? p.section : null,
          source: "gap",
          rationale: `Covered by ${src.brand.name} this week and not by us. ${p.rationale || ""}`.trim().slice(0, 500),
          score: 60,
          sourceItemId: src.id,
        },
      });
      covered.push(title);
      saved++;
    }
    if (saved) await tell("director", `${saved} gap topic${saved === 1 ? "" : "s"} from rival coverage`, picks.map((p) => p.title).join("; ").slice(0, 500), "request");
    return { summary: `Read ${rival.length} rival stories, ${candidates.length} not covered by us, proposed ${saved}` };
  });
}

/* ------------------------------------------------------------- refresh old */

const OLD_DAYS = 90;

export async function runRefreshOld(site, trigger = "refresh_old") {
  const db = forSite(site.id);
  return runAgent(site, "editor", trigger, "Checking older articles for dated wording", async ({ think, progress }) => {
    // Free check first: until something is old enough this job costs nothing.
    const cutoff = new Date(Date.now() - OLD_DAYS * 864e5);
    const old = await db.article.count({ where: { status: "published", publishedAt: { lt: cutoff }, wpPostId: { not: null } } });
    if (!old) return { summary: `Nothing published more than ${OLD_DAYS} days ago yet` };

    const creds = await credentialsFor(site);
    if (!isWordPressConfigured(creds.wordpress)) return { summary: "No WordPress credential, nothing to refresh" };

    // The old articles still earning traffic come first; without Search
    // Console, the oldest.
    await progress("finding the older articles that still earn search traffic");
    const pages = (await searchPages(creds.google_analytics).catch(() => null)) || [];
    const picked = [];
    for (const p of pages.sort((a, b) => b.clicks - a.clicks).slice(0, 25)) {
      if (picked.length >= 3) break;
      const post = await fetchPostByUrl(creds.wordpress, p.url).catch(() => null);
      if (!post || isInterview(post) || new Date(post.date) > cutoff) continue;
      if (await pendingFor(db, post.id, "Refresh")) continue;
      picked.push(post);
    }
    if (!picked.length) {
      const oldest = await db.article.findMany({
        where: { status: "published", publishedAt: { lt: cutoff }, wpPostId: { not: null } },
        orderBy: { publishedAt: "asc" },
        take: 3,
        select: { wpPostId: true },
      });
      const { fetchPost } = await import("../wordpress");
      for (const a of oldest) {
        const post = await fetchPost(creds.wordpress, a.wpPostId, { edit: true }).catch(() => null);
        if (post && !isInterview(post) && !(await pendingFor(db, post.id, "Refresh"))) picked.push(post);
      }
    }
    if (!picked.length) return { summary: `${old} older articles, none needing a fresh look this week` };

    await progress(`reading ${picked.length} older articles for out-of-date wording`);
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
    let filed = 0;
    const flagged = [];
    await Promise.all(
      picked.map(async (post) => {
        const content = post.content?.raw || "";
        const published = new Date(post.date);
        const raw = await think({
          model: SONNET,
          maxTokens: 6000,
          system: `${titleBrief(site)}

You are the Editor, re-reading an article published on ${published.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Today is ${today}.

Find wording that has gone out of date because time has passed: "this year", "next month", "recently", "upcoming", "will launch in", deadlines that have now passed, and similar. For each, give the exact sentence as it appears and a corrected version that changes ONLY the time wording (for example "this year" becomes "in 2026", "will open in March" becomes "opened in March"). Never add or change a figure, name or claim; if a statistic itself may be outdated, list it under "check" instead of rewriting it.

Reply with ONLY JSON: {"edits": [{"find": "exact sentence", "replace": "corrected sentence"}], "check": ["short note on a figure worth re-checking"]}. Empty lists are a fine answer.`,
          user: plain(content).slice(0, 12000),
        });
        const j = readJson(raw) || {};
        const headline = plain(post.title?.raw || post.title?.rendered || "");
        const years = [published.getFullYear(), published.getFullYear() + 1, new Date().getFullYear()];
        for (const e of (j.edits || []).slice(0, 4)) {
          const find = String(e.find || "").trim();
          const replace = String(e.replace || "").trim();
          if (!find || !replace || find === replace || !noDashes(replace)) continue;
          if (replace.length > find.length * 1.3 || addsNumbers(find, replace, years)) continue;
          const at = locate(content, find);
          if (!at || insideBlockquote(content, content.indexOf(at))) continue;
          await db.seoSuggestion.create({
            data: {
              kind: "content_edit",
              wpPostId: post.id,
              targetUrl: post.link || null,
              title: `Refresh: dated wording in ${headline}`.slice(0, 120),
              detail: `Published ${published.toLocaleDateString("en-GB")}. This sentence reads as out of date now; the fix changes only the time wording.`,
              impact: 45,
              payload: JSON.stringify({ find: at, replaceWith: replace }),
            },
          });
          filed++;
        }
        // A figure that may have moved on needs someone to find the new one,
        // so it goes on the SEO page as a note rather than as an edit.
        for (const c of (j.check || []).slice(0, 2)) {
          const note = String(c || "").trim();
          if (!note) continue;
          await db.seoSuggestion.create({
            data: {
              kind: "advice",
              wpPostId: post.id,
              targetUrl: post.link || null,
              title: `Refresh: re-check a figure in ${headline}`.slice(0, 120),
              detail: note.slice(0, 500),
              impact: 35,
            },
          });
          flagged.push(note);
        }
      })
    );
    return { summary: `Read ${picked.length} older articles, filed ${filed} wording fix${filed === 1 ? "" : "es"}, flagged ${flagged.length} figure${flagged.length === 1 ? "" : "s"} to re-check` };
  });
}

/* ----------------------------------------------------------- internal links */

// JB's ceiling, 9 Oct 2026: no more than £5 a week across the fleet for
// internal linking. Haiku with no thinking, a fixed number of small calls, and
// a fixed output ceiling make that a property of the code rather than a hope:
// three calls of at most ~12k tokens in and 3k out is about 6 cents a title,
// so the worst possible week for ten titles is about 60 cents.
const LINKS = {
  model: "claude-haiku-4-5",
  lookBackDays: 8, // a weekly job, with a day of overlap so nothing falls between runs
  fetch: 60, // recent posts read: the new ones to link, and the pool to link to
  target: 3, // links a new article should carry to the rest of the site
  perPost: 3,
  batch: 8,
  maxCalls: 3,
  chars: 3000,
};

// True when a position in the HTML sits inside an element we never link in:
// an existing link (no nesting), a heading, or a quote.
function insideAny(html, index) {
  if (index < 0) return true;
  if (insideBlockquote(html, index)) return true;
  const re = /<(a|h[1-6]|figcaption|button)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (index >= m.index && index < m.index + m[0].length) return true;
  }
  // Inside a tag itself, e.g. an attribute value.
  const lt = html.lastIndexOf("<", index);
  const gt = html.lastIndexOf(">", index);
  return lt > gt;
}

export async function runInternalLinks(site, trigger = "internal_links") {
  const db = forSite(site.id);
  return runAgent(site, "seo", trigger, "Linking this week's articles into the site", async ({ think, progress }) => {
    const creds = await credentialsFor(site);
    if (!isWordPressConfigured(creds.wordpress)) return { summary: "No WordPress credential, nothing to link" };

    await progress(`reading the ${LINKS.fetch} most recent posts`);
    let posts;
    try {
      posts = await fetchPosts(creds.wordpress, LINKS.fetch);
    } catch (e) {
      // The host's bot check is not this agent failing; next week will do.
      if (e.retryable) return { summary: `Skipped: ${e.message.slice(0, 120)}` };
      throw e;
    }
    const host = siteHost(site);
    const since = Date.now() - LINKS.lookBackDays * 864e5;
    const title = (p) => plain(p.title?.rendered || "");
    const fresh = posts
      .filter((p) => new Date(p.date).getTime() >= since)
      .map((p) => ({ p, have: internalLinkCount(p.content?.rendered || "", host) }))
      .filter((x) => x.have < LINKS.target)
      .sort((a, b) => a.have - b.have)
      .slice(0, LINKS.batch * LINKS.maxCalls);
    if (!fresh.length) return { summary: "Every article from the last week already carries its internal links" };

    // Destinations: every recent post, by number, so the model never types a URL.
    const dest = posts.map((p, i) => ({ n: i + 1, id: p.id, url: p.link, title: title(p) }));
    const destList = dest.map((d) => `D${d.n} | ${d.title}`).join("\n");

    const system = `You add internal links to news articles on a trade magazine website.

For each article, choose up to ${LINKS.perPost} places where a reader would genuinely want to read one of the OTHER articles in the destination list. For each link give:
- "post": the article number (A1, A2...)
- "phrase": 2 to 8 words copied EXACTLY, character for character, from the article text. They become the clickable text. Never add, change or reorder a word.
- "dest": the destination number (D1, D2...). Never link an article to itself. Never use the same destination twice in one article.

Only link where the phrase is clearly about the destination's subject. Never pick a phrase inside a quote, a heading or a company name that is already a link. If nothing fits, give fewer links or none.

Reply with ONLY JSON: [{"post": "A1", "phrase": "...", "dest": "D7"}]`;

    let filed = 0;
    let rejected = 0;
    let calls = 0;
    for (let i = 0; i < fresh.length && calls < LINKS.maxCalls; i += LINKS.batch) {
      const group = fresh.slice(i, i + LINKS.batch);
      await progress(`choosing links for ${group.length} articles`);
      calls++;
      const raw = await think({
        model: LINKS.model,
        maxTokens: 3000,
        system,
        user:
          `Destinations:\n${destList}\n\n` +
          group.map(({ p }, k) => `A${k + 1} (this is D${dest.find((d) => d.id === p.id).n}) | ${title(p)}\n${plain(p.content?.rendered || "").slice(0, LINKS.chars)}`).join("\n\n"),
      });
      const picks = readJson(raw);
      if (!Array.isArray(picks)) continue;

      const used = new Map();
      for (const pick of picks) {
        const item = group[Number(String(pick.post || "").replace(/\D/g, "")) - 1];
        const to = dest[Number(String(pick.dest || "").replace(/\D/g, "")) - 1];
        const phrase = String(pick.phrase || "").trim();
        if (!item || !to || to.id === item.p.id || phrase.split(/\s+/).length < 2 || phrase.split(/\s+/).length > 8) {
          rejected++;
          continue;
        }
        const seen = used.get(item.p.id) || new Set();
        if (seen.has(to.id) || seen.size >= LINKS.perPost) continue;
        const content = item.p.content?.rendered || "";
        const found = locate(content, phrase);
        const replaceWith = `<a href="${to.url}">${found}</a>`;
        if (!found || insideAny(content, content.indexOf(found)) || alreadyLinked(content, replaceWith)) {
          rejected++;
          continue;
        }
        const dupe = await db.seoSuggestion.count({
          where: { wpPostId: item.p.id, kind: "internal_link", status: "pending", payload: { contains: to.url } },
        });
        if (dupe) continue;
        await db.seoSuggestion.create({
          data: {
            kind: "internal_link",
            wpPostId: item.p.id,
            targetUrl: item.p.link || null,
            title: `Link "${found}" to ${to.title}`.slice(0, 120),
            detail: `Weekly linking pass. The words are already in the article; only the link is added.`,
            impact: 60,
            payload: JSON.stringify({ find: found, replaceWith }),
          },
        });
        seen.add(to.id);
        used.set(item.p.id, seen);
        filed++;
      }
    }
    return {
      summary: `Queued ${filed} internal link${filed === 1 ? "" : "s"} across ${fresh.length} new article${fresh.length === 1 ? "" : "s"} (${calls} Haiku call${calls === 1 ? "" : "s"}${rejected ? `, ${rejected} unusable picks dropped` : ""})`,
    };
  });
}
