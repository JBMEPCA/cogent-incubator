/**
 * Asserts the company-tagging guesser without touching LinkedIn.
 *
 * The case that matters is barberingbusiness.com: the domain label alone never
 * produces "barbering-business", so before anchor text was used our own title
 * could not have been tagged by this code.
 *
 * The 23 Oct 2026 cases are real: the organisations below are what LinkedIn
 * returned (through Make) for those vanity names that day, and the post
 * wording is from posts that went out in the fortnight before.
 *
 * Run: node --env-file=.env scripts/test-linkedin-mentions.mjs
 */
import {
  vanityCandidates,
  renderCommentary,
  escapeCommentary,
  websiteConfirms,
  isPublisher,
  coreName,
  brandLabel,
  organisationForHost,
  lookupBudget,
  fresh,
  CHECK_VERSION,
  MAX_CANDIDATES,
  mentionsForArticle,
} from "../lib/linkedin-mentions.js";

let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};
const has = (name, list, wanted) => check(name, list.includes(wanted), true);
const hasnt = (name, list, unwanted) => check(name, list.includes(unwanted), false);

// ---------- candidates (unchanged behaviour) ----------

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

// ---------- rule 2: more candidates, still bounded ----------

check("capped", vanityCandidates("a-b-c.com", ["One Two", "Three Four", "Five Six", "Seven Eight"]).length <= MAX_CANDIDATES, true);
// media.stellantis.com guessed "media" and nothing else useful.
check("subdomain: brand label, not 'media'", vanityCandidates("media.stellantis.com", [])[0], "stellantis");
hasnt("generic subdomain dropped", vanityCandidates("media.stellantis.com", []), "media");
// quickbooks.intuit.com resolved as Intuit QuickBooks under the old first guess; keep it first.
check("product subdomain kept first", vanityCandidates("quickbooks.intuit.com", [])[0], "quickbooks");
check("co.uk brand label", brandLabel("www.birminghamairport.co.uk"), "birminghamairport");
has("anchor gives birmingham-airport", vanityCandidates("birminghamairport.co.uk", ["Birmingham Airport"]), "birmingham-airport");
has("anchor gives lloyds-bank", vanityCandidates("lloydsbank.com", ["Lloyds Bank"]), "lloyds-bank");
has("-uk variant from the anchor: daf-trucks-uk", vanityCandidates("daftrucks.co.uk", ["DAF Trucks"]), "daf-trucks-uk");
has("-uk variant of the label", vanityCandidates("renault.co.uk", []), "renault-uk");
has("-group variant of the label", vanityCandidates("renault.co.uk", []), "renault-group");

// ---------- rule 1: website check across TLDs and parent domains ----------

// mercedesbenz -> Mercedes-Benz AG, http://www.mercedes-benz.com/
check("co.uk link, .com page, vanity from label", websiteConfirms("mercedes-benz.com", "mercedes-benz.co.uk", "mercedesbenz"), true);
// daf-trucks-uk -> DAF Trucks UK, https://www.daftrucks.com
check("co.uk link, .com page, -uk vanity from anchor", websiteConfirms("daftrucks.com", "daftrucks.co.uk", "daf-trucks-uk", ["DAF Trucks"]), true);
// ryder -> RYDER, https://ryder.com
check("ryder.co.uk confirmed by ryder.com", websiteConfirms("ryder.com", "ryder.co.uk", "ryder"), true);
// stellantis -> Stellantis, https://www.stellantis.com
check("subdomain link, parent-domain page", websiteConfirms("stellantis.com", "media.stellantis.com", "stellantis"), true);
check("exact host still passes", websiteConfirms("birminghamairport.co.uk", "birminghamairport.co.uk", "birmingham-airport"), true);
// iata -> "IATA", http://www.iata.com.mx: not proof it is the iata.org IATA.
check("two country TLDs do not confirm (iata.org vs iata.com.mx)", websiteConfirms("iata.com.mx", "iata.org", "iata"), false);
// daf-trucks -> DAF Trucks NV, http://www.daf.com: a different label.
check("different label does not confirm (daf.com)", websiteConfirms("daf.com", "daftrucks.co.uk", "daf-trucks", ["DAF Trucks"]), false);
check("vanity not derived from the brand does not confirm", websiteConfirms("renault.com", "renault.co.uk", "groupe-r", ["Renault"]), false);
check("short label does not cross TLDs (aa)", websiteConfirms("aa.com", "aa.co.uk", "aa"), false);

