/**
 * The Monday briefing: build and send.
 *
 * Thursday is the full weekly issue (lib/newsletter.js). Monday is the short
 * one, designed on 14 September 2026 and approved by JB on the 18th to go out
 * every Monday at 14:00: one featured story, then the three articles readers
 * read most last week. The design lives in lib/briefing-template.js.
 *
 * It reuses the weekly issue's plumbing on purpose - candidates, the sending
 * domain check, the previous-issue health check, the masthead upload - so the
 * two sends cannot disagree about what is safe. What it does NOT share is the
 * repeat-send guard: each product counts only its own campaigns, or a Monday
 * send would cancel that week's Thursday issue.
 *
 * Nothing here writes article copy. Headlines and standfirsts come from
 * WordPress; the subject line is the featured headline's own hook.
 */

import { runAgent } from "./agents/runtime";
import { forSite } from "./prisma";
import { titleBrief } from "./voice";
import { wordmarkFor, mastheadDisplayWidth } from "./brand/wordmarks";
import { getGoogleAccessToken, googlePost } from "./google";
import {
  mc,
  fetchCandidates,
  sendingDomainReady,
  lastIssueHealth,
  lastIssueSentAt,
  isNewsletterConfigured,
  isNewsletterEnabled,
  ensureLogo,
  parsePins,
  BRIEFING_TITLE_MARK,
} from "./newsletter";
import { renderBriefing, briefingCampaignId, BRIEFING_TITLES, shortHeadline } from "./briefing-template";

// Two sends a week to one list are deliberate, so this guard only has to catch
// an accidental repeat of the SAME Monday issue.
const MIN_GAP_HOURS = 72;
const MOST_READ = 3;

// An editor's choice for the featured story, and optionally the most-read
// three after it, as comma-separated WordPress ids. Consumed by a real send.
const PIN_KEY = "briefing_pin";

export async function getBriefingPin(site) {
  const row = await forSite(site.id).engineSetting.findUnique({ where: { key: PIN_KEY } });
  return row?.value ?? null;
}

async function clearBriefingPin(site) {
  await forSite(site.id).engineSetting.deleteMany({ where: { key: PIN_KEY } });
}

const pathOf = (link) => {
  try {
    return new URL(link).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
};

/** Last week's page views by path, Monday to Sunday. */
async function mostViewed(ga) {
  const pid = ga?.ga4PropertyId;
  if (!pid) return [];
  const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
  const res = await googlePost(token, `https://analyticsdata.googleapis.com/v1beta/properties/${String(pid).trim()}:runReport`, {
    dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 80,
  });
  return (res.rows || []).map((r) => ({ path: r.dimensionValues[0].value.replace(/\/+$/, ""), views: Number(r.metricValues[0].value) }));
}

/** Links in the most recent Thursday issue, so Monday does not repeat its lead. */
async function lastWeeklyLinks(audienceId, host) {
  const c = await mc(
    `/campaigns?list_id=${audienceId}&status=sent&count=5&sort_field=send_time&sort_dir=DESC&fields=campaigns.id,campaigns.send_time,campaigns.settings.title`
  );
  const weekly = (c.campaigns || []).find((x) => !String(x.settings?.title || "").includes(BRIEFING_TITLE_MARK));
  if (!weekly) return { sentAt: null, paths: new Set() };
  const html = (await mc(`/campaigns/${weekly.id}/content?fields=html`)).html || "";
  const re = new RegExp(`href="https://(?:www\\.)?${host.replace(/\./g, "\\.")}(/[^"?]*)`, "g");
  return { sentAt: new Date(weekly.send_time), paths: new Set([...html.matchAll(re)].map((m) => m[1].replace(/\/+$/, ""))) };
}

const isUsable = (p) => p && p.imageLead && !(p.tags || []).includes("guest-perspective");

/**
 * Drop any emoji a headline opens with, plus the space after it.
 *
 * Only for places that already put the title's own emoji in front, which today
 * means the subject line. Everywhere the headline is shown on its own the
 * eyebrow's emoji belongs to it and stays.
 */
const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*\s*)+/u;
export const stripLeadingEmoji = (title) => String(title).replace(LEADING_EMOJI, "").trim();

