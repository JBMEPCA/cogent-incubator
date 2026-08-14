/**
 * Smart SME Weekly — build and send.
 *
 * Split of responsibilities:
 *   - the Newsletter Manager agent CHOOSES the ten articles and the running order
 *   - deterministic code does everything else, because a model picking stories is
 *     useful and a model assembling HTML is a liability
 *
 * Nothing here writes copy. Headlines and standfirsts come straight from
 * WordPress, so the newsletter can never disagree with the article it links to.
 */

import { runAgent } from "./agents/runtime";
// newsletterStatus() calls forSite() and this import was missing, so the Engine
// Room's newsletter panel threw a ReferenceError rather than rendering.
import { forSite } from "./prisma";
import { titleBrief, userAgent } from "./voice";
import {
  renderShell,
  renderSections,
  SECTION_KEYS,
  strip,
  decode,
} from "./newsletter-template";

// The audience is per title and arrives as the `mailchimp` credential. There is
// deliberately no default: one hardcoded list id shared across a fleet is how a
// second magazine's issue goes out to the first magazine's subscribers.
// Template and logo are named per title so two magazines cannot share, or
// overwrite, one another's Mailchimp assets.

const STORY_COUNT = 10;
const MAX_PER_CATEGORY = 2;

// A send is refused outright above these. Both are share-of-emails-sent on the
// previous issue.
const MAX_BOUNCE_RATE = 0.02;
const MAX_COMPLAINT_RATE = 0.001;

// The API key is fleet-wide (one Mailchimp account), the audience is not.
export function isNewsletterConfigured(mailchimp) {
  return Boolean(process.env.MAILCHIMP_API_KEY && process.env.ANTHROPIC_API_KEY && mailchimp?.audienceId);
}

export function isNewsletterEnabled() {
  // Kill switch. Set NEWSLETTER_ENABLED=false to halt without touching code.
  return process.env.NEWSLETTER_ENABLED !== "false";
}

// ---- Mailchimp ----

function creds() {
  const key = process.env.MAILCHIMP_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return null;
  const dc = key.split("-").pop();
  return {
    base: `https://${dc}.api.mailchimp.com/3.0`,
    admin: `https://${dc}.admin.mailchimp.com`,
    auth: "Basic " + Buffer.from(`anystring:${key}`).toString("base64"),
  };
}

export async function mc(path, init) {
  const c = creds();
  if (!c) throw new Error("MAILCHIMP_API_KEY is not set");
  const res = await fetch(`${c.base}${path}`, {
    ...init,
    headers: { Authorization: c.auth, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const fields = data?.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Mailchimp ${res.status}: ${data?.detail ?? data?.title ?? text}${fields ? ` [${fields}]` : ""}`);
  }
  return data;
}

/**
 * The wordmark, hosted by Mailchimp so no client has to fetch it from us.
 * The account holds 10,000+ files and the endpoint pages OLDEST first, so this
 * must sort descending or it never sees anything uploaded this decade.
 */
async function ensureLogo(site, pngBase64) {
  const LOGO_NAME = `${site?.slug || "title"}-wordmark.png`;
  const list = await mc("/file-manager/files?count=50&sort_field=added_date&sort_dir=DESC");
  const hit = list.files?.find((f) => f.name === LOGO_NAME);
  if (hit) return hit.full_size_url;
  const up = await mc("/file-manager/files", {
    method: "POST",
    body: JSON.stringify({ name: LOGO_NAME, file_data: pngBase64 }),
  });
  return up.full_size_url;
}

/**
 * The shell, stored once and reused. Story slots ship EMPTY: each campaign
 * supplies its own, so editing the chrome never rewrites a past issue.
 */
async function ensureTemplate(site, html) {
  const TEMPLATE_NAME = `${site?.name || "Title"} Weekly`;
  const existing = await mc("/templates?type=user&count=1000&fields=templates.id,templates.name");
  const hit = existing.templates?.find((t) => t.name === TEMPLATE_NAME);
  if (hit) {
    await mc(`/templates/${hit.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: TEMPLATE_NAME, html }),
    });
    return hit.id;
  }
  const created = await mc("/templates", {
    method: "POST",
    body: JSON.stringify({ name: TEMPLATE_NAME, html }),
  });
  return created.id;
}

/**
 * How the previous issue actually landed. A send is refused if it went badly,
 * so a deliverability problem stops the series instead of compounding weekly.
 */
