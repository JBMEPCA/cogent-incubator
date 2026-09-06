// Harvest the f:Entrepreneur female founders list into interview candidates.
//
// This list is the best single source the SME franchise has found. Award
// shortlists name a company and leave you hunting the human one search at a
// time; this names the person, their business, a paragraph of biography, and
// links their own website, which is where the contact hunter then reads the
// address. Batch three took fourteen candidates off it by hand. There are a
// hundred a year on it, and eight previous years behind that.
//
// The list page itself is rendered client side, so the index is built from the
// profile URLs rather than scraped off the listing. Every profile page is
// plain server-rendered HTML.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/harvest-fentrepreneur.mjs \
//     [--year=2026] [--limit=100] [--skip-known]
//
// Prints one row per founder: name, business, domain, and the published
// address if the hunter finds one. It proposes, it does not decide. A human
// still picks who is worth writing to and writes their questions, which is
// where the judgement lives.
//
// --skip-known drops anyone already held as an interview target on any title,
// so a second pass over the same list returns only what is new.

import { huntContact } from "../lib/contact-hunt.js";
import { NO_REPLY } from "../lib/interviews.js";

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };
const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const YEAR = arg("year", "2026");
const LIMIT = Number(arg("limit", "100"));
const SKIP_KNOWN = process.argv.includes("--skip-known");

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

// The listing is client rendered, but every profile lives under the same path,
// so the sitemap-ish index is simply every profile link the page ships in its
// markup or its JSON payload. Both carry the same URLs.
const listing = await html(`https://f-entrepreneur.com/female-founders-list-${YEAR}/`);
const slugs = [...new Set([...listing.matchAll(/\/female-founders\/([a-z0-9-]+)\/?/gi)].map((m) => m[1]))];

if (!slugs.length) {
  console.log(`No profiles found for ${YEAR}. The listing markup may have changed.`);
  process.exit(1);
}

let known = new Set();
if (SKIP_KNOWN) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const rows = await prisma.interviewTarget.findMany({ select: { personName: true } });
  known = new Set(rows.map((r) => r.personName.toLowerCase()));
  await prisma.$disconnect();
}

console.log(`${slugs.length} profiles on the ${YEAR} list${SKIP_KNOWN ? `, ${known.size} people already held` : ""}\n`);

let reachable = 0, shown = 0;
for (const slug of slugs.slice(0, LIMIT)) {
  const page = await html(`https://f-entrepreneur.com/female-founders/${slug}/`);
  if (!page) continue;

  // The name comes off the title tag, not the first heading: the theme ships a
  // navigation "Menu" heading ahead of the content, which is what an
  // index-based read picks up.
  const name = decode((page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").split("|")[0]) || slug.replace(/-/g, " ");
  if (SKIP_KNOWN && known.has(name.toLowerCase())) continue;

  // The business is the first heading that is neither chrome nor the person.
  const CHROME = /^(menu|search|navigation|skip to main content|female founders list|f:entrepreneur)/i;
  const heads = [...page.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")))
    .filter((h) => h && !CHROME.test(h) && h.toLowerCase() !== name.toLowerCase());
  const business = heads[0] || "";

  // Their own site, which is the only outbound link that is not the campaign,
  // a social network or the newsletter provider.
  const links = [...page.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
  const own = links.find(
    (h) => !/f-entrepreneur|smallbusinessbritain|facebook|twitter|linkedin|instagram|tiktok|youtube|x\.com|constantcontact|google|wordpress/i.test(h)
  );
  const domain = own ? own.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : "";

  let email = "";
  if (domain) {
    try {
      const got = (await huntContact(domain))?.email || "";
      email = got && !NO_REPLY.test(got) ? got : "";
    } catch {}
  }
  if (email) reachable++;
  shown++;

  // The longest paragraph is the biography. The first one is usually a cookie
  // line or the campaign strapline.
  const bio = [...page.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")))
    .sort((a, b) => b.length - a.length)[0]?.slice(0, 260) || "";
  console.log(`${name.padEnd(26)} ${business.slice(0, 26).padEnd(27)} ${(domain || "-").padEnd(30)} ${email || "-"}`);
  if (bio) console.log(`   ${bio}`);
}

console.log(`\n${shown} founders, ${reachable} with a published address.`);
