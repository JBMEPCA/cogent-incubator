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
  spliceSections,
  campaignId,
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
// The agent string this host accepts from a datacentre.
//
// On 20 August 2026 the weekly issue died on a 403 fetching its own candidate
// list, while lib/wordpress.js read 40 posts from the same site four minutes
// earlier. The difference was this header: "CogentBot/1.0" is waved through and
// the descriptive userAgent(site, ...) string is refused. Every outbound call in
// this file now uses the one that works, because the failure is invisible until
// a Thursday and the cost of it is a whole week.
const SITE_AGENT = "CogentBot/1.0";

export function isNewsletterConfigured(mailchimp) {
  return Boolean(process.env.MAILCHIMP_API_KEY && process.env.ANTHROPIC_API_KEY && mailchimp?.audienceId);
}

export function isNewsletterEnabled() {
  // Kill switch. Set NEWSLETTER_ENABLED=false to halt without touching code.
  return process.env.NEWSLETTER_ENABLED !== "false";
}

// ---- Mailchimp ----

// Named mailchimpCreds, not creds, because runNewsletter takes a { creds }
// parameter that shadows this for its whole body. On 20 August the weekly issue
// SENT to 2,021 people and then threw "a is not a function": the last line of
// the success path called creds().admin to build an edit link, and inside that
// function creds is the site credentials object, not this.
//
// The run was recorded as failed on an issue that had gone out, which is the
// dangerous kind of wrong - the obvious next move is to send it again.
//
// The dry run could never have caught it: ?dry=1 returns before this line, so
// the one broken statement is the one the rehearsal skips.
function mailchimpCreds() {
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
  const c = mailchimpCreds();
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
// ---- lead pinning ----

// An editor's override of the agent's lead, for one issue only.
//
// The agent re-ranks from scratch every run, so "make X the lead" cannot be
// held in a conversation — the next run forgets it. This is where that decision
// lives between being made and being sent. It is CONSUMED by a real send, so a
// pin set for one Thursday cannot silently lead every issue after it.
const LEAD_PIN_KEY = "newsletter_lead_pin";

export async function getLeadPin(site) {
  const row = await forSite(site.id).engineSetting.findUnique({ where: { key: LEAD_PIN_KEY } });
  return row?.value ?? null;
}

export async function setLeadPin(site, articleId) {
  const db = forSite(site.id);
  if (!articleId) return db.engineSetting.deleteMany({ where: { key: LEAD_PIN_KEY } });
  return db.engineSetting.upsert({
    where: { key: LEAD_PIN_KEY },
    create: { key: LEAD_PIN_KEY, value: String(articleId) },
    update: { value: String(articleId) },
  });
}

/**
 * Move the pinned article to the front, keeping ten stories.
 *
 * If the agent already chose it, this is a reorder. If it did not, the pinned
 * article displaces the LAST story rather than the agent's lead-in-waiting,
 * which keeps the strongest nine the agent found.
 */
function applyLeadPin(stories, candidates, pinnedId) {
  if (!pinnedId) return { stories, pinned: false };
  const id = String(pinnedId);
  const already = stories.find((s) => String(s.id) === id);
  if (already) {
    return { stories: [already, ...stories.filter((s) => s !== already)], pinned: true };
  }
  const fromCandidates = candidates.find((c) => String(c.id) === id);
  // A pin for an article that has aged out of the window is ignored, not fatal:
  // a missing override should cost the running order, never the issue.
  if (!fromCandidates) return { stories, pinned: false, missing: id };
  return { stories: [fromCandidates, ...stories.slice(0, STORY_COUNT - 1)], pinned: true };
}

/**
 * The wordmark's URL if it has already been uploaded, without uploading one.
 *
 * Paginated, because "the newest 50 files" is not the same question as "does
 * this file exist". The Mailchimp account is shared with every other CIM title
 * and holds ten thousand images, so a weekly wordmark is pushed off the first
 * page within days — and the caller then uploaded another copy. The account had
 * smart-sme-wordmark.png through smart-sme-wordmark.04.png, one per issue,
 * because Mailchimp silently renames a duplicate rather than rejecting it.
 */
async function findLogo(site) {
  const LOGO_NAME = `${site?.slug || "title"}-wordmark.png`;
  const PAGE = 1000;
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const list = await mc(
      `/file-manager/files?count=${PAGE}&offset=${offset}&fields=files.name,files.full_size_url`
    );
    const files = list.files ?? [];
    const hit = files.find((f) => f.name === LOGO_NAME);
    if (hit) return hit.full_size_url;
    if (files.length < PAGE) break; // last page
  }
  return null;
}