export async function lastIssueHealth(audienceId) {
  // /reports ignores list_id: passing it returns the newest campaign on the
  // ACCOUNT, which on a shared account is whichever magazine sent last. That had
  // Smart SME refusing to send because a LuxBMA e-shot bounced. Filter here.
  //
  // 200 rather than 50 because the account is busy: the other magazines sent 50
  // campaigns in roughly three weeks, so at 50 a fortnight's gap would push our
  // last issue out of the window and this would report "first send" and skip
  // the deliverability check entirely.
  const reports = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC`);
  const r = (reports.reports ?? []).find((x) => x.list_id === audienceId);
  if (!r || !r.emails_sent) return { ok: true, first: true };

  const hard = r.bounces?.hard_bounces ?? 0;
  const soft = r.bounces?.soft_bounces ?? 0;
  const complaints = r.abuse_reports ?? 0;
  const bounceRate = (hard + soft) / r.emails_sent;
  const complaintRate = complaints / r.emails_sent;

  const reasons = [];
  if (bounceRate > MAX_BOUNCE_RATE) reasons.push(`bounce rate ${(bounceRate * 100).toFixed(2)}%`);
  if (complaintRate > MAX_COMPLAINT_RATE) reasons.push(`complaint rate ${(complaintRate * 100).toFixed(3)}%`);

  return {
    ok: reasons.length === 0,
    reasons,
    campaign: r.campaign_title,
    emailsSent: r.emails_sent,
    bounceRate,
    complaintRate,
    opens: r.opens?.open_rate,
  };
}

/**
 * Everything the Engine Room needs to show about the newsletter, in one call.
 * Read live rather than cached: this is a single-user app and the numbers are
 * only ever looked at when the page is open.
 */
export async function newsletterStatus(siteId, mailchimp) {
  const db = forSite(siteId);
  if (!isNewsletterConfigured(mailchimp)) return { configured: false };
  const audienceId = mailchimp.audienceId;

  const [list, reports] = await Promise.all([
    mc(`/lists/${audienceId}?fields=name,stats.member_count,marketing_permissions,double_optin`),
    // /reports IGNORES list_id. Passing it here looked like a filter and was
    // not one, so count=1 returned the newest campaign on the whole ACCOUNT and
    // the Engine Room showed another magazine's e-shot as the last Smart SME
    // issue: "Bar Magazine India, 32,777 sent" against an 875-member list.
    // lastIssueHealth() and issueHistory() both fetch a batch and filter in JS
    // for exactly this reason; this was the one call that trusted the param.
    mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC`),
  ]);

  const r = (reports.reports ?? []).find((x) => x.list_id === audienceId);
  return {
    configured: true,
    enabled: isNewsletterEnabled(),
    audience: list.name,
    members: list.stats?.member_count ?? 0,
    // Both of these silently swallow recipients on an imported list, so the
    // Engine Room says so rather than leaving it to be discovered on a Thursday.
    gdprPermissions: list.marketing_permissions === true,
    doubleOptIn: list.double_optin === true,
    last: r
      ? {
          subject: r.subject_line,
          sentAt: r.send_time,
          sent: r.emails_sent,
          openRate: r.opens?.open_rate ?? null,
          clickRate: r.clicks?.click_rate ?? null,
          bounces: (r.bounces?.hard_bounces ?? 0) + (r.bounces?.soft_bounces ?? 0),
          complaints: r.abuse_reports ?? 0,
        }
      : null,
  };
}

/**
 * Is the From domain actually fit to send from?
 *
 * Mailchimp will happily send from a domain that is merely verified, but
 * without DKIM the mail is far likelier to be filtered, and the first issue to
 * a cold list is the worst possible moment to find that out. So this insists on
 * authenticated, not just verified.
 */
export async function sendingDomainReady(fromEmail) {
  const domain = (fromEmail.split("@")[1] ?? "").toLowerCase();
  const d = await mc("/verified-domains");
  const hit = (d.domains ?? []).find((x) => x.domain.toLowerCase() === domain);
  if (!hit) return { ok: false, why: `${domain} is not registered with Mailchimp` };
  if (!hit.verified) return { ok: false, why: `${domain} is not verified` };
  if (!hit.authenticated) return { ok: false, why: `${domain} is verified but DKIM is not authenticated yet` };
  return { ok: true, domain };
}

// ---- candidates ----

