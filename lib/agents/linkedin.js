// LinkedIn Manager: turns the site's best-performing stories into posts.
//
// It DRAFTS ONLY. Posts land in the queue at status "draft" and nothing here
// ever touches LinkedIn: an agent posting unsupervised to a personal
// professional profile is a different risk class from one drafting an article
// that can still be held back.
//
// Approving a post in the queue is what sends it, through lib/linkedin.js. The
// human gate stays exactly where it is.
//
// "Consistent" is the whole brief, so the house format is fixed and enforced
// mechanically after drafting, not merely requested in the prompt.
import { forSite } from "../prisma";
import { getGoogleAccessToken, googlePost, isGoogleConfigured } from "../google";
import { runAgent } from "./runtime";
import { titleBrief, siteHost, siteUrl } from "../voice";

const MAX_CHARS = 1300; // LinkedIn truncates with "see more" around here
const DAILY_TARGET = 2;

// Which live articles are actually performing, so posts follow evidence rather
// than whatever was published most recently.
async function topPages(ga) {
  const property = ga?.gscSiteUrl;
  if (!isGoogleConfigured() || !property) return [];
  try {
    const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
    const end = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const data = await googlePost(
      token,
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      { startDate: start, endDate: end, dimensions: ["page"], rowLimit: 50 }
    );
    return (data.rows || []).map((r) => ({ url: r.keys[0], clicks: r.clicks, impressions: r.impressions }));
  } catch {
    return [];
  }
}

// Trim to LinkedIn's fold and strip anything that reads as machine output.
// Markdown heading stripping is anchored to "# " with a space so it cannot eat
// a hashtag at the start of a line.
function tidy(text) {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

// Consistency is the brief, so the hashtag count is normalised rather than used
// as a reason to bin an otherwise good post. Too many gets trimmed to three;
// too few is a genuine miss and still fails.
function normaliseHashtags(text) {
  const tags = text.match(/#[A-Za-z][A-Za-z0-9]*/g) || [];
  if (tags.length < 2) return { text, ok: false, reason: `only ${tags.length} hashtags` };
  if (tags.length === 3) return { text, ok: true };

  const keep = tags.slice(0, 3);
  // Remove every hashtag, then re-append the three we kept as the final line.
  const stripped = text
    .replace(/#[A-Za-z][A-Za-z0-9]*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: `${stripped}\n\n${keep.join(" ")}`, ok: true };
}

// Resolve real permalinks. A "?p=144" link on LinkedIn looks amateur and throws
// away the keyword-rich slug, so posts always carry the pretty URL.
async function permalinks(wp, ids) {
  const wanted = ids.filter(Boolean);
  if (!wanted.length || !wp?.url) return {};
  try {
    const res = await fetch(
      `${wp.url.replace(/\/$/, "")}/wp-json/wp/v2/posts?include=${wanted.join(",")}&per_page=100&_fields=id,link`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return {};
    return Object.fromEntries((await res.json()).map((p) => [p.id, p.link]));
  } catch {
    return {};
  }
}

export async function runLinkedIn(site, trigger = "daily_queue") {
  const db = forSite(site.id);
  return runAgent(site, "linkedin", trigger, "Writing posts from the best stories", async ({ think, progress, say }) => {
    const queued = await db.linkedInPost.count({ where: { status: { in: ["draft", "approved"] } } });
    if (queued >= DAILY_TARGET * 3) {
      return { summary: `${queued} posts already waiting for approval, nothing new drafted` };
    }

    const { siteCredentials } = await import("../site");
    const { creds } = await siteCredentials(site.id);
    const host = siteHost(site);

    await progress("Checking which articles are actually performing");
    const perf = await topPages(creds.google_analytics);
    const perfByUrl = Object.fromEntries(perf.map((p) => [p.url.replace(/\/$/, ""), p]));

    const alreadyPosted = new Set(
      (await db.linkedInPost.findMany({ where: { articleId: { not: null } }, select: { articleId: true } })).map(
        (p) => p.articleId
      )
    );

    const published = await db.article.findMany({
      where: { status: "published", body: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        body: true,
        metaDesc: true,
        wpPostId: true,
        keyphrase: true,
        imageUrl: true,
      },
    });

    // Rank by real search performance where we have it, recency otherwise.
    const candidates = published
      .filter((a) => !alreadyPosted.has(a.id))
      .map((a) => {
        // Guard the id explicitly: an empty needle makes includes() true for
        // every url, which would attribute a random page's traffic.
        const hit = a.wpPostId
          ? Object.entries(perfByUrl).find(([url]) => url.includes(`/${a.wpPostId}/`) || url.includes(`p=${a.wpPostId}`))
          : null;
        const clicks = hit?.[1]?.clicks || 0;
        const impressions = hit?.[1]?.impressions || 0;
        return { ...a, clicks, impressions, score: clicks * 10 + impressions };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!candidates.length) return { summary: "Every published article already has a post" };

    const links = await permalinks(creds.wordpress, candidates.map((c) => c.wpPostId));

    let drafted = 0;
    for (const article of candidates.slice(0, DAILY_TARGET)) {
      await progress(`Writing a post for "${article.title.slice(0, 45)}"`);
      const plain = article.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
      const url = links[article.wpPostId] || `${siteUrl(site) || ""}/?p=${article.wpPostId}`;

      const raw = await think({
        maxTokens: 6000,
        system: `${titleBrief(site)}

You write this publication's LinkedIn posts.

THE HOUSE FORMAT, used every single time, no exceptions:
Line 1: a specific, concrete hook. A number, a cost, a deadline or a mistake. Never a question opener, never "In today's world", never "I'm excited to share".
Blank line.
Two or three short lines that deliver the actual substance. Real specifics from the article. Someone must be able to act on these without clicking.
Blank line.
One line naming who this matters to and why.
Blank line.
The link on its own line.
Blank line.
Exactly three hashtags, lower camel case, relevant to the topic.

RULES
- 120 to 200 words total. Short lines. A blank line between every block.
- Plain English. UK spelling. No em dashes or en dashes anywhere.
- No emoji. No "thoughts?", no "drop a comment", no engagement bait.
- Never invent a statistic, price or date that is not in the article.
- Sound like an editor who read the piece, not a brand account.

Reply with ONLY the post text. No preamble, no quote marks around it.`,
        user: `Article: ${article.title}
URL: ${url}
${article.metaDesc ? `Summary: ${article.metaDesc}` : ""}

Article text:
${plain}`,
      });

      const tidied = tidy(raw);
      const norm = normaliseHashtags(tidied);
      const text = norm.text;

      // Only reject on things that cannot be repaired mechanically.
      const issues = [];
      if (text.length < 200) issues.push("too short");
      if (host && !text.includes(host)) issues.push("no link");
      if (!norm.ok) issues.push(norm.reason);
      if (issues.length) {
        await say("director", `LinkedIn draft rejected for "${article.title.slice(0, 45)}"`, issues.join(", "), "conflict");
        continue;
      }

      await db.linkedInPost.create({
        data: {
          text,
          status: "draft",
          articleId: article.id,
          wpPostId: article.wpPostId || null,
          sourceUrl: url,
          // The article's own header image, so the post shows the picture the
          // Designer already vetted rather than a generic card.
          imageUrl: article.imageUrl || null,
        },
      });
      drafted++;
    }

    if (drafted) {
      await say("director", `${drafted} LinkedIn post${drafted === 1 ? "" : "s"} queued for approval`, null, "report");
    }
    return { summary: `Drafted ${drafted} post${drafted === 1 ? "" : "s"} from ${candidates.length} candidate stories, awaiting approval` };
  });
}
