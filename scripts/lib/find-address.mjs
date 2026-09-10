// Find the best address to reach an organisation, from its own website.
//
// Lifted out of find-press-contact.mjs so every harvester uses one
// implementation. Two findings are baked in here and both cost a day to learn:
//
// Guessing paths does not work. Five UK airports were probed with sixteen
// plausible media paths each and every one 404'd while their homepages answered
// fine, because a media centre lives at /about-us/media-centre on one site and
// behind a footer link on the next. So the page is discovered from the
// organisation's own navigation.
//
// And some sites cannot be read at all. Bristol Airport's homepage is 55KB of
// JavaScript with no links and no addresses in it. Nothing server-side will
// ever get an address off a site like that, so the honest answer is null.

import { NO_REPLY } from "../../lib/interviews.js";

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

const WANTED = /media|press|newsroom|journalist|communication|contact|about/i;
const FALLBACK_PATHS = ["contact", "contact-us", "about", "about-us"];

// A press address outranks a general one, because a journalist writing to it is
// the audience it was published for. A named person's address outranks both,
// which is why rankOf checks for one first.
const RANK = [
  /^(press|pressoffice|press-office|media|mediaenquiries|media-enquiries|mediarelations|media-relations|pressteam|newsdesk|communications|comms|pr)@/i,
  /^(marketing|externalaffairs|corporate|corporateaffairs)@/i,
  /^(info|hello|hi|enquiries|enquiry|contact|reception|admin|office|studio|team|mail|shop|store|support|sales)@/i,
];

// Published and useless. mysite.com is Wix's placeholder and a live barbershop
// contact page was shipping it, which reads exactly like a real find.
const JUNK =
  /(\.(png|jpe?g|gif|webp|svg|css|js)$|^[0-9a-f]{16,}@|sentry|wixpress|@(example|mysite|domain|yourdomain|yoursite|email|sentry|godaddy|squarespace|wix|shopify|company|yourcompany|test|localhost|sample)\.|^(example|your|you|someone|name|firstname|user|username|info)@(company|example|domain)|@2x|u002)/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// A named person's address is the best kind, but only first.last is safe to
// detect by shape. A bare lowercase word cannot be told apart from a function:
// an earlier version ranked spares@howardsongroup.com as a person, because
// "spares" looks exactly like a first name.
// Dot separated only, and both halves have to be the length of a real name.
// Hyphens and underscores are how sites write functions, so pallet-track@ and
// press-office@ are not people, and neither is
// central.ukhrreferencing@johnmenzies.aero, which an earlier version ranked
// above everything else on the strength of the dot.
const PERSONAL = /^[a-z]{2,14}\.[a-z]{2,14}@/i;

// Published, real, and nobody who would answer an interview request reads
// them. Ranked below a general inbox rather than discarded, because on a site
// that publishes nothing else they are still a way in.
const FUNCTIONAL_WORDS = new Set([
  "spares", "spareparts", "parts", "careers", "career", "jobs", "recruitment", "recruiting",
  "hr", "referencing", "accounts", "invoices", "invoice", "payables", "accountspayable",
  "accountspayables", "billing", "credit", "returns", "orders", "weborders", "bookings",
  "reservations", "deliveries", "warranty", "servicedesk", "helpdesk", "training", "events",
  "unsubscribe", "privacy", "dpo", "legal", "webmaster", "hostmaster", "abuse", "noc",
  "security", "pensions", "pension", "payroll", "tenders", "tender", "procurement",
  "suppliers", "supplier", "complaints", "feedback", "gdpr", "foi", "safeguarding",
  "whistleblowing", "lostproperty", "refunds", "donations", "volunteers", "membership",
  "subscriptions", "noreply", "spam",
]);

// Tested token by token rather than as a prefix, because these words turn up in
// the middle of a compound local part as often as at the start.
function isFunctional(addr) {
  const local = addr.split("@")[0].toLowerCase();
  const tokens = local.split(/[._+-]+/).filter(Boolean);
  if (tokens.some((t) => FUNCTIONAL_WORDS.has(t))) return true;
  // A long unsplit local part is a compound like "ukhrreferencing": check the
  // whole thing for the words that matter most.
  if (local.length > 12 && /(hr|recruit|referenc|pension|payroll|invoic|procure|tender|complaint)/.test(local)) return true;
  return false;
}
const FUNCTIONAL = { test: isFunctional };