/** Everything published, newest first, with the fields the email needs. */
export async function fetchCandidates(wp, limit = 40) {
  const base = String(wp?.url || "").replace(/\/$/, "");
  if (!base) throw new Error("No WordPress credential for this title, so there are no articles to build an issue from.");
  const url = `${base}/wp-json/wp/v2/posts?per_page=${limit}&_embed=wp:featuredmedia,wp:term&orderby=date&order=desc`;
  // This host rejects server fetches with no user agent.
  const res = await fetch(url, { headers: { "User-Agent": userAgent(site, "Newsletter/1.0") } });
  if (!res.ok) throw new Error(`WordPress returned ${res.status}`);
  const posts = await res.json();

  return posts
    .map((p) => {
      const media = p._embedded?.["wp:featuredmedia"]?.[0];
      const sizes = media?.media_details?.sizes ?? {};
      return {
        id: p.id,
        title: decode(p.title?.rendered ?? ""),
        link: p.link,
        date: p.date,
        excerpt: strip(p.excerpt?.rendered ?? ""),
        category: decode(p._embedded?.["wp:term"]?.[0]?.[0]?.name ?? "News"),
        imageLead: sizes.large?.source_url ?? sizes.full?.source_url ?? media?.source_url ?? "",
        imageThumb: sizes.medium?.source_url ?? sizes.large?.source_url ?? media?.source_url ?? "",
      };
    })
    .filter((p) => p.imageLead && p.imageThumb); // every slot needs a picture
}

/**
 * Deterministic fallback and safety net: round-robin the categories in order of
 * how recently each was published to, at most MAX_PER_CATEGORY from any one.
 */
export function selectStories(posts, count = STORY_COUNT, maxPerCat = MAX_PER_CATEGORY) {
  const byCat = new Map();
  for (const p of posts) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  const cats = [...byCat.keys()].sort(
    (a, b) => new Date(byCat.get(b)[0].date) - new Date(byCat.get(a)[0].date)
  );
  const picked = [];
  for (let round = 0; round < maxPerCat && picked.length < count; round++) {
    for (const c of cats) {
      if (picked.length >= count) break;
      const next = byCat.get(c)[round];
      if (next) picked.push(next);
    }
  }
  for (const p of posts) {
    if (picked.length >= count) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked.slice(0, count);
}

function spreadIsAcceptable(stories) {
  const counts = {};
  for (const s of stories) counts[s.category] = (counts[s.category] ?? 0) + 1;
  return Object.values(counts).every((n) => n <= MAX_PER_CATEGORY);
}

// ---- the agent ----

const SYSTEM = (site) => `${titleBrief(site)}

You are the Newsletter Manager.

Each week you choose which ten articles go into the weekly email and in what order.

How to choose:
- Slot 1 is the lead and gets a large image. Pick the article most likely to make a busy owner-manager stop and read: something with a deadline, a cost, a legal obligation or a decision they have to make. Prefer consequence over novelty.
- Slots 2 to 10 are a mixed run. Vary the subject matter so consecutive slots are not on the same theme.
- Never take more than two articles from any one category.
- Favour articles a reader can act on this week over general explainers.
- Ignore how recent something is except as a tie breaker. A strong evergreen guide beats a weak news item.

Reply with ONLY a JSON object, no prose and no code fence:
{"order":[id,id,id,id,id,id,id,id,id,id],"leadReason":"one short sentence"}
using the numeric ids given to you, exactly ten, no repeats.`;

/**
 * Runs the Newsletter Manager. Returns the ten chosen stories in running order.
 * A malformed or non-compliant answer falls back to the deterministic spread
 * rather than failing the week.
 */
async function chooseIssue(site, think, progress, candidates) {
  const menu = candidates
    .map((c) => `${c.id} | ${c.category} | ${c.title} | ${c.excerpt.slice(0, 120)}`)
    .join("\n");

  await progress(`choosing 10 from ${candidates.length} articles`);

  const raw = await think({
    system: SYSTEM(site),
    user: `Articles available (id | category | headline | standfirst):\n\n${menu}\n\nChoose ten and order them.`,
    maxTokens: 1500,
    // Ranking a menu of forty headlines is not a job for the expensive model.
    // Measured on the real list: sonnet 7.5s, opus 11.1s, and sonnet gave the
    // better justification for its lead.
    model: "claude-sonnet-5",
  });

  try {
    const json = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, "").trim());
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const picked = (json.order ?? []).map((id) => byId.get(id)).filter(Boolean);
    const unique = [...new Map(picked.map((p) => [p.id, p])).values()];

    if (unique.length === STORY_COUNT && spreadIsAcceptable(unique)) {
      return { stories: unique, leadReason: json.leadReason ?? "", source: "agent" };
    }
    return {
      stories: selectStories(candidates),
      leadReason: "",
      source: `fallback (agent returned ${unique.length} stories, spread ${spreadIsAcceptable(unique) ? "ok" : "breached"})`,
    };
  } catch {
    return { stories: selectStories(candidates), leadReason: "", source: "fallback (unparseable reply)" };
  }
}

// ---- preflight ----

