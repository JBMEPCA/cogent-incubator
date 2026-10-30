/**
 * Asserts the company-tagging guesser without touching LinkedIn.
 *
 * The case that matters is barberingbusiness.com: the domain label alone never
 * produces "barbering-business", so before anchor text was used our own title
 * could not have been tagged by this code.
 *
 * Run: node --env-file=.env scripts/test-linkedin-mentions.mjs
 */
import { vanityCandidates, nameCandidates, sameName, renderCommentary, escapeCommentary } from "../lib/linkedin-mentions.js";

let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};
const has = (name, list, wanted) => check(name, list.includes(wanted), true);
const hasnt = (name, list, unwanted) => check(name, list.includes(unwanted), false);

// The two live examples, both verified against LinkedIn on 25 Sep 2026.
has("barberingbusiness.com finds barbering-business", vanityCandidates("barberingbusiness.com", ["Barbering Business"]), "barbering-business");
has("uppercutdeluxe.com finds uppercut-deluxe", vanityCandidates("uppercutdeluxe.com", ["Uppercut Deluxe"]), "uppercut-deluxe");

// The domain label stays the first guess: it is right most of the time and costs one call.
check("domain label first", vanityCandidates("webfleet.com", ["Webfleet Solutions"])[0], "webfleet");

// A sentence fragment is not a brand and must not become a candidate.
hasnt("prose anchor rejected", vanityCandidates("example.com", ["styling powder and pomade range"]), "styling-powder-and-pomade-range");
hasnt("trailing punctuation rejected", vanityCandidates("example.com", ["Uppercut Deluxe,"]), "uppercut-deluxe");

// Ampersands are spelled out, the way company pages tend to register them.
has("ampersand becomes and", vanityCandidates("cityandguilds.com", ["City & Guilds"]), "city-and-guilds");

// Hyphenated domains still work both ways round.
has("hyphenated domain keeps its own form", vanityCandidates("golf-resort-magazine.com", []), "golf-resort-magazine");
has("hyphenated domain also tries stripped", vanityCandidates("golf-resort-magazine.com", []), "golfresortmagazine");

// Never more candidates than calls we are willing to make.
check("capped at 5", vanityCandidates("a-b-c.com", ["One Two", "Three Four", "Five Six", "Seven Eight"]).length <= 5, true);

// Rendering: the mention is markup, everything around it is escaped.
check(
  "mention rendered, rest escaped",
  renderCommentary("Uppercut Deluxe's Shindig (2026) ran Paris.", [{ urn: "urn:li:organization:6640573", name: "Uppercut Deluxe" }]),
  "@[Uppercut Deluxe](urn:li:organization:6640573)'s Shindig \\(2026\\) ran Paris."
);
check("no mention, plain escape", renderCommentary("Costs (net) rose.", []), escapeCommentary("Costs (net) rose."));
check("hashtags survive", renderCommentary("Done. #barbering", []), "Done. #barbering");

// Names as posts write them against names as LinkedIn holds them: the pairs
// the 30 Oct 2026 audit found dropped, and two that must stay apart.
check("The prefix ignored", sameName("The Dalaman Golf Club", "Dalaman Golf Club"), true);
check("acronym in brackets", sameName("Society of Motor Manufacturers and Traders (SMMT)", "SMMT"), true);
check("gloss after a dash", sameName("ACI World - Airports Council International", "ACI World"), true);
check("legal suffix ignored", sameName("GXO Logistics, Inc.", "GXO Logistics"), true);
check("run together", sameName("CloseBrothers", "Close Brothers"), true);
check("'by' owner", sameName("ArrowXL by JP Home", "ArrowXL"), true);
check("different company", sameName("Hilton Istanbul Airport", "Hilton"), false);
check("shorter is not same", sameName("Dental Elite Valuers, Brokers & Recruiters", "Dental"), false);
check("trade words after the name", sameName("Clyde Munro Dental Group", "Clyde Munro"), true);
check("acronym needs a proven website", sameName("National Sheep Association", "NSA"), false);
check("acronym with a proven website", sameName("National Sheep Association", "NSA", { loose: true }), true);
check("prefix needs a proven website", sameName("PTx Trimble", "PTx"), false);
check("prefix with a proven website", sameName("PTx Trimble", "PTx", { loose: true }), true);
check("place after a brand is not trade words", sameName("Hilton Istanbul Airport", "Hilton"), false);
has("one-word brand tries a UK page", nameCandidates("Evri"), "evri-uk");
has("name guess with the", nameCandidates("The Dalaman Golf Club"), "the-dalaman-golf-club");
has("name guess without the", nameCandidates("The Dalaman Golf Club"), "dalaman-golf-club");

// The tag carries LinkedIn's full name, since LinkedIn only links an exact match.
check(
  "written name swapped for LinkedIn's",
  renderCommentary("SMMT says registrations rose.", [{ urn: "urn:li:organization:1", name: "Society of Motor Manufacturers and Traders (SMMT)", written: "SMMT" }]),
  "@[Society of Motor Manufacturers and Traders (SMMT)](urn:li:organization:1) says registrations rose."
);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
