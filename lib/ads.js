import { prisma } from "./prisma";
import { siteCredentials } from "./site";
import { POSITIONS, SERVED_KEYS, checkCreative, positionInfo } from "./ad-positions";
import { ukDay } from "./campaigns";

// The incubator's half of ad serving. The other half is the cogent-ads
// mu-plugin on each title (cogent-base-theme/mu-plugins/cogent-ads.php).
//
// The incubator is the source of truth: what runs where, when, with which
// creative and to which URL. Each site keeps a copy (the feed below), pulled
// every few minutes and on demand, and serves and counts from that copy on its
// own domain. Nothing a reader loads ever calls the incubator, so a slow or
// down dashboard cannot slow a page or blank a slot, and the counting is first
// party for the same reasons as Pulse: the cookie banner and tracker lists do
// not see it.
//
// GETs to the sites carry a throwaway t= so SiteGround's cache, which keys on
// the full URL, can never answer one from an earlier response.
//
// Every call between the two carries PULSE_TOKEN in the query string. The
// SiteGround WAF answers 403 to wp-json requests with an Authorization header,
// and the plugin already holds that token as cogent_pulse_token.

const TIMEOUT_MS = 8000;
// How far ahead the feed reaches, so a booking starting at midnight is already
// on the site and its preview link works before launch.
const LOOKAHEAD_DAYS = 62;

export const fleetToken = () => (process.env.PULSE_TOKEN || "").trim();

/** Slug a campaign name for utm_campaign: "Miele 360PRO 2027" becomes "miele-360pro-2027". */
export const utmSlug = (s = "") =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/**
 * The click-through URL with our tags, unless the client already tagged it
 * (their own UTMs win: it is their analytics the tags are for).
 */
export function taggedTarget(url, { site, campaign, position, medium = "display" }) {
  if (!/^https?:\/\//i.test(url || "")) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!u.searchParams.has("utm_source")) {
    u.searchParams.set("utm_source", (site?.domain || site?.slug || "cogent").replace(/^www\./, ""));
    u.searchParams.set("utm_medium", medium);
    u.searchParams.set("utm_campaign", utmSlug(campaign?.name));
    u.searchParams.set("utm_content", position);
  }
  return u.toString();
}

/**
 * The days a placement runs, as UK calendar days. A placement with a start and
 * no end runs to the end of its start month, which is how the month grid books
 * them; one with neither is not scheduled and never serves.
 */
export function runDays(d) {
  if (!d.dueDate) return null;
  const start = ukDay(d.dueDate);
  let end;
  if (d.runUntil) end = ukDay(d.runUntil);
  else {
    const [y, m] = start.split("-").map(Number);
    end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }
  return { start, end };
}

/** Where a placement stands today: scheduled | live | paused | ended | unscheduled | cancelled. */
export function liveState(d, now = new Date()) {
  if (d.status === "cancelled") return "cancelled";
  const run = runDays(d);
  if (!run) return "unscheduled";
  const today = ukDay(now);
  if (today > run.end) return "ended";
  if (d.paused) return "paused";
  if (today < run.start) return "scheduled";
  return "live";
}

export const LIVE_LABEL = {
  live: { label: "Live", chip: "chip-audience" },
  scheduled: { label: "Scheduled", chip: "chip-brand" },
  paused: { label: "Taken down", chip: "chip-monetise" },
  ended: { label: "Ended", chip: "chip-general" },
  unscheduled: { label: "No dates", chip: "chip-general" },
  cancelled: { label: "Cancelled", chip: "chip-general" },
};

/** The public URL the sites download a creative from. Unguessable id plus the fleet token. */
export function creativeUrl(assetId) {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return `${base}/api/ads/creative/${assetId}`;
}

/**
 * What one title should be running, for the plugin. Everything with a target
 * URL is included, served positions and email ones alike, because the email
 * click link (/cogent/v1/ads/go) is answered by the site and needs the target.
 */