export function briefingDate(now) {
  return now.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Build and send this Monday's briefing. Fails CLOSED, like Thursday: any
 * problem aborts before a campaign exists, so a bad week is a missing email.
 */
export async function runBriefing(site, { creds, dryRun = false, testEmails = null, force = false } = {}) {
  const mailchimp = creds?.mailchimp;
  if (!site?.newsletterEnabled) return { skipped: "newsletter switched off for this title" };
  if (!isNewsletterEnabled()) return { skipped: "NEWSLETTER_ENABLED=false" };
  if (!isNewsletterConfigured(mailchimp)) return { skipped: "needs Mailchimp and this title's audience id" };
  if (!BRIEFING_TITLES[site.slug]) return { skipped: "no Monday briefing design for this title" };

  const from = mailchimp.fromEmail;
  if (!from) return { skipped: "no from address on this title's Mailchimp credential" };
  const domain = await sendingDomainReady(from);
  if (!domain.ok) return { skipped: `cannot send as ${from}: ${domain.why}` };

  const health = await lastIssueHealth(mailchimp.audienceId);
  // A dry run still renders, so a blocked title can be proofed; it just says so.
  if (!health.ok && !force && !dryRun) return { skipped: `previous issue unhealthy: ${health.reasons.join(", ")}`, health };
  const healthWarning = health.ok ? null : `would be BLOCKED: previous issue ${health.reasons.join(", ")}`;

  if (!force && !testEmails?.length) {
    const sentAt = await lastIssueSentAt(mailchimp.audienceId, { kind: "briefing" });
    const hours = sentAt ? (Date.now() - sentAt.getTime()) / 36e5 : Infinity;
    if (hours < MIN_GAP_HOURS) {
      return { skipped: `a Monday briefing already went to this list ${Math.round(hours)} hours ago`, lastSentAt: sentAt };
    }
  }

  const T = BRIEFING_TITLES[site.slug];
  const host = String(site.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  return runAgent(site, "newsletter", "monday_briefing", `Build and send ${T.name}`, async ({ think, progress, say }) => {
    await progress("reading last week's most read and the latest articles");
    const [candidates, views, thursday] = await Promise.all([
      fetchCandidates(creds?.wordpress, 40, site),
      mostViewed(creds?.google_analytics).catch(() => []),
      lastWeeklyLinks(mailchimp.audienceId, host).catch(() => ({ sentAt: null, paths: new Set() })),
    ]);

    // Most-read articles can be older than the newest forty.
    const byPath = new Map(candidates.map((c) => [pathOf(c.link), c]));
    const missing = views
      .slice(0, 25)
      .map((v) => v.path.replace(/^\//, ""))
      .filter((s) => s && !s.includes("/") && !byPath.has(`/${s}`));
    if (missing.length) {
      const extra = await fetchCandidates(creds?.wordpress, missing.length, site, null, missing).catch(() => []);
      for (const e of extra) byPath.set(pathOf(e.link), e);
    }
    const byId = new Map([...byPath.values()].map((p) => [String(p.id), p]));

    // Editor's pin first, then the rule.
    const pins = parsePins(await getBriefingPin(site));
    const pinnedLead = pins[0] && byId.get(pins[0]);

    let lead = isUsable(pinnedLead) ? pinnedLead : null;
    let leadReason = lead ? "pinned by the editor" : "";
    if (!lead) {
      // New since Thursday's issue and not already in it. Monday's job is the
      // week's fresh news, not a rerun of what went out four days ago.
      const since = thursday.sentAt ? thursday.sentAt.getTime() : Date.now() - 4 * 864e5;
      const fresh = candidates.filter(
        (c) => isUsable(c) && new Date(c.date).getTime() > since && !thursday.paths.has(pathOf(c.link))
      );
      const pool = fresh.length ? fresh : candidates.filter((c) => isUsable(c) && !thursday.paths.has(pathOf(c.link)));
      if (!pool.length) throw new Error("no usable article for the featured slot");
      if (pool.length === 1) {
        lead = pool[0];
      } else {
        await progress(`choosing the featured story from ${pool.length} new articles`);
        // Non-fatal. The send needs Mailchimp and WordPress, not the model: a
        // credit outage on a Monday (there were five in three weeks) falls
        // back to the newest new article instead of cancelling the issue.
        const raw = await think({
          system: `${titleBrief(site)}

You choose the FEATURED story for this title's short Monday email. Pick the one article most likely to make a busy reader open it and click: news with a consequence for their business this week - a deadline, a cost, a rule, a named company's move - over general explainers.

Today is ${briefingDate(new Date())}. Never pick a story whose deadline, closing date or event has already passed: a reader opening it today would be told about something they can no longer act on.${T.taste ? `\n\n${T.taste}` : ""}

Reply with ONLY JSON, no prose and no code fence: {"id": <numeric id>, "reason": "one short sentence"}`,
          user: pool.map((c) => `${c.id} | ${c.category} | ${c.title} | ${c.excerpt.slice(0, 140)}`).join("\n"),
          maxTokens: 4000,
          model: "claude-sonnet-5",
        }).catch((e) => { leadReason = `picker unavailable (${String(e.message).slice(0, 60)})`; return ""; });
        try {
          const j = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, "").trim());
          lead = pool.find((c) => String(c.id) === String(j.id)) || null;
          leadReason = j.reason || "";
        } catch {
          /* fall through */
        }
        if (!lead) {
          lead = pool[0];
          leadReason = `fallback: newest new article${leadReason ? `, ${leadReason}` : ""}`;
        }
      }
    }

    // Most read: pinned positions 2-4 if set, otherwise by last week's views.
    let mostRead = pins
      .slice(1, 1 + MOST_READ)
      .map((id) => id && byId.get(id))
      .filter((p) => p && p.imageSquare && String(p.id) !== String(lead.id));
    if (mostRead.length < MOST_READ) {
      const taken = new Set([String(lead.id), ...mostRead.map((p) => String(p.id))]);
      const ranked = [];
      for (const v of views) {
        const p = byPath.get(v.path);
        if (!p || taken.has(String(p.id)) || !isUsable(p) || !p.imageSquare || ranked.includes(p)) continue;
        ranked.push(p);
      }
      const need = MOST_READ - mostRead.length;
      let chosen = ranked.slice(0, need);
      // A title with a stated taste picks its three from the ten most read,
      // not strictly the top three, so the block is still honestly "most read"
      // but never three back-office pieces in a row.
      if (T.taste && ranked.length > need) {
        const top = ranked.slice(0, 10);
        try {
          const raw = await think({
            system: `${titleBrief(site)}\n\n${T.taste}\n\nThese are last week's most-read articles, most read first. Choose the ${need} that will make the Monday email most appealing to open, keeping the most read where it fits. Reply with ONLY JSON: {"ids":[id,...]}`,
            user: top.map((c) => `${c.id} | ${c.category} | ${c.title}`).join("\n"),
            maxTokens: 3000,
            model: "claude-sonnet-5",
          });
          const ids = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, "").trim()).ids.map(String);
          const picked = ids.map((id) => top.find((c) => String(c.id) === id)).filter(Boolean);
          if (picked.length === need && new Set(picked).size === need) chosen = picked;
        } catch {
          /* keep strict view order */
        }
      }
      for (const p of chosen) {
        mostRead.push(p);
        taken.add(String(p.id));
      }
    }
    // A young title may not have three read articles yet. Fill from the newest
    // so the block is never short, and say so.
    let filled = 0;
    if (mostRead.length < MOST_READ) {
      const taken = new Set([String(lead.id), ...mostRead.map((p) => String(p.id))]);
      for (const c of candidates) {
        if (mostRead.length >= MOST_READ) break;
        if (taken.has(String(c.id)) || !isUsable(c) || !c.imageSquare) continue;
        mostRead.push(c);
        taken.add(String(c.id));
        filled++;
      }
    }
    if (mostRead.length < MOST_READ) throw new Error(`only ${mostRead.length} most-read articles with pictures`);

    const now = new Date();
    const campaign = briefingCampaignId(now);
    // The inbox preview line: three short teases, not three full headlines.
    // Full headlines ran to 200 characters and were cut mid-word at 145.
    const DANGLING = /\s+(?:at|on|to|for|in|of|as|and|with|the|a|an|by|from|after)$/i;
    const tease = (t) => {
      let s = shortHeadline(t).replace(/^[^A-Za-z]+/, "");
      // An interview teases as the person: "Brenda Sunley", not the franchise.
      const iv = s.match(/^.{0,40}?(?:Leaders?|In the Chair)\s*:\s*(.+?)\s+on\s/i);
      if (iv) return iv[1];
      s = s.split(": ")[0].split(/,\s/)[0].trim();
      if (s.length > 40) s = s.slice(0, s.lastIndexOf(" ", 40));
      while (DANGLING.test(s)) s = s.replace(DANGLING, "");
      return s;
    };
    const list = mostRead.map((p) => tease(p.title));
    let previewText = `Plus last week's most read: ${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
    if (previewText.length > 150) previewText = previewText.slice(0, previewText.lastIndexOf(" ", 147)) + "...";
    // An interview headline carries its franchise eyebrow's own emoji ("🪑 In
    // the Chair: ..."), and the title's emoji is prepended in front of it, so
    // Rob Wood's issue reached the inbox as "💈 🪑 In the Chair: ...". One emoji
    // reads as the title's mark; two read as a mistake, before the reader has
    // got to a single word of the headline. The title's own emoji wins, and the
    // eyebrow keeps its emoji everywhere it is shown in context - in the body of
    // the email, on the site and in the most-read list. This is the subject line
    // only.
    const subject = `${T.emoji ? `${T.emoji} ` : ""}${stripLeadingEmoji(shortHeadline(lead.title))}`.slice(0, 145);
    const mark = wordmarkFor(site.slug);
    const logoB64 = (mark?.masthead || mark?.png)?.toString("base64") || null;
    const logoWidth = mark ? mastheadDisplayWidth(mark) : null;

    const render = (logoUrl) =>
      renderBriefing({
        site,
        issueDate: briefingDate(now),
        logoUrl,
        logoWidth,
        campaign,
        lead,
        mostRead,
        previewText,
        thursday: true,
      });

    // Same fail-closed checks as Thursday: every link tagged, nothing broken.
    const probe = render("https://example.invalid/logo.png");
    // Anchors only: the web-font <link> is a stylesheet, not a click.
    const untagged = [...probe.matchAll(/<a\s[^>]*href="(https?:[^"]+)"/gi)]
      .map((m) => m[1].replace(/&amp;/g, "&"))
      .filter((h) => !h.includes("example.invalid") && !/[?&]utm_source=/.test(h));
    if (untagged.length) throw new Error(`untagged links: ${untagged.join(", ")}`);
    if (/undefined|\[object|src=""/.test(probe)) throw new Error("render contains a broken value");

    const summaryStories = {
      featured: { id: lead.id, title: lead.title },
      mostRead: mostRead.map((p) => ({ id: p.id, title: p.title })),
    };

    if (dryRun) {
      return {
        summary: `Dry run: featured "${shortHeadline(lead.title).slice(0, 60)}"${filled ? `, ${filled} most-read filled from newest` : ""}`,
        subject,
        previewText,
        fromName: `${site.authorName || "The editor"} | ${site.name}`,
        leadReason,
        healthWarning,
        ...summaryStories,
        html: render(
          process.env.APP_URL ? new URL(`/api/brand/logo/${site.slug}?kind=masthead`, process.env.APP_URL).toString() : ""
        ),
      };
    }

    await progress("building the campaign in Mailchimp");
    const logoUrl = await ensureLogo(site, logoB64);
    const created = await mc("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: mailchimp.audienceId },
        settings: {
          subject_line: subject,
          preview_text: previewText,
          title: `${site.name} ${BRIEFING_TITLE_MARK} - ${briefingDate(now)}`,
          from_name: `${site.authorName || "The editor"} | ${site.name}`,
          reply_to: from,
          auto_footer: false,
        },
      }),
    });
    await mc(`/campaigns/${created.id}/content`, { method: "PUT", body: JSON.stringify({ html: render(logoUrl) }) });

    if (testEmails?.length) {
      await mc(`/campaigns/${created.id}/actions/test`, {
        method: "POST",
        body: JSON.stringify({ test_emails: testEmails, send_type: "html" }),
      });
      await mc(`/campaigns/${created.id}`, { method: "DELETE" });
      return { summary: `Proof sent to ${testEmails.join(", ")}: "${subject}"`, subject, ...summaryStories };
    }

    await mc(`/campaigns/${created.id}/actions/send`, { method: "POST" });
    if (pins.some(Boolean)) await clearBriefingPin(site);
    await say("director", `${T.name} sent`, `Featured "${lead.title}". ${leadReason}`);
    return { summary: `Sent: "${subject}"`, campaignId: created.id, subject, ...summaryStories };
  });
}