async function ensureLogo(site, pngBase64) {
  const LOGO_NAME = `${site?.slug || "title"}-wordmark.png`;
  const hit = await findLogo(site);
  if (hit) return hit;
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
// The shortest gap allowed between two issues to one audience.
//
// There was no guard at all. Every check in runNewsletter is about whether a
// send CAN happen - config, sending domain, the previous issue's bounce rate -
// and none about whether one already had. On 20 August the issue sent to 2,021
// people and then threw on a later line, so the agent showed BLOCKED with a
// "Wake Newsletter Manager now" button next to it. Pressing that would have
// sent the same issue to the same 2,021 people a second time.
//
// 72 hours rather than 6 days, so a deliberate mid-week send is still possible
// and only an accidental repeat is caught. force:true overrides it outright.
const MIN_GAP_HOURS = 72;

/** When this audience last received an issue, or null. */
export async function lastIssueSentAt(audienceId) {
  const reports = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC`);
  const r = (reports.reports ?? []).find((x) => x.list_id === audienceId && x.send_time);
  return r ? new Date(r.send_time) : null;
}

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
  // count=200, because this endpoint returns TEN by default and says nothing
  // about the rest. The account's domains are listed alphabetically, so adding
  // news.airportbusinessmagazine.com, news.barberingbusiness.com and
  // news.golfresortmagazine.com pushed news.smartsme.co.uk to twelfth — and a
  // send that had worked every Thursday for months began reporting the domain
  // as "not registered with Mailchimp". The title that breaks is not the one
  // being added, and nothing about it changed.
  const d = await mc("/verified-domains?count=200");
  const hit = (d.domains ?? []).find((x) => x.domain.toLowerCase() === domain);
  if (!hit) return { ok: false, why: `${domain} is not registered with Mailchimp` };
  if (!hit.verified) return { ok: false, why: `${domain} is not verified` };
  if (!hit.authenticated) return { ok: false, why: `${domain} is verified but DKIM is not authenticated yet` };
  return { ok: true, domain };
}

// ---- candidates ----

/** Everything published, newest first, with the fields the email needs. */
export async function fetchCandidates(wp, limit = 40, site = null) {
  const base = String(wp?.url || "").replace(/\/$/, "");
  if (!base) throw new Error("No WordPress credential for this title, so there are no articles to build an issue from.");
  const url = `${base}/wp-json/wp/v2/posts?per_page=${limit}&_embed=wp:featuredmedia,wp:term&orderby=date&order=desc`;
  // This host rejects server fetches with no user agent. `site` is threaded in
  // rather than read from a module scope it never had: userAgent(site) was an
  // outright ReferenceError here, so the weekly issue died fetching its own
  // candidates — the first step of the job.
  // AUTHENTICATED, and retried. This was the only WordPress read in the app
  // that went out without credentials, and on 20 August 2026 it cost a weekly
  // issue: the host returned 403 and the newsletter died on the first step of
  // its job, with 2,021 subscribers expecting it.
  //
  // The host blocks datacentre traffic that cannot identify itself. Every other
  // read here carries the application password and is waved through, which is
  // why publishing to the same site worked all that morning while this failed.
  // A user agent alone is not identification.
  //
  // The content-type check matters as much as the status: sg-security answers a
  // challenge with 200 and an HTML captcha page, which JSON.parse then rejects
  // with something that reads nothing like a blocked request.
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  let posts = null;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        authorization: `Basic ${auth}`,
        // Deliberately the SAME agent string as lib/wordpress.js fetchPosts,
        // which read 40 live posts from this host four minutes before this call
        // was refused. Two requests to one site from one datacentre, one waved
        // through and one 403d, differing in the agent and the _embed - so both
        // were aligned rather than guessed at one at a time.
        "user-agent": SITE_AGENT,
      },
    });
    lastStatus = res.status;
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("json")) {
      posts = await res.json();
      break;
    }
    lastBody = (await res.text()).replace(/<[^>]+>/g, " ").replace(/s+/g, " ").trim().slice(0, 180);
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  // The body, not just the status. A bare "WordPress returned 403" says nothing
  // about whether it was the host, a WAF rule or WordPress itself, and that
  // guess cost a second deploy cycle on the morning an issue was already missed.
  if (!posts) throw new Error(`WordPress returned ${lastStatus} for the candidate list: ${lastBody || "(empty body)"}`);

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
- Slot 1 is the lead and gets a large image. Pick the article most likely to make one of the busy readers named above stop and read: something with a deadline, a cost, a legal obligation or a decision they have to make. Prefer consequence over novelty.
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
    // Thinking and output share this budget, and the output itself is tiny —
    // ten ids and a sentence. 1500 was enough until it wasn't: Golf's run on
    // 25 Aug 2026 spent the lot reasoning about a 23-article shortlist and
    // returned truncated JSON, which fails the whole issue rather than
    // degrading. The headroom costs nothing on a run that does not use it.
    maxTokens: 6000,
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
async function checkLinks(stories, site = null) {
  const dead = [];
  await Promise.all(
    stories.map(async (s) => {
      try {
        // HEAD first, then GET. A HEAD is cheap and enough to prove a page is
        // there, but some WAF rules refuse the method outright, and a link
        // wrongly called dead blocks the whole issue: every one of the ten
        // stories was reported dead on 20 August by a check that was being
        // refused rather than answered.
        let r = await fetch(s.link, { method: "HEAD", headers: { "user-agent": SITE_AGENT } });
        if (!r.ok) r = await fetch(s.link, { headers: { "user-agent": SITE_AGENT } });
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
    // The tagging rule, enforced rather than documented. Anyone adding a link to
    // a slot later gets a refused send instead of a month of traffic quietly
    // landing in Direct where it cannot be told apart from bookmarks.
    for (const href of untaggedLinks(html ?? "")) {
      problems.push(`${key} has an untagged link: ${href}`);
    }
  }
  return problems;
}

/** Outbound http(s) links in a fragment that are missing utm_source. */
function untaggedLinks(html) {
  const found = [];
  for (const m of html.matchAll(/href="(https?:[^"]+)"/gi)) {
    // Rendered HTML, so & is escaped; unescape before looking for the parameter.
    if (!/[?&]utm_source=/.test(m[1].replace(/&amp;/g, "&"))) found.push(m[1]);
  }
  return found;
}

// ---- orchestration ----

export function issueDate(now) {
  return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Build and send this week's issue. Fails CLOSED: any problem aborts before a
 * campaign is created, so a bad week is a missing email rather than a broken one.
 */
export async function runNewsletter(site, { creds, dryRun = false, logoBase64 = null, force = false } = {}) {
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
  // Refuse a repeat before anything is built or spent.
  if (!force) {
    const sentAt = await lastIssueSentAt(audienceId);
    const hours = sentAt ? (Date.now() - sentAt.getTime()) / 36e5 : Infinity;
    if (hours < MIN_GAP_HOURS) {
      return {
        skipped: `an issue already went to this audience ${Math.round(hours)} hours ago; refusing to send again inside ${MIN_GAP_HOURS}h`,
        lastSentAt: sentAt,
      };
    }
  }

  return runAgent(site, "newsletter", "weekly_issue", `Build and send the ${site.name} weekly issue`, async ({ think, progress, say }) => {
    const candidates = await fetchCandidates(creds?.wordpress, 40, site);
    if (candidates.length < STORY_COUNT) {
      throw new Error(`only ${candidates.length} articles with images available, need ${STORY_COUNT}`);
    }

    const chosen = await chooseIssue(site, think, progress, candidates);
    let { stories } = chosen;
    const { leadReason, source } = chosen;

    const pinnedId = await getLeadPin(site);
    const pin = applyLeadPin(stories, candidates, pinnedId);
    stories = pin.stories;
    if (pin.pinned) await progress(`lead pinned by editor: ${stories[0].title.slice(0, 60)}`);
    if (pin.missing) await progress(`pinned lead ${pin.missing} is no longer in the window, using the agent's`);

    await progress("checking every link resolves");
    const dead = await checkLinks(stories, site);
    if (dead.length) throw new Error(`dead links, refusing to send: ${dead.join("; ")}`);

    // One id for the whole issue, shared by the stories and the chrome, so a
    // week's traffic can be read as a single campaign in GA4. Named utm- to keep
    // it clear of the Mailchimp campaign object created further down.
    const now = new Date();
    const utmCampaign = campaignId(now);

    const sections = renderSections(stories, { campaign: utmCampaign });
    const problems = validateSections(sections);
    if (problems.length) throw new Error(`render failed validation: ${problems.join("; ")}`);

    if (dryRun) {
      // The proof is the whole point of a dry run: a story list cannot show a
      // broken image, a headline that wraps badly, or a lead with no standfirst.
      // Nothing here writes to Mailchimp — the logo is looked up, never
      // uploaded, and no campaign or template is created.
      await progress("rendering the proof");
      // The wordmark is looked up, never uploaded. A title that has not sent
      // yet has no file in Mailchimp, and a proof must not be the thing that
      // creates one — so fall back to the public badge the outreach mail uses.
      const logoUrl =
        (await findLogo(site)) ||
        (process.env.APP_URL
          ? new URL(`/api/brand/logo/${site.slug}`, process.env.APP_URL).toString()
          : "");
      const proofHtml = spliceSections(
        renderShell({ site, issueDate: issueDate(now), logoUrl, campaign: utmCampaign }),
        sections
      );
      return {
        summary: `Dry run: ${stories.length} stories chosen by ${source}`,
        stories: stories.map((s) => ({ id: s.id, title: s.title, category: s.category })),
        leadReason: pin.pinned ? "lead pinned by the editor" : leadReason,
        leadPinned: pin.pinned,
        subject: stories[0].title.slice(0, 145),
        previewText: stories[1]?.title.slice(0, 145) ?? "",
        fromName: `${site.authorName || "The editor"} | ${site.name}`,
        html: proofHtml,
      };
    }

    await progress("building the campaign in Mailchimp");
    const logoUrl = await ensureLogo(site, logoBase64);
    const templateId = await ensureTemplate(
      site,
      renderShell({ site, issueDate: issueDate(now), logoUrl, campaign: utmCampaign })
    );

    const lead = stories[0];
    const campaign = await mc("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: audienceId },
        settings: {
          subject_line: lead.title.slice(0, 145),
          preview_text: stories[1]?.title.slice(0, 145) ?? "",
          title: `${site.name} Weekly - ${issueDate(now)}`,
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

    // Consumed, not kept: an override is for one issue. Cleared only after the
    // send actually happened, so a failed run keeps the editor's choice for the
    // retry rather than quietly reverting to the agent's.
    if (pin.pinned) await setLeadPin(site, null);

    await say(
      "director",
      `${site.name} Weekly sent`,
      `${stories.length} stories, lead "${lead.title}". Selection by ${source}.`
    );

    return {
      summary: `Sent: lead "${lead.title.slice(0, 60)}" (${source})`,
      campaignId: campaign.id,
      editUrl: `${mailchimpCreds().admin}/campaigns/edit?id=${campaign.web_id}`,
      stories: stories.map((s) => ({ id: s.id, title: s.title, category: s.category })),
      leadReason,
    };
  });
}
