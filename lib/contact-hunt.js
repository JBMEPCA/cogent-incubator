// Finding a brand's press address for real, instead of guessing press@.
//
// The original resolver fetched seven fixed paths and ran one regex, which on
// small-company sites — exactly the sites outreach most wants to reach — found
// nothing, guessed press@<domain>, and parked the row behind the human gate.
// By 1 Sept that pile was 92 rows deep. Three things this does that it didn't:
//
//  1. Follows the site's own navigation. A contact page at /get-in-touch or
//     /about-us/contact is invisible to a fixed path list, but the homepage
//     almost always links to it with "contact" or "press" in the text or href.
//  2. Decodes Cloudflare's email obfuscation (data-cfemail), which is how a
//     large share of WordPress sites "hide" the very address we're after.
//  3. Reads bracket-obfuscated addresses: name [at] domain [dot] com.
//
// Deliberately still a fetch-and-pattern pass with NO model in the loop: these
// pages are untrusted third-party HTML, and the blast radius of a pattern is
// "wrong email", which the verifier and the human gate both stand behind.
//
// Self-contained on purpose — no imports from the rest of lib/ — so
// maintenance scripts can drive it directly under plain node.

const FIXED_PATHS = [
  "", "/contact", "/contact-us", "/about", "/about-us", "/press", "/media",
  "/news", "/press-office", "/media-centre", "/newsroom", "/impressum",
  "/privacy-policy", "/privacy",
];

// Order of preference for the local part. Press first, then the shared
// inboxes small companies actually publish (see docs: founder addresses are
// never published; the published shared inbox, with the person named in the
// email body, is what works).
const PREFERRED = ["press", "media", "pr", "publicrelations", "comms", "communications", "marketing"];
const ACCEPTABLE = /^(hello|enquiries|enquiry|inquiries|info|contact|editorial|office|mail|team)@/;

const JUNK_DOMAINS = [
  "example.com", "sentry.io", "wixpress.com", "godaddy.com", "squarespace.com",
  "company.com", "yourcompany.com", "yourdomain.com", "domain.com", "email.com",
  "example.org", "example.net", "test.com", "acme.com", "mycompany.com",
];

const PLACEHOLDER_LOCALPARTS = new Set([
  "you", "your", "youremail", "your-email", "yourname", "name",
  "firstname", "lastname", "fullname", "email", "emailaddress", "address",
  "someone", "somebody", "user", "username", "example", "sample", "test",
  "johndoe", "janedoe", "john.doe", "jane.doe", "first.last", "abc", "xyz",
]);

// How many pages one hunt may fetch, fixed paths and discovered links
// combined. Each fetch has an 8s ceiling, and the engine calls this inside a
// 60s serverless budget shared with everything else a sweep does.
const MAX_PAGES = 10;
const MAX_DISCOVERED_LINKS = 5;

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html") && !type.includes("text")) return null;
    return (await res.text()).slice(0, 400000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Cloudflare's data-cfemail attribute: hex string, first byte is an XOR key. */
export function decodeCfEmail(hex) {
  const clean = String(hex || "").trim();
  if (!/^[0-9a-f]{4,}$/i.test(clean) || clean.length % 2) return null;
  const bytes = clean.match(/.{2}/g).map((b) => parseInt(b, 16));
  const key = bytes[0];
  const out = bytes.slice(1).map((b) => String.fromCharCode(b ^ key)).join("");
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(out) ? out.toLowerCase() : null;
}

/** "name [at] domain [dot] com" and the (at)/(dot) variants. */
function deobfuscateBrackets(html) {
  const out = [];
  const re = /([a-z0-9._%+-]+)\s*[[(]\s*at\s*[)\]]\s*([a-z0-9.-]+(?:\s*[[(]\s*dot\s*[)\]]\s*[a-z0-9-]+)+)/gi;
  for (const m of html.matchAll(re)) {
    const domain = m[2].replace(/\s*[[(]\s*dot\s*[)\]]\s*/gi, ".");
    out.push(`${m[1]}@${domain}`.toLowerCase());
  }
  return out;
}

function collectAddresses(html) {
  const raw = [];
  for (const m of html.matchAll(/mailto:([^"'\s>?]+)/gi)) raw.push(m[1]);
  for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) raw.push(m[0]);
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) raw.push(decoded);
  }
  raw.push(...deobfuscateBrackets(html));
  return raw;
}

function cleanPool(rawAddresses, domain) {
  const found = new Set();
  for (const rawAddr of rawAddresses) {
    const email = String(rawAddr || "").trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) continue;
    if (JUNK_DOMAINS.some((d) => email.endsWith(`@${d}`) || email.endsWith(`.${d}`))) continue;
    if (PLACEHOLDER_LOCALPARTS.has(email.split("@")[0].replace(/[._-]/g, ""))) continue;
    found.add(email);
  }
  // ON-DOMAIN ONLY, same rule and same reasoning as the original resolver: an
  // address on someone else's domain is not this brand's press contact, and no
  // answer beats the wrong one.
  return [...found].filter((e) => e.endsWith(`@${domain}`) || e.endsWith(`.${domain}`));
}

function pickBest(pool) {
  if (!pool.length) return null;
  for (const prefix of PREFERRED) {
    const hit = pool.find((e) => e.split("@")[0].replace(/[.\-_]/g, "").startsWith(prefix));
    if (hit) return hit;
  }
  return pool.find((e) => ACCEPTABLE.test(e)) || pool[0] || null;
}

/** On-domain links from a page whose text or href says "this way to contact". */
function contactLinks(html, domain, baseUrl) {
  const hits = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const [, href, text] = m;
    if (!/contact|press|media|impressum|imprint|about|team|editorial|get[- ]?in[- ]?touch/i.test(`${href} ${text}`)) continue;
    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== domain) continue;
    if (/\.(pdf|jpg|png|zip)$/i.test(url.pathname)) continue;
    url.hash = "";
    url.search = "";
    hits.set(url.href, true);
    if (hits.size >= MAX_DISCOVERED_LINKS) break;
  }
  return [...hits.keys()];
}

/**
 * The hunt. Returns { email, confidence: "found", page } or null; verification
 * against MillionVerifier stays with the caller, exactly as before.
 */
export async function huntContact(domain) {
  const seen = new Set();
  let fetches = 0;
  let discovered = [];

  const tryPage = async (url) => {
    if (seen.has(url) || fetches >= MAX_PAGES) return null;
    seen.add(url);
    fetches += 1;
    const html = await fetchText(url);
    if (!html) return null;
    if (discovered.length < MAX_DISCOVERED_LINKS) {
      discovered = discovered.concat(contactLinks(html, domain, url));
    }
    const email = pickBest(cleanPool(collectAddresses(html), domain));
    return email ? { email, confidence: "found", page: url } : null;
  };

  for (const path of FIXED_PATHS) {
    const hit = await tryPage(`https://${domain}${path}`);
    if (hit) return hit;
  }
  for (const url of discovered) {
    const hit = await tryPage(url);
    if (hit) return hit;
  }
  return null;
}
