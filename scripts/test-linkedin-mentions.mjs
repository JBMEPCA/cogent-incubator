/**
 * Asserts the company-tagging guesser without touching LinkedIn.
 *
 * The case that matters is barberingbusiness.com: the domain label alone never
 * produces "barbering-business", so before anchor text was used our own title
 * could not have been tagged by this code.
 *
 * Run: node --env-file=.env scripts/test-linkedin-mentions.mjs
 */
import { vanityCandidates, renderCommentary, escapeCommentary } from "../lib/linkedin-mentions.js";

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

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