// End to end through organisationForHost, with LinkedIn's real answers.
const ORGS = {
  mercedesbenz: { id: 5383634, localizedName: "Mercedes-Benz AG", localizedWebsite: "http://www.mercedes-benz.com/" },
  "daf-trucks": { id: 6868, localizedName: "DAF Trucks NV", localizedWebsite: "http://www.daf.com" },
  "daf-trucks-uk": { id: 9372834, localizedName: "DAF Trucks UK", localizedWebsite: "https://www.daftrucks.com" },
  iata: { id: 25037907, localizedName: "IATA", localizedWebsite: "http://www.iata.com.mx" },
  "iata-group": { id: 92182270, localizedName: "IATA GROUP", localizedWebsite: "http://iatagroup.eu" },
  stellantis: { id: 66256333, localizedName: "Stellantis", localizedWebsite: "https://www.stellantis.com" },
  renault: { id: 74524431, localizedName: "Renault" },
  ryder: { id: 23046597, localizedName: "RYDER", localizedWebsite: "https://ryder.com" },
  "lloyds-bank": { id: 2603, localizedName: "Lloyds Bank", localizedWebsite: "http://www.lloydsbank.com/" },
  "birmingham-airport": { id: 2207396, localizedName: "Birmingham Airport", localizedWebsite: "http://www.birminghamairport.co.uk" },
};
let calls = 0;
const fake = async (_token, vanity) => (calls++, ORGS[vanity] || null);
const resolve = (host, anchors = [], cache = {}) => organisationForHost(null, host, cache, anchors, lookupBudget({ lookup: fake }));

check("mercedes-benz.co.uk resolves", (await resolve("mercedes-benz.co.uk", ["Mercedes-Benz"]))?.name, "Mercedes-Benz AG");
check("daftrucks.co.uk resolves to DAF Trucks UK", (await resolve("daftrucks.co.uk", ["DAF Trucks"]))?.name, "DAF Trucks UK");
check("media.stellantis.com resolves", (await resolve("media.stellantis.com", ["Stellantis"]))?.name, "Stellantis");
check("ryder.co.uk resolves", (await resolve("ryder.co.uk", ["Ryder"]))?.name, "RYDER");
check("lloydsbank.com resolves", (await resolve("lloydsbank.com", ["Lloyds Bank"]))?.name, "Lloyds Bank");
check("birminghamairport.co.uk resolves", (await resolve("birminghamairport.co.uk", ["Birmingham Airport"]))?.name, "Birmingham Airport");
check("iata.org does not resolve to the iata.com.mx page", await resolve("iata.org", ["IATA"]), null);
check("renault.co.uk: a page with no website is never tagged", await resolve("renault.co.uk", ["Renault"]), null);

// The lookup budget: an exhausted budget leaves the host uncached, to try again.
{
  const cache = {};
  const budget = lookupBudget({ calls: 1, lookup: fake });
  await organisationForHost(null, "nothing-here.co.uk", cache, [], budget);
  check("budget spent: host not cached as negative", cache["nothing-here.co.uk"], undefined);
  const full = {};
  await organisationForHost(null, "nothing-here.co.uk", full, [], lookupBudget({ lookup: fake }));
  check("budget enough: negative cached with the check version", full["nothing-here.co.uk"]?.v, CHECK_VERSION);
}
{
  // The same vanity is asked once per budget, however many hosts derive it.
  calls = 0;
  const budget = lookupBudget({ lookup: fake });
  await organisationForHost(null, "ryder.co.uk", {}, [], budget);
  await organisationForHost(null, "ryder.com", {}, [], budget);
  check("repeat vanity costs nothing", calls, 1);
}

// ---------- rule 7: old negatives are looked at again, once ----------

const day = 864e5;
check("old-version negative is stale", fresh({ urn: null, at: Date.now() - day }), false);
check("current-version negative is fresh", fresh({ urn: null, at: Date.now() - day, v: CHECK_VERSION }), true);
check("positive unaffected by version", fresh({ urn: "urn:li:organization:1", name: "X", at: Date.now() - day }), true);