export async function buildFeed(site, now = new Date()) {
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 864e5);
  const yesterday = new Date(now.getTime() - 864e5);
  const rows = await prisma.campaignDeliverable.findMany({
    where: {
      siteId: site.id,
      position: { not: null },
      status: { not: "cancelled" },
      campaign: { status: { not: "cancelled" } },
      dueDate: { lte: horizon },
      OR: [{ runUntil: null }, { runUntil: { gte: yesterday } }],
    },
    include: {
      campaign: { select: { name: true, advertiser: { select: { company: true } } } },
      assets: {
        where: { active: true, webData: { not: null } },
        select: { id: true, webWidth: true, webHeight: true, webMime: true, width: true, height: true, name: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const ads = [];
  for (const d of rows) {
    const run = runDays(d);
    if (!run || run.end < ukDay(now)) continue;
    const info = positionInfo(d.position);
    if (!info) continue;
    ads.push({
      id: d.id,
      position: d.position,
      served: Boolean(info.served),
      start: run.start,
      end: run.end,
      paused: d.paused,
      advertiser: d.campaign.advertiser.company,
      href: taggedTarget(d.targetUrl, { site, campaign: d.campaign, position: d.position, medium: info.email ? "email" : "display" }),
      creatives: d.assets.map((a) => ({
        id: a.id,
        width: a.width,
        height: a.height,
        // The size it should be drawn at on the page: the slot's own, so a 2x
        // file is shown sharp rather than twice as big.
        slot: checkCreative(d.position, { width: a.width, height: a.height }).fits || [a.webWidth, a.webHeight],
        mime: a.webMime,
        url: creativeUrl(a.id),
      })),
    });
  }
  return { site: site.slug, generated: now.toISOString(), positions: SERVED_KEYS, ads };
}

async function siteBase(site) {
  const { creds } = await siteCredentials(site.id);
  const base = creds?.wordpress?.url;
  return base ? String(base).replace(/\/$/, "") : null;
}

/**
 * Ask one title to pull its feed now, so a swap or a takedown is on the site
 * in seconds rather than at the next five-minute refresh. Best effort: if the
 * site does not answer, the scheduled refresh still catches up.
 */
export async function refreshSite(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  const token = fleetToken();
  if (!site || !token) return { ok: false, why: "no site or no token" };
  const base = await siteBase(site);
  if (!base) return { ok: false, why: "no WordPress URL" };
  try {
    const res = await fetch(`${base}/wp-json/cogent/v1/ads/refresh?token=${encodeURIComponent(token)}&t=${Date.now()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "CogentDashboard/1.0" },
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, why: String(e.message || e) };
  }
}

/** Refresh every title a set of deliverables touches, without holding up the caller for long. */
export async function refreshSites(siteIds) {
  const ids = [...new Set(siteIds.filter(Boolean))];
  return Promise.all(ids.map((id) => refreshSite(id)));
}

/**
 * Pull one title's counts into AdStat. The plugin reports whole days in the
 * site's timezone; re-reading a day overwrites it, so a nightly pull of the
 * last few days is idempotent and catches late beacons.
 */
export async function pullSiteStats(site, days = 4) {
  const token = fleetToken();
  const base = await siteBase(site);
  if (!base || !token) return { site: site.slug, skipped: "no WordPress URL or token" };
  const res = await fetch(`${base}/wp-json/cogent/v1/ads/report?days=${days}&token=${encodeURIComponent(token)}&t=${Date.now()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS * 2),
    headers: { "user-agent": "CogentDashboard/1.0" },
    cache: "no-store",
  });
  if (res.status === 404) return { site: site.slug, skipped: "ad plugin not installed" };
  if (!res.ok) throw new Error(`${site.slug}: HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json?.rows) ? json.rows : [];

  // Only rows for placements that are really this title's: the report is the
  // site's word, and a stale or foreign id must not write against another.
  const ids = [...new Set(rows.map((r) => String(r.ad)))];
  const known = new Set(
    (await prisma.campaignDeliverable.findMany({ where: { id: { in: ids }, siteId: site.id }, select: { id: true } })).map((d) => d.id)
  );
  const assets = new Set(
    (await prisma.campaignAsset.findMany({ where: { id: { in: rows.map((r) => String(r.creative || "")).filter(Boolean) } }, select: { id: true } })).map(
      (a) => a.id
    )
  );

  let written = 0;
  for (const r of rows) {
    const deliverableId = String(r.ad);
    if (!known.has(deliverableId) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day || "")) continue;
    const assetKey = assets.has(String(r.creative)) ? String(r.creative) : "";
    const channel = r.channel === "email" ? "email" : "site";
    const position = String(r.position || "");
    const counts = { served: Number(r.served) || 0, views: Number(r.views) || 0, clicks: Number(r.clicks) || 0 };
    await prisma.adStat.upsert({
      where: { deliverableId_assetKey_position_channel_day: { deliverableId, assetKey, position, channel, day: new Date(`${r.day}T00:00:00Z`) } },
      update: counts,
      create: {
        deliverableId,
        assetKey,
        assetId: assetKey || null,
        siteId: site.id,
        position,
        channel,
        day: new Date(`${r.day}T00:00:00Z`),
        ...counts,
      },
    });
    written++;
  }
  return { site: site.slug, rows: rows.length, written };
}

/**
 * Who has each position on each title, month by month, for the availability
 * grid and the booking grid's clash check. Returns a Map keyed
 * `${siteId}|${position}|${YYYY-MM}` to a list of { campaignId, advertiser, deliverableId }.
 */
export async function bookingsMap({ from, to, excludeCampaignId } = {}) {
  const rows = await prisma.campaignDeliverable.findMany({
    where: {
      position: { not: null },
      siteId: { not: null },
      status: { not: "cancelled" },
      campaign: { status: { not: "cancelled" }, ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {}) },
      dueDate: { not: null, ...(to ? { lte: to } : {}) },
    },
    select: {
      id: true,
      siteId: true,
      position: true,
      dueDate: true,
      runUntil: true,
      campaign: { select: { id: true, name: true, advertiser: { select: { company: true } } } },
    },
  });
  const map = new Map();
  for (const d of rows) {
    const run = runDays(d);
    if (!run) continue;
    if (from && run.end < ukDay(from)) continue;
    let [y, m] = run.start.split("-").map(Number);
    const [ey, em] = run.end.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      const key = `${d.siteId}|${d.position}|${y}-${String(m).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ campaignId: d.campaign.id, campaign: d.campaign.name, advertiser: d.campaign.advertiser.company, deliverableId: d.id });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return map;
}

/**
 * What is still missing for a campaign, soonest first: artwork that is absent
 * or fails the spec, a target URL, email stats with nowhere to come from. The
 * deadline is the placement's material-due date, or five days before it starts.
 */
export function outstanding(campaign, now = new Date()) {
  const items = [];
  const today = ukDay(now);
  for (const d of campaign.deliverables) {
    if (!d.position || d.status === "cancelled") continue;
    const info = positionInfo(d.position);
    const run = runDays(d);
    if (run && run.end < today) continue;
    const due = d.assetsDue ? ukDay(d.assetsDue) : run ? ukDay(new Date(new Date(`${run.start}T12:00:00Z`).getTime() - 5 * 864e5)) : null;
    const push = (what, kind = "content") => items.push({ deliverable: d, what, due, kind, late: due ? due < today : false });

    if (!run) push("Pick the dates it runs", "booking");
    if ((info.served || d.position === "newsletter_banner") && !d.targetUrl) push("Click-through URL from the client");
    if (info.size) {
      const live = (d.assets || []).filter((a) => a.active && !a.url);
      if (!live.length) push(`Artwork: ${info.size[0]}×${info.size[1]}${info.maxKb ? `, under ${info.maxKb} KB` : ""}, PNG, JPG or GIF`);
      for (const a of live) {
        const c = checkCreative(d.position, { width: a.width, height: a.height, mimeType: a.webMime || a.mimeType, webBytes: a.webSize });
        if (!c.ok) push(`Replacement for ${a.name}: ${c.problems.join("; ")}`);
      }
    }
    if (d.position === "solus" && !(d.assets || []).length) push("Solus content: subject line, copy and images, or finished HTML");
    if (d.position === "sponsored_article" && !(d.assets || []).length && !d.liveUrl) push("Sponsored article: up to 400 words, logo and one link");
  }
  return items.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
}

export { POSITIONS };

/**
 * Opens and sends for the email placements, from Mailchimp's report on the
 * campaign that carried them. Stored as AdStat rows on the send day, channel
 * email: served is emails delivered, views unique opens, and for a solus the
 * unique clicks too (a newsletter banner's clicks are the site's own count,
 * from the tracked link, since Mailchimp's click total covers the whole issue).
 */
export async function pullEmailStats() {
  const { mc } = await import("./newsletter");
  const rows = await prisma.campaignDeliverable.findMany({
    where: { mailchimpCampaignId: { not: null }, position: { in: ["solus", "newsletter_banner"] } },
    select: { id: true, siteId: true, position: true, mailchimpCampaignId: true },
  });
  let written = 0;
  const failed = [];
  for (const d of rows) {
    try {
      const r = await mc(`/reports/${d.mailchimpCampaignId}?fields=send_time,emails_sent,bounces,opens,clicks`);
      if (!r?.send_time) continue;
      const day = new Date(`${ukDay(r.send_time)}T00:00:00Z`);
      const delivered = (r.emails_sent || 0) - (r.bounces?.hard_bounces || 0) - (r.bounces?.soft_bounces || 0);
      const counts = {
        served: Math.max(0, delivered),
        views: r.opens?.unique_opens || 0,
        clicks: d.position === "solus" ? r.clicks?.unique_clicks || 0 : 0,
      };
      await prisma.adStat.upsert({
        where: { deliverableId_assetKey_position_channel_day: { deliverableId: d.id, assetKey: "", position: d.position, channel: "email", day } },
        update: counts,
        create: { deliverableId: d.id, assetKey: "", siteId: d.siteId || "", position: d.position, channel: "email", day, ...counts },
      });
      written++;
    } catch (e) {
      failed.push(`${d.mailchimpCampaignId}: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  return { email: rows.length, written, failed };
}
