import Anthropic from "@anthropic-ai/sdk";
import { prisma, forSite } from "./prisma";
import { mc } from "./newsletter";
import { getGoogleAccessToken, isGoogleConfigured, googleServiceAccountEmail } from "./google";
import { listSites, siteCredentials } from "./site";
import { bridgeFor, bridgeWebhook } from "./social-bridge";

// App settings → Connections: is each outside service the app leans on
// actually answering?
//
// Every check is one cheap, read-only call that changes nothing on the other
// side: list one model, ping Mailchimp, mint a Google token, search one Pexels
// photo, list Bing sites. Make is the exception. Both its addresses run a real
// scenario when called, so it is checked for being set and well-formed, never
// called. Results are stored with the time they were taken, so the page shows
// the last check instantly and a person decides when to spend a fresh one.

const RESULT_KEY = "connections_check";
const TIMEOUT_MS = 10_000;

const missing = (what) => ({ ok: false, error: `${what} is not set in Vercel.` });

async function withTimeout(fn) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("No answer within 10 seconds.")), TIMEOUT_MS)),
  ]);
}

const SHARED = [
  {
    key: "anthropic",
    label: "Anthropic (Claude)",
    what: "Writes, edits and runs every agent.",
    async check() {
      if (!process.env.ANTHROPIC_API_KEY) return missing("ANTHROPIC_API_KEY");
      // Lists one model: authenticates the key, uses no tokens.
      const page = await new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 }).models.list({ limit: 1 });
      return { ok: true, detail: page.data?.[0]?.display_name ? `Key works (${page.data[0].display_name} available)` : "Key works" };
    },
  },
  {
    key: "mailchimp",
    label: "Mailchimp",
    what: "Sends the eNewsletters and holds every list.",
    async check() {
      if (!process.env.MAILCHIMP_API_KEY) return missing("MAILCHIMP_API_KEY");
      const r = await mc("/ping");
      return { ok: true, detail: r?.health_status || "Answering" };
    },
  },
  {
    key: "google",
    label: "Google service account",
    what: "Reads GA4 and Search Console, and the title mailboxes.",
    async check() {
      if (!isGoogleConfigured()) return missing("GOOGLE_SERVICE_ACCOUNT_JSON");
      await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
      return { ok: true, detail: `Signs in as ${googleServiceAccountEmail()}` };
    },
  },
  {
    key: "pexels",
    label: "Pexels",
    what: "Stock photography for articles without a supplied picture.",
    async check() {
      if (!process.env.PEXELS_API_KEY) return missing("PEXELS_API_KEY");
      const res = await fetch("https://api.pexels.com/v1/search?query=office&per_page=1", {
        headers: { authorization: process.env.PEXELS_API_KEY },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: `Pexels returned ${res.status}.` };
      const left = res.headers.get("x-ratelimit-remaining");
      return { ok: true, detail: left ? `Key works, ${Number(left).toLocaleString()} requests left this month` : "Key works" };
    },
  },
  {
    key: "bing",
    label: "Bing Webmaster",
    what: "Keyword volumes for the SEO checks.",
    async check() {
      if (!process.env.BING_WEBMASTER_API_KEY) return missing("BING_WEBMASTER_API_KEY");
      const qs = new URLSearchParams({ apikey: process.env.BING_WEBMASTER_API_KEY });
      const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetUserSites?${qs}`, { cache: "no-store" });
      if (!res.ok) return { ok: false, error: `Bing returned ${res.status}. The key may have been revoked.` };
      const sites = (await res.json())?.d ?? [];
      return { ok: true, detail: `Key works, ${sites.length} site${sites.length === 1 ? "" : "s"} verified` };
    },
  },
  {
    key: "make",
    label: "Make (social posting)",
    what: "Posts to LinkedIn and Instagram. Checked for being set, not called, because calling it posts.",
    async check() {
      const rows = await prisma.globalSetting.findMany({ where: { key: { in: ["make_webhook_url", "make_lookup_url"] } } });
      const get = (k) => rows.find((r) => r.key === k)?.value?.trim() || "";
      const hook = (u) => /^https:\/\/hook\.[a-z0-9.-]*make\.com\//i.test(u);
      const post = get("make_webhook_url");
      const lookup = get("make_lookup_url");
      if (!post) return { ok: false, error: "No posting webhook saved, so nothing is posted to social." };
      if (!hook(post)) return { ok: false, error: "The posting webhook is not a Make hook address." };
      return {
        ok: true,
        detail: lookup && hook(lookup) ? "Posting and company lookup addresses set" : "Posting address set; company lookup not set",
      };
    },
  },
];

export const SHARED_SERVICES = SHARED.map(({ key, label, what }) => ({ key, label, what }));

/** Run every shared check in parallel and store the result. Never throws. */
export async function runSharedChecks() {
  const results = {};
  await Promise.all(
    SHARED.map(async (s) => {
      try {
        results[s.key] = await withTimeout(() => s.check());
      } catch (e) {
        results[s.key] = { ok: false, error: e?.message || String(e) };
      }
    })
  );
  const stored = { at: new Date().toISOString(), results };
  await prisma.globalSetting.upsert({
    where: { key: RESULT_KEY },
    create: { key: RESULT_KEY, value: JSON.stringify(stored) },
    update: { value: JSON.stringify(stored) },
  });
  return stored;
}

/** The last stored shared check, or null if one has never run. */
export async function lastSharedChecks() {
  const row = await prisma.globalSetting.findUnique({ where: { key: RESULT_KEY } });
  try {
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

// A publish inside this window counts as the website connection working.
const PUBLISH_FRESH_MS = 3 * 864e5;

function ago(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// Per-title credentials, as their own settings pages last probed them.
export const TITLE_KINDS = [
  { kind: "wordpress", label: "Website" },
  { kind: "google_analytics", label: "Analytics" },
  { kind: "mailchimp", label: "Mailchimp list" },
  { kind: "outreach", label: "Mailbox" },
];

/**
 * One row per title: each credential's stored health, plus social posting.
 * Reads only; the "Recheck" action is what refreshes them.
 *
 * Social is the per-title Make switch (social_bridge), not the old direct
 * LinkedIn sign-in: posting has gone through Make since 22 Sep 2026 and the
 * direct connection is unused while the LinkedIn app is in review.
 */
export async function titleHealth() {
  const [sites, hook] = await Promise.all([listSites(), bridgeWebhook().catch(() => null)]);
  return Promise.all(
    sites.map(async (site) => {
      const { creds, health } = await siteCredentials(site.id).catch(() => ({ creds: {}, health: {} }));
      const cells = {};
      for (const { kind } of TITLE_KINDS) {
        cells[kind] = !creds[kind]
          ? { state: "none" }
          : { state: health[kind]?.healthy === true ? "ok" : health[kind]?.healthy === false ? "bad" : "unknown",
              error: health[kind]?.lastError || null,
              checkedAt: health[kind]?.checkedAt || null };
      }
      // The website's best evidence is a post that actually went up. A live
      // probe of /users/me is answered by SiteGround's bot check whenever
      // requests arrive in a burst, from Vercel as well as from the office, so
      // a recent publish outranks it; the probe result only speaks when the
      // title has gone quiet, which is exactly when a stale password shows.
      const lastPost = await forSite(site.id)
        .article.findFirst({
          where: { status: "published", wpPostId: { not: null }, publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          select: { publishedAt: true },
        })
        .catch(() => null);
      if (creds.wordpress && lastPost && Date.now() - lastPost.publishedAt.getTime() < PUBLISH_FRESH_MS) {
        cells.wordpress = { state: "ok", label: `Published ${ago(lastPost.publishedAt)}` };
      }

      const bridge = await bridgeFor(site).catch(() => null);
      const networks = [bridge?.linkedin && "LinkedIn", bridge?.instagram && "Instagram"].filter(Boolean);
      cells.social = !networks.length
        ? { state: "none" }
        : !hook
          ? { state: "bad", error: "Switched on, but no Make webhook is saved, so nothing posts" }
          : { state: "ok", label: networks.join(" + ") };
      return { slug: site.slug, name: site.name, accentHex: site.accentHex, cells };
    })
  );
}
