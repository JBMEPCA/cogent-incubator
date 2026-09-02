// Fleet Leaders, batch one. The interview franchise's first outing on a title
// other than Smart SME.
//
// Sourced the way batch two of SME Leaders was, from national award schemes
// that name the person and date the hook: the King's Awards for Enterprise, the
// Logistics UK Awards 2026 shortlist, and the Everywoman in Transport and
// Logistics Awards. Thirteen candidates became nine after checking:
//
//   Motia                  DCC-owned, 230 staff, not an owner-operator
//   Woodland Logistics     global group, the subject is a regional ops head
//   Aegis Energy           £100m from Quinbrook, not a small business
//   TST Group              tstgroup.com is a DIFFERENT COMPANY. The real one is
//                          tstgroup.uk, caught by checking the sector words on
//                          the page before trusting a plausible domain
//   Fetchmycar UK          site exists, publishes no address
//   Diamond Transport      no findable website at all
//
// Every address below came from huntContact reading the company's own site. No
// verifier, per JB on 1 Sep 2026, and no guessed addresses at any point.
//
// Run with --send to send, otherwise it seeds and prints what it would do.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const SLUG = "fleet-magazine";

// hook: reads directly after "and I'd like the next one to be you." so it has
// to be a complete sentence naming something real and recent about them.
const PEOPLE = [
  {
    personName: "Jorge Crespo",
    personRole: "Managing Director, Vaculug",
    company: "Vaculug",
    companyDomain: "vaculug.com",
    genericEmail: "info@vaculug.com",
    hookUrl: "https://www.tyrepress.com/2026/05/vaculug-wins-kings-award-for-enterprise/",
    newsHook:
      "A King's Award for Enterprise for a Grantham retreader keeping truck tyres out of landfill is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "Retreading has an image problem with some operators who still think of it as the cheap option. What is the argument that actually changes their mind?",
      "What does a retread genuinely cost a fleet over its life compared with a new tyre, once downtime is counted?",
      "You manufacture in Grantham rather than importing. What has that cost you, and what has it given you?",
      "The King's Award was for sustainable development. Which part of the process was hardest to make genuinely circular?",
      "What do fleet managers most often get wrong about tyre management?",
      "What is the biggest constraint on your growth right now?",
      "Where does Vaculug go from here?",
    ],
  },
  {
    personName: "Karen Mosley and Lee Wells",
    personRole: "Co-founders, Kranlee Logistics",
    company: "Kranlee Logistics",
    companyDomain: "kranlee.com",
    genericEmail: "hello@kranlee.com",
    hookUrl: "https://www.alfa-global-family.com/kranlee-logistics-limited-receives-a-kings-award-for-enterprise/",
    newsHook:
      "Launching a freight forwarding business as a brother and sister in early 2020, of all moments, and taking it to a King's Award for international trade is a story our readers would genuinely learn from.",
    questions: [
      "You launched at the start of 2020. How much of the first year was the plan and how much was reacting to what happened?",
      "Freight forwarding is a crowded market with long-established names. What did you offer that got you the first customers?",
      "You are a brother and sister running a company together. What is the rule that keeps that workable?",
      "Chesterfield is not an obvious base for international freight. Has that helped or hurt?",
      "What do UK exporters most often get wrong about moving goods since the customs changes?",
      "What is the most expensive mistake you made in the early years?",
      "Where does Kranlee go from here?",
    ],
  },
  {
    personName: "Stephen Clegg",
    personRole: "Founder and CEO, Topspeed Couriers",
    company: "Topspeed Couriers",
    companyDomain: "topspeedcouriers.co.uk",
    genericEmail: "info@topspeedcouriers.co.uk",
    hookUrl: "https://www.topspeedcouriers.co.uk/2026/05/06/topspeed-couriers-receives-a-kings-award-for-enterprise-in-sustainable-development/",
    newsHook:
      "A King's Award for sustainable development for a courier business you founded yourself is exactly the kind of story our readers want more of.",
    questions: [
      "Same day courier work is priced to the penny. How do you fund sustainability in a market like that?",
      "What was the first change you made that actually cut emissions rather than just looking like it did?",
      "Electric vans still do not suit every courier route. Where do they work for you and where do they not?",
      "What did the King's Award change, practically, about how customers deal with you?",
      "What do customers most misunderstand about what same day delivery costs to run properly?",
      "What is the hardest hire you have had to make?",
      "What is the ambition for the next five years?",
    ],
  },
  {
    personName: "Chris Welch",
    personRole: "Managing Director, Welch Group",
    company: "Welch Group",
    companyDomain: "welchgroup.co.uk",
    genericEmail: "hello@welchgroup.co.uk",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted for both Road Transport Operator of the Year and Most Innovative Company at this year's Logistics Awards is a double our readers would want to understand.",
    questions: [
      "Operator of the Year and Most Innovative Company are usually won by different kinds of business. How do you manage to be both?",
      "What is the innovation you are proudest of that a customer would never notice?",
      "Road transport margins are famously thin. Where does the money actually get made?",
      "Driver shortages have eased and tightened repeatedly. What is your read on it now?",
      "What do shippers most often get wrong when they choose a haulier on price?",
      "What is the biggest constraint on your growth right now?",
      "Where does Welch Group go from here?",
    ],
  },
  {
    personName: "Dr Tevin Tobun",
    personRole: "Founder and CEO, Routd Technology",
    company: "Routd Technology",
    companyDomain: "routd.com",
    genericEmail: "hello@routd.com",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted in four categories at this year's Logistics Awards, including Logistics Leader of the Year, is a clean sweep our readers would want to hear about.",
    questions: [
      "Four shortlistings in one year is unusual. What were you doing three years ago that made this one possible?",
      "Last mile is where most delivery economics break. What did you see that the incumbents did not?",
      "Selling technology to hauliers means selling to people who have been sold a lot of technology. How do you get past that?",
      "What is the single measure a fleet should watch that most of them do not?",
      "You founded the business yourself. At what size did you have to stop doing everything?",
      "What is the hardest part of scaling a logistics technology business in the UK?",
      "Where does Routd go from here?",
    ],
  },
  {
    personName: "Naveed Ahmed",
    personRole: "Director, Sherwood T Group",
    company: "Sherwood T Group",
    companyDomain: "sherwoodtgroup.com",
    genericEmail: "info@sherwoodtgroup.com",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted as Logistics Leader of the Year while the business is also up for Public Services Operator of the Year is a story our readers would find genuinely interesting.",
    questions: [
      "Public sector contracts are famously hard to win and harder to make pay. What did you learn the expensive way?",
      "What does operating for public services demand that a commercial contract does not?",
      "The Leader of the Year shortlisting is personal rather than corporate. What do you think it recognises?",
      "What is the most common misconception about running transport for public bodies?",
      "How do you keep drivers when every operator in the country is chasing the same people?",
      "What is the biggest constraint on your growth right now?",
      "Where does Sherwood T go from here?",
    ],
  },
  {
    personName: "Marie Claire Reid",
    personRole: "Managing Director, TST Group",
    company: "TST Group",
    companyDomain: "tstgroup.uk",
    genericEmail: "info@tstgroup.uk",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted as Logistics Leader of the Year, while a family business you run from Ballymena and Birmingham is also up for International Logistics Business of the Year, is a story our readers would want to hear properly.",
    questions: [
      "Running transport across the Irish Sea got considerably more complicated after Brexit. What does that look like day to day now?",
      "You operate from Ballymena and Birmingham. How different are those two operations really?",
      "It is a family business at 400 people, which is the size most family firms stop being one. How have you held onto that?",
      "Beverages and automotive parts are very different freight. What does each teach you that the other does not?",
      "What do customers most misunderstand about moving goods between Northern Ireland and Great Britain?",
      "What is the hardest hire you have had to make?",
      "Where does TST go from here?",
    ],
  },
  {
    personName: "Brenda Sunley",
    personRole: "Managing Director, Storage & Fulfilment Services",
    company: "Storage and Fulfilment Services",
    companyDomain: "storagefulfilment.co.uk",
    genericEmail: "contact@storagefulfilment.co.uk",
    hookUrl: "https://vanfleetworld.co.uk/winners-revealed-for-2026-everywoman-in-transport-logistics-awards/",
    newsHook:
      "Winning the Warehousing Award at this year's Everywoman in Transport and Logistics Awards is exactly the kind of story our readers want more of.",
    questions: [
      "Warehousing is the part of logistics customers think least about until it goes wrong. What do they underestimate?",
      "Fulfilment volumes swing violently through the year. How do you staff for that without either burning people out or carrying dead cost?",
      "You are running a warehousing business in a sector still short of women at operational level. What has actually changed in your time in it?",
      "What did the Everywoman award change, practically?",
      "Automation is sold hard to warehousing. Where is it genuinely worth it at your size?",
      "What is the biggest constraint on your growth right now?",
      "Where does the business go from here?",
    ],
  },
  {
    personName: "Amanda Unsworth",
    personRole: "Chief Executive, Trinity Logistics",
    company: "Trinity Logistics",
    companyDomain: "trinitylogistics.co.uk",
    genericEmail: "sales@trinitylogistics.co.uk",
    hookUrl: "https://vanfleetworld.co.uk/winners-revealed-for-2026-everywoman-in-transport-logistics-awards/",
    newsHook:
      "Winning the Freight Award at this year's Everywoman in Transport and Logistics Awards is a story our readers would genuinely learn from.",
    questions: [
      "Freight rates have been through a violent few years. What is your read on where they settle?",
      "What is the decision you made during the disruption that turned out to matter most?",
      "Customers say they want resilience and then buy on price. How do you have that conversation?",
      "What did the Everywoman award change for you?",
      "What do people outside freight most misunderstand about how it actually works?",
      "What is the hardest part of running a freight business right now?",
      "Where does Trinity go from here?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.log(`No site ${SLUG}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);
const setting = async (key) => (await prisma.engineSetting.findFirst({ where: { siteId: site.id, key } }))?.value || null;
const franchise = (await setting("interview_franchise")) || "Fleet Leaders";
const titleDescriptor = await setting("interview_title_descriptor");

// Nobody gets approached by two of our titles at once. Smart SME's list is full
// of EV and vehicle businesses and the overlap is real; the same person hearing
// from two mastheads in a fortnight would undo the effect of both.
const elsewhere = await prisma.interviewTarget.findMany({
  where: { siteId: { not: site.id } },
  select: { personName: true, companyDomain: true },
});
const takenNames = new Set(elsewhere.map((r) => r.personName.toLowerCase()));
const takenDomains = new Set(elsewhere.map((r) => (r.companyDomain || "").toLowerCase()).filter(Boolean));

console.log(`Site      : ${site.name}`);
console.log(`Franchise : ${franchise}`);
console.log(`Described : ${titleDescriptor || "(none)"}`);
console.log(`Sending as: ${creds?.outreach?.fromEmail || "(not configured)"}`);
console.log(`Addresses : contact hunter only, no verifier`);
console.log(`Mode      : ${SEND ? "SEND" : "dry run"}`);
console.log(`People    : ${PEOPLE.length}\n`);

const opts = {
  outreach: creds?.outreach,
  titleName: site.name,
  titleDescriptor,
  siteUrl: siteUrl(site),
  senderName: creds?.outreach?.fromName || "James Burke",
  hunt: huntContact,
};

// Paced, for the same reason the follow-up runner is: twenty sends inside
// twenty seconds with one subject shape is a bulk fingerprint no matter how
// good the copy is.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PACE = Number((process.argv.find((a) => a.startsWith("--pace=")) || "").split("=")[1] || 30);
let sent = 0, failed = 0, skipped = 0;
for (const p of PEOPLE) {
  if (takenNames.has(p.personName.toLowerCase()) || takenDomains.has(p.companyDomain.toLowerCase())) {
    console.log(`SKIP (already approached by another title): ${p.personName}`);
    skipped++;
    continue;
  }

  const existing = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, personName: p.personName } });
  if (existing && existing.status !== "pending") { console.log(`skip (${existing.status}): ${p.personName}`); continue; }

  const row = existing || (await prisma.interviewTarget.create({
    data: {
      siteId: site.id,
      personName: p.personName,
      personRole: p.personRole,
      company: p.company,
      companyDomain: p.companyDomain,
      newsHook: p.newsHook,
      hookUrl: p.hookUrl,
      questions: p.questions.join("\n"),
      status: "pending",
    },
  }));

  const withAddresses = { ...row, genericEmail: p.genericEmail };

  if (!SEND) {
    const pick = await resolveAddress(withAddresses, { hunt: huntContact });
    console.log(`would send -> ${(pick?.email || "(nowhere)").padEnd(38)} [${pick?.source || "none"}]  ${p.personName}`);
    continue;
  }

  const res = await sendQuestionsUpFront(prisma, withAddresses, opts);
  if (res.sent) { sent++; console.log(`sent -> ${res.email.padEnd(38)} [${res.source}]  ${p.personName}`); }
  else { failed++; console.log(`FAILED (${res.reason}) ${p.personName}: ${res.error || ""}`); }
  if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
}

console.log(`\ndone. ${SEND ? `sent=${sent}` : `queued=${PEOPLE.length - skipped}`} skippedAsDuplicate=${skipped} failed=${failed}`);
await prisma.$disconnect();