/** Every link must resolve before ten thousand people get sent it. */
async function checkLinks(stories) {
  const dead = [];
  await Promise.all(
    stories.map(async (s) => {
      try {
        const r = await fetch(s.link, { method: "HEAD", headers: { "User-Agent": userAgent(site, "Newsletter/1.0") } });
        if (!r.ok) dead.push(`${s.link} -> ${r.status}`);
      } catch (e) {
        dead.push(`${s.link} -> ${e.message}`);
      }
    })
  );
  return dead;
}

function validateSections(sections) {
  const problems = [];
  for (const key of SECTION_KEYS) {
    const html = sections[key];
    if (!html || html.trim().length < 50) problems.push(`${key} is empty`);
    if (/undefined|null|\[object/.test(html ?? "")) problems.push(`${key} contains a broken value`);
    if (/src=""/.test(html ?? "")) problems.push(`${key} has an image with no source`);
  }
  return problems;
}

// ---- orchestration ----

export function issueDate(now) {
  return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Build and send this week's issue. Fails CLOSED: any problem aborts before a
 * campaign is created, so a bad week is a missing email rather than a broken one.
 */
export async function runNewsletter(site, { creds, dryRun = false, logoBase64 = null } = {}) {
  const mailchimp = creds?.mailchimp;
  if (!site?.newsletterEnabled) return { skipped: "newsletter switched off for this title" };
  if (!isNewsletterEnabled()) return { skipped: "NEWSLETTER_ENABLED=false" };
  if (!isNewsletterConfigured(mailchimp)) {
    return { skipped: "needs MAILCHIMP_API_KEY, ANTHROPIC_API_KEY and this title's audience id" };
  }

  const from = mailchimp.fromEmail;
  if (!from) return { skipped: "no from address on this title's Mailchimp credential" };
  const domain = await sendingDomainReady(from);
  if (!domain.ok) return { skipped: `cannot send as ${from}: ${domain.why}` };

  const health = await lastIssueHealth(mailchimp.audienceId);
  if (!health.ok) {
    return { skipped: `previous issue unhealthy: ${health.reasons.join(", ")}`, health };
  }

  const audienceId = mailchimp.audienceId;

  return runAgent(site, "newsletter", "weekly_issue", `Build and send the ${site.name} weekly issue`, async ({ think, progress, say }) => {
    const candidates = await fetchCandidates(creds?.wordpress, 40);
    if (candidates.length < STORY_COUNT) {
      throw new Error(`only ${candidates.length} articles with images available, need ${STORY_COUNT}`);
    }

    const { stories, leadReason, source } = await chooseIssue(site, think, progress, candidates);

    await progress("checking every link resolves");
    const dead = await checkLinks(stories);
    if (dead.length) throw new Error(`dead links, refusing to send: ${dead.join("; ")}`);

    const sections = renderSections(stories);
    const problems = validateSections(sections);
    if (problems.length) throw new Error(`render failed validation: ${problems.join("; ")}`);

    if (dryRun) {
      return {
        summary: `Dry run: ${stories.length} stories chosen by ${source}`,
        stories: stories.map((s) => ({ id: s.id, title: s.title, category: s.category })),
        leadReason,
      };
    }

    await progress("building the campaign in Mailchimp");
    const logoUrl = await ensureLogo(site, logoBase64);
    const templateId = await ensureTemplate(site, renderShell({ site, issueDate: issueDate(new Date()), logoUrl }));

    const lead = stories[0];
    const campaign = await mc("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: audienceId },
        settings: {
          subject_line: lead.title.slice(0, 145),
          preview_text: stories[1]?.title.slice(0, 145) ?? "",
          title: `${site.name} Weekly - ${issueDate(new Date())}`,
          from_name: `${site.authorName || "The editor"} | ${site.name}`,
          // Mailchimp has one address field: this is both the From and where
          // replies go. news@ forwards to jb@ so they land in Gmail.
          reply_to: from,
          auto_footer: false,
        },
      }),
    });

    await mc(`/campaigns/${campaign.id}/content`, {
      method: "PUT",
      body: JSON.stringify({ template: { id: templateId, sections } }),
    });

    await mc(`/campaigns/${campaign.id}/actions/send`, { method: "POST" });

    await say(
      "director",
      `${site.name} Weekly sent`,
      `${stories.length} stories, lead "${lead.title}". Selection by ${source}.`
    );

    return {
      summary: `Sent: lead "${lead.title.slice(0, 60)}" (${source})`,
      campaignId: campaign.id,
      editUrl: `${creds().admin}/campaigns/edit?id=${campaign.web_id}`,
      stories: stories.map((s) => ({ id: s.id, title: s.title, category: s.category })),
      leadReason,
    };
  });
}
