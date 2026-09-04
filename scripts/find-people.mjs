// Given company domains, find the people and the address to reach them.
//
// Written because sourcing was the bottleneck and searching was the wrong tool
// for it. Award shortlists name a company and leave you hunting the human one
// web search at a time, which is roughly one usable name per search once the
// good lists are exhausted.
//
// Inverting it removes the bottleneck entirely. A company's own site already
// holds both halves: a team page names its people with their roles, and a
// contact page publishes the inbox. Neither needs a search engine, both are on
// the same domain, and one pass over twenty domains does what twenty searches
// could not.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/find-people.mjs \
//     domain1.com domain2.co.uk ...
//   node --import ./scripts/node-resolve-hook.mjs scripts/find-people.mjs --file=list.txt
//
// Prints one line per domain: the published address, then every plausible
// person found with their role. It proposes, it does not decide: a human still
// picks who is worth writing to, which is where the judgement lives.

import { readFileSync } from "node:fs";
import { huntContact } from "../lib/contact-hunt.js";
import { NO_REPLY } from "../lib/interviews.js";

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

// Where companies actually put their people. Ordered by how often it works.
const TEAM_PATHS = [
  "about-us", "about", "our-team", "team", "meet-the-team", "the-team",
  "people", "our-people", "leadership", "management", "who-we-are", "contact",
];

// A role line is what turns a capitalised pair of words into a person. Without
// this every place name and product name in the page comes back as a human.
const ROLE = /\b(chief executive|ceo|managing director|founder|co-?founder|owner|proprietor|director|head of|manager|partner|principal|president|chair(?:man|woman)?|general manager|superintendent|agronomist|architect|technical|sales|commercial|operations|marketing)\b/i;

// Words that look like names but are not people.
const NOT_A_PERSON = /\b(golf club|golf course|limited|ltd|group|company|solutions|services|systems|united kingdom|great britain|privacy policy|cookie policy|terms|contact us|read more|find out|our story|case study|get in touch)\b/i;

const NAME = /\b([A-Z][a-z]{1,14})\s+([A-Z][a-zA-Z'’-]{1,18})\b/;

function peopleFrom(text) {
  const found = new Map();
  // Sentence-ish chunks, so a name and its role stay together.
  for (const chunk of text.split(/(?<=[.!?])\s+|\n+|\s{3,}|\|/)) {
    const c = chunk.replace(/\s+/g, " ").trim();
    if (c.length < 6 || c.length > 160) continue;
    if (NOT_A_PERSON.test(c)) continue;
    if (!ROLE.test(c)) continue;
    const m = c.match(NAME);
    if (!m) continue;
    const name = `${m[1]} ${m[2]}`;
    // The role is whatever the chunk says around the name, trimmed.
    const role = c.replace(name, "").replace(/^[\s,.\-–:|]+|[\s,.\-–:|]+$/g, "").slice(0, 70);
    if (!found.has(name)) found.set(name, role);
  }
  return [...found.entries()];
}

async function pageText(url) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return "";
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  } catch {
    return "";
  }
}

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const domains = fileArg
  ? readFileSync(fileArg.split("=")[1], "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : args.filter((a) => !a.startsWith("--"));

if (!domains.length) {
  console.log("Usage: find-people.mjs <domain> [domain...] | --file=list.txt");
  process.exit(1);
}

let reachable = 0, named = 0;
for (const domain of domains) {
  let email = null;
  try {
    const got = (await huntContact(domain))?.email || null;
    // A no-reply box is published and useless; say so rather than offering it.
    email = got && NO_REPLY.test(got) ? null : got;
  } catch {}
  if (email) reachable++;

  let text = "";
  for (const p of TEAM_PATHS) {
    text += " " + (await pageText(`https://${domain}/${p}`));
    if (peopleFrom(text).length >= 3) break;
  }
  const people = peopleFrom(text).slice(0, 6);
  if (people.length) named++;

  console.log(`\n${domain}`);
  console.log(`  address : ${email || "none published"}`);
  if (!people.length) console.log(`  people  : none found`);
  for (const [n, r] of people) console.log(`  people  : ${n.padEnd(24)} ${r}`);
}

console.log(`\n${domains.length} domains: ${reachable} with an address, ${named} with at least one name.`);
