// Fill in the gaps in a roster that already has the people.
//
// Harvesting and address-finding improve at different rates, and the harvest is
// the expensive half: reading two hundred articles and having Haiku pull the
// names out costs real time and money, while trying a domain again costs a few
// HTTP requests. So the two are separated. When the address finder learns
// something new, this re-runs only the rows that were missing an address rather
// than harvesting the sector again.
//
// Decoding Cloudflare's email obfuscation is the example that made this worth
// writing: it recovered sales@nationwidevehiclecontracts.co.uk from a page that
// had previously looked as though it published nothing, and there were already
// dozens of rows in the same state.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/roster-enrich.mjs \
//     scripts/roster/fleet.csv [--proof=fleet,vehicle,logistics] [--limit=200]
//
// Rewrites the file in place, and only ever adds: a row that already has an
// address is left alone.

import { findAddress } from "./lib/find-address.mjs";
import { guessDomain } from "./lib/guess-domain.mjs";
import { readRoster, writeRoster, summarise } from "./lib/roster.mjs";

const args = process.argv.slice(2);
const FILE = args.find((a) => !a.startsWith("--"));
const arg = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const PROOF = arg("proof", "").split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(arg("limit", "400"));
// Re-derive rows whose domain was guessed rather than published. Needed when
// the guesser is corrected: an earlier version turned "Škoda UK" into
// kodauk.com and "U-Drive" into drive.co.uk, both different companies, and
// those rows are already written with an address attached.
const RECHECK = args.includes("--recheck");

if (!FILE) {
  console.error("usage: roster-enrich.mjs <roster.csv> [--proof=word,word] [--limit=400]");
  process.exit(1);
}

const rows = readRoster(FILE);
if (!rows.length) {
  console.error(`${FILE} is empty.`);
  process.exit(1);
}

const before = summarise(rows);
console.log(`${FILE}: ${rows.length} rows, ${before.withEmail} already have an address.\n`);

let tried = 0, foundDomain = 0, foundEmail = 0;
let rechecked = 0;
for (const row of rows) {
  const wasGuessed = /domain guessed/.test(row.source || "");
  if (RECHECK && wasGuessed) {
    // Throw away what the old guesser produced and derive it again, so a
    // corrected guess replaces a wrong company rather than sitting beside it.
    row.domain = "";
    row.email = "";
    row.source = (row.source || "").replace(/,\s*(domain guessed|address on another domain)/g, "");
    rechecked++;
  }
  if (row.email) continue;
  if (tried >= LIMIT) break;
  tried++;

  if (!row.domain && row.company && PROOF.length) {
    try {
      const d = await guessDomain(row.company, { extraProof: PROOF });
      if (d) {
        row.domain = d;
        row.source = row.source.includes("domain guessed") ? row.source : `${row.source}, domain guessed`;
        foundDomain++;
      }
    } catch {}
  }
  if (!row.domain) continue;

  try {
    // The person's name is passed so that a colleague's address does not get
    // preferred over the company's own inbox.
    const got = await findAddress(row.domain, { person: row.name });
    if (got?.email) {
      row.email = got.email;
      // Flagged rather than dropped, because off-domain cuts both ways:
      // hpi@hpi.co.uk on bvrla.co.uk is a different company, while
      // sales@howardsongroup.com on dennisuk.com is the right parent group.
      // Only a person can tell those apart, so the row says which it is.
      if (got.offDomain) row.source = `${row.source}, address on another domain`;
      foundEmail++;
      console.log(
        `${row.name.slice(0, 24).padEnd(25)} ${row.domain.padEnd(32)} ${got.email}${got.offDomain ? "  (other domain)" : ""}`
      );
    }
  } catch {}
}

writeRoster(FILE, rows);
const after = summarise(rows);
console.log(
  `\n${RECHECK ? `re-derived ${rechecked} previously guessed rows. ` : ""}` +
    `tried ${tried} rows without an address: found ${foundDomain} new domains and ${foundEmail} new addresses.\n` +
    `${FILE}: ${after.withEmail} of ${rows.length} now have an address, ${after.ready} have both a name and an address.`
);