// ---------- rule 5: no news outlets or publishers ----------

check("trade press by label (airportindustry-news.com)", isPublisher("airportindustry-news.com", "Airport Industry-News"), true);
check("trade press by name (pv magazine Global)", isPublisher("pv-magazine.com", "pv magazine Global"), true);
check("passengerterminaltoday.com", isPublisher("passengerterminaltoday.com"), true);
check("laingbuissonnews.com", isPublisher("laingbuissonnews.com"), true);
check("national press (bbc.co.uk)", isPublisher("bbc.co.uk"), true);
check("The Times by name", isPublisher("thetimes.com", "The Times"), true);
check("The Sun", isPublisher("thesun.co.uk", "The Sun"), true);
check("The Motley Fool", isPublisher("fool.com", "The Motley Fool"), true);
check("a rival trade title (The Golf Business)", isPublisher("thegolfbusiness.co.uk", "The Golf Business"), true);
check("a newsletter platform", isPublisher("dentalgroupsignal.substack.com", "Dental Group Signal"), true);
check("a company is not a publisher (Webfleet)", isPublisher("webfleet.com", "Webfleet"), false);
check("a company is not a publisher (Birmingham Airport)", isPublisher("birminghamairport.co.uk", "Birmingham Airport"), false);
{
  // A cached publisher from before this rule is no longer tagged.
  const cache = { "pv-magazine.com": { urn: "urn:li:organization:9", name: "pv magazine Global", at: Date.now() } };
  check("cached publisher not tagged", await organisationForHost(null, "pv-magazine.com", cache, [], lookupBudget({ lookup: fake })), null);
}

// ---------- rule 4: brand scan, off by default, same website check ----------

{
  const scan = async () => [{ name: "Lloyds Bank", host: "lloydsbank.com" }, { name: "IATA", host: "iata.org" }];
  // An in-memory cache, so the test never writes to the live one.
  const store = () => {
    const mem = {};
    return { read: async () => ({ ...mem }), write: async (c) => Object.assign(mem, c) };
  };
  const text = "Lloyds Bank and IATA said";
  const off = await mentionsForArticle(null, { links: [], text, budget: lookupBudget({ lookup: fake }), scan, store: store() });
  check("brand scan off by default: nothing found without links", off, []);
  const on = await mentionsForArticle(null, { links: [], text, brandScan: true, budget: lookupBudget({ lookup: fake }), scan, store: store() });
  check("brand scan on: verified brand found, unverified one not", on.map((m) => [m.name, m.via]), [["Lloyds Bank", "scan"]]);
  check("brand scan name renders as a tag", renderCommentary(text, on), "@[Lloyds Bank](urn:li:organization:2603) and IATA said");
}

// ---------- rule 3: the post's own wording ----------

check("core name: legal tail", coreName("Whistl UK Ltd"), "Whistl");
check("core name: Inc", coreName("GXO Logistics, Inc."), "GXO Logistics");
check("core name: parenthesis and Limited", coreName("Elddis Transport (Consett) Limited"), "Elddis Transport");
check("core name: group", coreName("Scania Group"), "Scania");
check("core name never empties a one-word name", coreName("Group"), "Group");

const tag = (text, name, extra = {}) => renderCommentary(text, [{ urn: "urn:li:organization:1", name, ...extra }]);

