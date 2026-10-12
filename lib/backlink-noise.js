// Referral sources that are not backlinks.
//
// GA4 calls any visit that arrives from another website a "referral", and the
// referrer sweep (lib/referrers.js) recorded every one as a site linking to
// us. Most are not: a LinkedIn or Facebook post, a link pasted into Teams, a
// search engine, a webmail client, a PR tool. On 12 Oct 2026 the October
// backlinks ring read 21 against 3 real links (Tegrona, Enchanted Lands,
// Wikipedia), because 18 of the 21 were these.
//
// Only applied to sources GA4 found. A domain someone typed in by hand is a
// claim they made on purpose and is counted as entered.

const NOT_LINKS = [
  // Social, where a "referral" is someone sharing a post
  "facebook.com", "fb.com", "fb.me", "instagram.com", "linkedin.com", "lnkd.in", "twitter.com", "x.com", "t.co",
  "threads.net", "tiktok.com", "snapchat.com", "pinterest.com", "pinterest.co.uk", "reddit.com", "youtube.com",
  "youtu.be", "whatsapp.com", "wa.me", "telegram.org", "t.me", "discord.com", "nextdoor.com", "bsky.app", "mastodon.social",
  // Search engines and AI assistants
  "google.com", "google.co.uk", "bing.com", "yahoo.com", "duckduckgo.com", "ecosia.org", "baidu.com", "yandex.ru",
  "yandex.com", "startpage.com", "search.brave.com", "qwant.com", "chatgpt.com", "openai.com", "perplexity.ai",
  "copilot.microsoft.com", "gemini.google.com", "claude.ai",
  // Mail, chat and office tools, where a link was pasted, not published
  "mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "office.com",
  "teams.microsoft.com", "static.microsoft", "teams.cdn.office.net", "slack.com", "mail.yahoo.com", "webmail",
  "mail.aol.com", "zoom.us", "ntp.msn.com",
  // Email link scanners, which rewrite a link in someone's inbox
  "edgepilot.com", "safelinks.protection.outlook.com", "urldefense.com", "urldefense.proofpoint.com", "mimecast.com",
  "mimecastprotect.com", "barracudanetworks.com",
  // Newsletter and PR tools
  "cision.com", "list-manage.com", "mailchi.mp", "campaign-archive.com", "hubspotlinks.com", "sendgrid.net",
  "mailerlite.com", "beehiiv.com",
];

const matches = (domain, entry) => domain === entry || domain.endsWith(`.${entry}`) || domain.includes(`.${entry}.`);

/**
 * True when a referral source is not a backlink: one of the above, or one of
 * our own titles (a link between two of our magazines is not one earned).
 */
export function isNotABacklink(domain, ownHosts = []) {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");
  if (!d) return true;
  if (ownHosts.some((h) => h && (d === h || d.endsWith(`.${h}`)))) return true;
  // Country variants of the big search engines (google.de, bing.co.jp and so on).
  if (/(^|\.)(google|bing|yahoo|yandex)\.[a-z.]+$/.test(d)) return true;
  return NOT_LINKS.some((e) => matches(d, e));
}

/** Our titles' bare hosts, for isNotABacklink. */
export async function fleetHosts(db) {
  const sites = await db.site.findMany({ select: { domain: true } });
  return sites.map((s) => String(s.domain || "").toLowerCase().replace(/^www\./, "")).filter(Boolean);
}
