/**
 * Reporting for past issues, read from Mailchimp and cached briefly.
 *
 * This said "no cron and no local copy, caching would buy nothing" — which was
 * right about freshness and wrong about latency. A report is four Mailchimp
 * calls in two serial rounds, two of them pulling 200 records, and the page is
 * force-dynamic, so every single navigation to it paid the full round trip.
 * That is what made the newsletter page the slowest screen in the app.
 *
 * Fifteen minutes is well inside how often these numbers actually move: opens
 * and clicks on an issue sent yesterday do not change materially within a
 * quarter of an hour.
 */

import { unstable_cache } from "next/cache";
import { mc } from "./newsletter";

// The audience id is the title's own, passed in rather than read from the
// environment: on a shared Mailchimp account a wrong list id does not error, it
// quietly reports another magazine's numbers as yours.

const pct = (v) => (typeof v === "number" ? v : null);

/**
 * Every issue this audience has been sent, newest first.
 *
 * /reports ignores list_id, so it is filtered here. That is not a nicety: on a
 * shared account the newest campaign is usually another magazine's.
 */
export async function issueHistory(audienceId, limit = 24) {
  const data = await mc(`/reports?count=200&type=regular&sort_field=send_time&sort_dir=DESC`);
  return (data.reports ?? [])
    .filter((r) => r.list_id === audienceId && r.emails_sent > 0)
    .slice(0, limit)
    .map((r) => {
      const hard = r.bounces?.hard_bounces ?? 0;
      const soft = r.bounces?.soft_bounces ?? 0;
      return {
        id: r.id,
        webId: r.web_id,
        title: r.campaign_title,
        subject: r.subject_line,
        sentAt: r.send_time,
        sent: r.emails_sent,
        delivered: r.emails_sent - hard - soft,
        openRate: pct(r.opens?.open_rate),
        uniqueOpens: r.opens?.unique_opens ?? 0,
        clickRate: pct(r.clicks?.click_rate),
        uniqueClicks: r.clicks?.unique_clicks ?? 0,
        hardBounces: hard,
        softBounces: soft,
        unsubscribed: r.unsubscribed ?? 0,
        complaints: r.abuse_reports ?? 0,
      };
    });
}

/**
 * Which stories people actually clicked.
 *
 * Grouped by destination, not by link. Every story in the template is linked
 * three times over, from its image, its headline and its read-more, so
 * Mailchimp reports three separate rows for one article. Left ungrouped, a
 * story's clicks are split three ways and it can rank below something less
 * popular that happened to be linked once.
 */
export async function topLinks(campaignId, limit = 8) {
  const d = await mc(`/reports/${campaignId}/click-details?count=200`);

  const byUrl = new Map();
  for (const u of d.urls_clicked ?? []) {
    // Tracking params differ per position; the article is the same article.
    const key = (u.url ?? "").split("?")[0].replace(/\/$/, "");
    const prev = byUrl.get(key) ?? { url: key, clicks: 0, total: 0, links: 0 };
    prev.clicks += u.unique_clicks ?? 0;
    prev.total += u.total_clicks ?? 0;
    prev.links += 1;
    byUrl.set(key, prev);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.clicks - a.clicks || b.total - a.total)
    .slice(0, limit);
}

/** Subscriber count month by month. Shape varies by account age, so read it loosely. */
export async function growthHistory(audienceId, months = 12) {
  const d = await mc(`/lists/${audienceId}/growth-history?count=${months}&sort_field=month&sort_dir=DESC`);
  return (d.history ?? [])
    .map((h) => ({
      month: h.month,
      subscribed: h.subscribed ?? h.existing ?? 0,
      imports: h.imports ?? 0,
      optins: h.optins ?? 0,
      unsubscribed: h.unsubscribed ?? 0,
    }))
    .reverse();
}

/** Everything the page needs, with one failure never taking out the rest. */
async function buildNewsletterReport(audienceId) {
  const [list, issues] = await Promise.all([
    mc(`/lists/${audienceId}?fields=name,stats.member_count,stats.unsubscribe_count,stats.cleaned_count`).catch(() => null),
    issueHistory(audienceId).catch(() => []),
  ]);

  const [growth, links] = await Promise.all([
    growthHistory(audienceId).catch(() => []),
    issues[0] ? topLinks(issues[0].id).catch(() => []) : Promise.resolve([]),
  ]);

  const measurable = issues.filter((i) => i.sent > 0);
  const avg = (key) =>
    measurable.length
      ? measurable.reduce((s, i) => s + (i[key] ?? 0), 0) / measurable.length
      : null;

  return {
    audience: list?.name ?? null,
    subscribers: list?.stats?.member_count ?? 0,
    unsubscribes: list?.stats?.unsubscribe_count ?? 0,
    cleaned: list?.stats?.cleaned_count ?? 0,
    issues,
    growth,
    latestLinks: links,
    avgOpenRate: avg("openRate"),
    avgClickRate: avg("clickRate"),
    totalSent: issues.reduce((s, i) => s + i.sent, 0),
  };
}

/**
 * The cached entry point. Keyed on the audience, so two titles on the same
 * Mailchimp account never share an entry — the one mistake in this file that
 * would silently report another magazine's numbers as yours.
 */
export function newsletterReport(audienceId) {
  return unstable_cache(
    () => buildNewsletterReport(audienceId),
    ["newsletter-report", String(audienceId)],
    { revalidate: 900 }
  )();
}
