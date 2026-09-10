// Find the press office address for organisations that publish no inbox.
//
// Written after 191 domains were hunted for three addresses. The contact
// hunter reads a company's contact page, and large organisations put a form
// there and nothing else, which is why Golf and Airports idle while Smart SME
// and Barbering convert: a golf club or an airport has a web form, and a
// barbershop has info@.
//
// But those same organisations do publish an address for journalists, because
// they want the coverage. It sits on a media or press page that the contact
// hunter never looks at. Seven of the seven airport approaches that worked
// went to a press office, so this is not a workaround, it is the correct route
// for an interview request to a big organisation.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/find-press-contact.mjs \
//     domain1.com domain2.co.uk ...
//   node --import ./scripts/node-resolve-hook.mjs scripts/find-press-contact.mjs --file=list.txt
//
// Prints the best address per domain and where it was found. Proposes, does
// not decide: a human still picks who to write to.

import { readFileSync } from "node:fs";
import { NO_REPLY } from "../lib/interviews.js";

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

// Guessing paths does not work. Five UK airports were probed with sixteen
// plausible paths each and every one 404'd, while their homepages answered
// fine: a media centre lives at /about-us/media-centre on one site, at
// /corporate/newsroom on the next, and behind a "Media" link in a footer menu
// on the third. So the page is discovered from the organisation's own
// navigation instead, which is the one place it is always linked.
const WANTED = /media|press|newsroom|journalist|communication|contact/i;

// A couple of blind guesses are still worth trying alongside the discovered
// links, for the sites whose footer is built in JavaScript.
const FALLBACK_PATHS = ["contact", "contact-us", "media", "press"];

// A press address outranks a general one, because a journalist writing to it
// is the audience it was published for.
const RANK = [
  /^(press|pressoffice|press-office|media|mediaenquiries|media-enquiries|mediarelations|media-relations|pressteam|newsdesk|communications|comms|pr)@/i,
  /^(marketing|externalaffairs|corporate|corporateaffairs)@/i,
  /^(info|hello|enquiries|enquiry|contact|reception|admin|office)@/i,
];

// Addresses that are published and useless, beyond the no-reply set: an image
// file that regexes like an address, and the tooling most sites leak.
const JUNK =
  /(\.(png|jpe?g|gif|webp|svg|css|js)$|^[0-9a-f]{16,}@|sentry|wixpress|example\.com|domain\.com|yourdomain|@sentry|godaddy|squarespace|@2x)/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function rankOf(addr) {
  for (let i = 0; i < RANK.length; i++) if (RANK[i].test(addr)) return i;
  return RANK.length;
}

async function page(url) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { html: "", url };
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
    .map((a) => a.trim().toLowerCase().replace(/^mailto:/, ""))
    .filter((a) => !NO_REPLY.test(a) && !JUNK.test(a));
}

// Links on the page that look like a media or contact page, most promising
// first. Judged on the link text as well as the href, because plenty of sites
// route a "Media centre" link through an opaque CMS id.
function candidateLinks(html, base) {
  const out = new Map();
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
    if (url.hostname.replace(/^www\./, "") !== new URL(base).hostname.replace(/^www\./, "")) continue;
    // A link whose text says media beats one that only has it in the path.
    const score = (/media|press|newsroom|journalist/i.test(text) ? 0 : 1) + (/contact/i.test(text) ? 1 : 0);
    if (!out.has(url.href) || out.get(url.href) > score) out.set(url.href, score);
  }
  return [...out.entries()].sort((a, b) => a[1] - b[1]).map(([u]) => u);
}

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const domains = fileArg
  ? readFileSync(fileArg.split("=")[1], "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : args.filter((a) => !a.startsWith("--"));

if (!domains.length) {
  console.log("Usage: find-press-contact.mjs <domain> [domain...] | --file=list.txt");
  process.exit(1);
}

let found = 0;
for (const domain of domains) {
  const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const seen = new Map(); // address -> the page it was found on

  const home = await page(`https://${bare}/`);
  const label = (u) => u.replace(/^https?:\/\/[^/]+/, "") || "/";
  const record = (html, u) => {
    for (const addr of emailsIn(html)) if (!seen.has(addr)) seen.set(addr, label(u));
  };
  record(home.html, home.url);

  const links = [
    ...candidateLinks(home.html, home.url || `https://${bare}/`),
    ...FALLBACK_PATHS.map((p) => `https://${bare}/${p}`),
  ];
  for (const url of links.slice(0, 8)) {
    // Stop as soon as a genuine press address turns up. The list is ordered
    // by how likely each link is to be the real media page.
    if ([...seen.keys()].some((a) => rankOf(a) === 0)) break;
    const got = await page(url);
    if (got.html) record(got.html, url);
  }

  const own = (a) => a.endsWith(`@${bare}`) || a.endsWith(`.${bare}`);
  const best = [...seen.keys()].sort(
    (a, b) => rankOf(a) - rankOf(b) || Number(own(b)) - Number(own(a)) || a.length - b.length
  )[0];

  if (best) found++;
  console.log(`${bare.padEnd(34)} ${best || "none published"}${best ? `   [${seen.get(best)}]` : ""}`);
  const others = [...seen.keys()].filter((a) => a !== best).slice(0, 3);
  if (others.length) console.log(`${" ".repeat(34)} also: ${others.join("  ")}`);
}

console.log(`\n${domains.length} domains, ${found} with an address.`);
