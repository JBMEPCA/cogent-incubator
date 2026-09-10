// Harvest the f:Entrepreneur female founders lists into roster rows.
//
// This is the best single source the SME franchise has found, and the reason is
// worth stating because it is the test every other source should be held to:
// one page gives the person, their business, a paragraph of biography and a
// link to their own website. Everything else needs three sources stitched
// together. Award shortlists name a company and leave you hunting the human;
// company directories name a company and no human at all.
//
// There are around a hundred founders a year and the campaign has run since
// 2019, so the supply is roughly eight hundred people rather than a hundred.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/harvest-fentrepreneur.mjs \
//     [--years=2019-2026] [--limit=100] [--out=scripts/roster/smart-sme.csv] [--quiet]
//
// The listing pages are client rendered, so the index is built from the profile
// URLs in the markup rather than scraped off the listing. Profile pages
// themselves are plain server-rendered HTML.

import { huntContact } from "../lib/contact-hunt.js";
import { NO_REPLY } from "../lib/interviews.js";
import { findAddress } from "./lib/find-address.mjs";
import { mergeRoster, readRoster, summarise } from "./lib/roster.mjs";

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };
const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const QUIET = process.argv.includes("--quiet");
const LIMIT = Number(arg("limit", "200"));
const OUT = arg("out", "scripts/roster/smart-sme.csv");
const YEARS = (() => {
  const spec = arg("years", arg("year", "2026"));
  const m = spec.match(/^(\d{4})-(\d{4})$/);
  if (!m) return spec.split(",").map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let y = Number(m[2]); y >= Number(m[1]); y--) out.push(String(y));
  return out;
})();

async function html(url) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&#8217;/g, "’")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#8211;/g, "-")
    .replace(/\s+/g, " ").trim();

// The theme ships a navigation "Menu" heading ahead of the content, so an
// index-based read of the headings picks that up instead of the person.
const CHROME = /^(menu|search|navigation|skip to main content|female founders list|f:entrepreneur)/i;

const rows = [];
const seenSlug = new Set();

for (const year of YEARS) {
  const listing = await html(`https://f-entrepreneur.com/female-founders-list-${year}/`);
  const slugs = [...new Set([...listing.matchAll(/\/female-founders\/([a-z0-9-]+)\/?/gi)].map((m) => m[1]))]
    .filter((s) => !seenSlug.has(s));
  if (!slugs.length) {
    if (!QUIET) console.log(`${year}: no profiles found`);
    continue;
  }

  let got = 0;
  for (const slug of slugs.slice(0, LIMIT)) {
    seenSlug.add(slug);
    const page = await html(`https://f-entrepreneur.com/female-founders/${slug}/`);
    if (!page) continue;

    const name = decode((page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").split("|")[0]);
    if (!name) continue;

    const heads = [...page.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)]
      .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")))
      .filter((h) => h && !CHROME.test(h) && h.toLowerCase() !== name.toLowerCase());

    // Their own site: the only outbound link that is not the campaign, a social
    // network or the newsletter provider.
    const links = [...page.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
    const own = links.find(
      (h) => !/f-entrepreneur|smallbusinessbritain|facebook|twitter|linkedin|instagram|tiktok|youtube|x\.com|constantcontact|google|wordpress|paypal|stripe/i.test(h)
    );
    const domain = own ? own.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : "";

    // findAddress reads more of the site than huntContact does, so it goes
    // first; huntContact still catches the schema.org block that findAddress
    // does not parse.
    let email = "";
    if (domain) {
      try {
        email = (await findAddress(domain))?.email || "";
      } catch {}
      if (!email) {
        try {
          const found = (await huntContact(domain))?.email || "";
          email = found && !NO_REPLY.test(found) ? found : "";
        } catch {}
      }
    }

    // The company name is often only in the bio, not in a heading, so fall back
    // to the domain rather than leaving the column empty.
    const company = heads[0] || domain.replace(/\.(co\.uk|com|org|uk|net|co)$/i, "");

    rows.push({
      name,
      role: `Founder, ${company}`,
      company,
      domain,
      email,
      source: `f-entrepreneur ${year}`,
      hookUrl: `https://f-entrepreneur.com/female-founders-list-${year}/`,
    });
    got++;
    if (!QUIET && email) console.log(`${year}  ${name.padEnd(26)} ${domain.padEnd(32)} ${email}`);
  }
  if (!QUIET) console.log(`${year}: ${got} profiles read\n`);
}

const { total, added } = mergeRoster(OUT, rows);
const s = summarise(readRoster(OUT));
console.log(
  `\n${rows.length} harvested from ${YEARS.length} year(s). ${OUT} now holds ${total} rows (${added} new): ` +
    `${s.withEmail} with an address, ${s.ready} with both a name and an address.`
);