// A personal address only beats a general inbox when it belongs to the person
// we actually want. Sharrocks publishes katrina.watson@ and the story was about
// Steve Hanlon, and preferring any personal address meant writing to a
// colleague by name about someone else's news. A general inbox is better than
// the wrong person's desk.
function rankOf(addr, person = "") {
  const nameTokens = String(person || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2);
  if (PERSONAL.test(addr) || /^[a-z]{2,14}@/i.test(addr)) {
    const local = addr.split("@")[0].toLowerCase();
    const mine = nameTokens.some((t) => local.includes(t));
    if (mine) return -1;
    // Unmatched personal addresses sit below the general inboxes, not above.
    if (PERSONAL.test(addr)) return RANK.length - 0.4;
  }
  for (let i = 0; i < RANK.length; i++) if (RANK[i].test(addr)) return i;
  // An unrecognised local part is more likely a person than a function, but
  // not certainly, so it sits between the general inboxes and the junk.
  return RANK.length - 0.5;
}

async function page(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { html: "", url };
    const type = r.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(type)) return { html: "", url };
    return { html: await r.text(), url: r.url || url };
  } catch {
    return { html: "", url };
  }
}

function emailsIn(html) {
  // mailto links first: an address a human deliberately linked is better
  // evidence than one that happens to appear in body text.
  const mailtos = [...html.matchAll(/href="mailto:([^"?]+)/gi)].map((m) => m[1]);
  const plain = html.match(EMAIL) || [];
  return [...mailtos, ...plain]
    .map((a) => decodeURIComponent(a.trim()).toLowerCase().replace(/^mailto:/, ""))
    // FUNCTIONAL boxes are dropped outright rather than ranked last. Menzies
    // Aviation publishes only pensions@ on its own domain, and ranking meant
    // that got picked as the way to reach the chief executive, which it is not.
    // A row with no address is honest; a row with pensions@ is a wasted send.
    .filter((a) => a.length < 80 && !NO_REPLY.test(a) && !JUNK.test(a) && !FUNCTIONAL.test(a));
}

function candidateLinks(html, base) {
  const out = new Map();
  let host;
  try {
    host = new URL(base).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!WANTED.test(href) && !WANTED.test(text)) continue;
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== host) continue;
    // A link whose text says media beats one that only has it in the path.
    const score = (/media|press|newsroom|journalist/i.test(text) ? 0 : 1) + (/contact/i.test(text) ? 0 : 1);
    if (!out.has(url.href) || out.get(url.href) > score) out.set(url.href, score);
  }
  return [...out.entries()].sort((a, b) => a[1] - b[1]).map(([u]) => u);
}

/**
 * Best address for a domain, or null.
 *
 * Returns { email, source } where source is the path it was found on, so a bad
 * row can be traced back to the page that produced it.
 */
export async function findAddress(domain, { maxPages = 6, person = "" } = {}) {
  const bare = String(domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!bare || !bare.includes(".")) return null;

  const seen = new Map();
  const label = (u) => u.replace(/^https?:\/\/[^/]+/, "") || "/";
  const record = (html, u) => {
    for (const addr of emailsIn(html)) if (!seen.has(addr)) seen.set(addr, label(u));
  };

  const home = await page(`https://${bare}/`);
  record(home.html, home.url);

  if (home.html) {
    const links = [
      ...candidateLinks(home.html, home.url || `https://${bare}/`),
      ...FALLBACK_PATHS.map((p) => `https://${bare}/${p}`),
    ];
    for (const url of links.slice(0, maxPages)) {
      if ([...seen.keys()].some((a) => rankOf(a, person) <= 0)) break;
      const got = await page(url);
      if (got.html) record(got.html, url);
    }
  }

  if (!seen.size) return null;
  // Own domain first, and only then by rank. brianyeardley.com publishes a
  // haulage partner's named contact alongside its own info@, and ranking on
  // shape alone preferred the stranger.
  const own = (a) => a.endsWith(`@${bare}`) || a.endsWith(`.${bare}`);
  const best = [...seen.keys()].sort(
    (a, b) => Number(own(b)) - Number(own(a)) || rankOf(a, person) - rankOf(b, person) || a.length - b.length
  )[0];
  return { email: best, source: seen.get(best), all: [...seen.keys()] };
}