// LinkedIn links a mention only when its text is the full organisation name,
// case-sensitively, so the post's wording is replaced by the full name.
check("Scania -> Scania Group", tag("Scania has unveiled a new truck.", "Scania Group"), "@[Scania Group](urn:li:organization:1) has unveiled a new truck.");
check("Isuzu -> Isuzu UK (real post)", tag("The Isuzu D-Max has taken", "Isuzu UK"), "The @[Isuzu UK](urn:li:organization:1) D-Max has taken");
check(
  "Elddis Transport -> full name, parentheses escaped inside the mention",
  tag("Elddis Transport has won", "Elddis Transport (Consett) Limited"),
  "@[Elddis Transport \\(Consett\\) Limited](urn:li:organization:1) has won"
);
check("Whistl -> Whistl UK Ltd (real post)", tag("Whistl has just been", "Whistl UK Ltd"), "@[Whistl UK Ltd](urn:li:organization:1) has just been");
check("Nvidia's -> NVIDIA's (real post)", tag("Nvidia's Jensen Huang", "NVIDIA"), "@[NVIDIA](urn:li:organization:1)'s Jensen Huang");
check("Horsch -> HORSCH (real post)", tag("onto Amazone, Horsch and Lemken", "HORSCH"), "onto Amazone, @[HORSCH](urn:li:organization:1) and Lemken");
check(
  "anchor spelled differently: The Pensions Regulator",
  tag("The Pensions Regulator warned", "ThePensionsRegulator", { aliases: ["The Pensions Regulator"] }),
  "@[ThePensionsRegulator](urn:li:organization:1) warned"
);
check(
  "bracketed acronym: SMMT",
  tag("SMMT figures show", "Society of Motor Manufacturers and Traders (SMMT)"),
  "@[Society of Motor Manufacturers and Traders \\(SMMT\\)](urn:li:organization:1) figures show"
);
// Pages that claim a parent's website, all real cache entries. A shorter name
// that drops real words is never rewritten to them.
check("Hilton is not Hilton Istanbul Airport", tag("Hilton has opened", "Hilton Istanbul Airport", { aliases: ["Hilton"] }), escapeCommentary("Hilton has opened"));
check("Thales is not Thales DIS Finland Oy", tag("Thales won", "Thales DIS Finland Oy", { aliases: ["Thales"] }), escapeCommentary("Thales won"));
check("Dental Elite is not rewritten to the longer page name", tag("Dental Elite says", "Dental Elite Valuers, Brokers & Recruiters", { aliases: ["Dental Elite"] }), escapeCommentary("Dental Elite says"));
check("a descriptor is not a name (Nuveen, a TIAA company)", tag("Nuveen has bought", "Nuveen, a TIAA company"), escapeCommentary("Nuveen has bought"));
check("exact name still tags as before", tag("Uppercut Deluxe's Shindig", "Uppercut Deluxe"), "@[Uppercut Deluxe](urn:li:organization:1)'s Shindig");

// Generic words are not tagged on a loose match.
check("'logistics' is not Logistics UK", tag("UK logistics firms are hiring.", "Logistics UK"), escapeCommentary("UK logistics firms are hiring."));
check("'Logistics' at a sentence start is not Logistics UK", tag("Logistics firms are hiring.", "Logistics UK"), escapeCommentary("Logistics firms are hiring."));
check("'Movement' is not tagged", tag("Movement matters for older people.", "Movement"), escapeCommentary("Movement matters for older people."));
check("'The Times' is not tagged", tag("The Times reported it.", "The Times"), escapeCommentary("The Times reported it."));
check("all-generic full name tags when exact", tag("Health & Fitness Association data", "Health & Fitness Association"), "@[Health & Fitness Association](urn:li:organization:1) data");
check("all-generic full name does not tag in another case", tag("HEALTH & FITNESS ASSOCIATION data", "Health & Fitness Association"), escapeCommentary("HEALTH & FITNESS ASSOCIATION data"));
check("lowercase 'iata' is not IATA", tag("an iata code", "IATA"), escapeCommentary("an iata code"));
check("STA in 'staff' is not STA", tag("gym staff", "STA (Swimming Teachers Association)"), escapeCommentary("gym staff"));

// A tagline is not a name: XenomatiX - TRUE SOLID STATE LIDAR is not written into a post.
check("tagline name only tags on an exact match", tag("XenomatiX has", "XenomatiX - TRUE SOLID STATE LIDAR"), escapeCommentary("XenomatiX has"));

// The article link and hashtags are never touched.
check(
  "no tag inside the URL or a hashtag",
  tag("https://thefleetmagazine.co.uk/scania-news/ #Scania", "Scania Group"),
  escapeCommentary("https://thefleetmagazine.co.uk/scania-news/ #Scania")
);

// Only the first mention of each company; longest name wins at one position.
check(
  "first occurrence only",
  tag("Scania and Scania again", "Scania Group"),
  "@[Scania Group](urn:li:organization:1) and Scania again"
);
check(
  "Ford Pro before Ford",
  renderCommentary("Ford Pro said", [
    { urn: "urn:li:organization:1", name: "Ford" },
    { urn: "urn:li:organization:2", name: "Ford Pro" },
  ]),
  "@[Ford Pro](urn:li:organization:2) said"
);

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
