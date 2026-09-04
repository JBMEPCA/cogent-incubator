// Fleet Professional, batch two.
//
// The easy seam is worked out. Batch one came from award lists that name the
// person outright, and once those are exhausted sourcing drops to roughly one
// usable name per search, because finalist lists name companies and you then
// have to find the human behind each one.
//
// So this batch takes the individuals already named on the Logistics UK and
// Everywoman shortlists who were set aside first time round for being
// employees rather than owners. JB widened the brief on 2 Sep: the franchise
// celebrates a person, and a brand, a depot or a group is fine.
//
// Five of thirteen candidate organisations published no address at all:
// Howards Tenens, Lankelma, Truline, Streamline Shipping, sopp+sopp. Collett
// and Manfreight publish one but no leader could be named, so they are held
// rather than addressed to nobody.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const SLUG = "fleet-magazine";

const PEOPLE = [
  {
    personName: "Mervyn O'Callaghan",
    personRole: "Co-founder and CEO, CameraMatics",
    company: "CameraMatics",
    companyDomain: "cameramatics.com",
    genericEmail: "info@cameramatics.com",
    hookUrl: "https://www.irishtimes.com/business/2026/06/10/fleet-safety-tech-firm-cameramatics-raises-49m-with-isif-and-aib-backing/",
    newsHook:
      "Raising 49 million euro for a fleet safety business you co-founded, and being shortlisted twice at this year's Logistics Awards on top of it, is a story our readers would genuinely learn from.",
    questions: [
      "You co-founded the company. What did you see about fleet safety that the incumbents had missed?",
      "Raising 49 million changes a business. What are you now able to do that you could not last year?",
      "Camera and telematics systems are sold hard to operators. How do you get past the scepticism that creates?",
      "What does the data actually show about why collisions happen, once you have enough of it?",
      "Drivers often experience safety technology as surveillance. How do you get them on side?",
      "What is the hardest part of scaling this from Ireland into the UK and beyond?",
      "Where does CameraMatics go from here?",
    ],
  },
  {
    personName: "Peter Smith",
    personRole: "Managing Director, Life Couriers UK",
    company: "Life Couriers UK",
    companyDomain: "lifecouriers.com",
    genericEmail: "contact@lifecouriers.com",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted for Last Mile Delivery Business of the Year while running healthcare logistics, where a late delivery is not an inconvenience but a clinical problem, is exactly the kind of story our readers want more of.",
    questions: [
      "Healthcare freight has no tolerance for a missed window. How does that change how you run a fleet?",
      "You rebranded from Vision Logistics. What was behind that?",
      "Temperature controlled work adds cost at every step. How do you have that conversation with a customer?",
      "What do people outside pharmaceutical logistics most underestimate about it?",
      "Last mile is where most delivery economics break. Where do yours actually work?",
      "What is the hardest hire you have had to make?",
      "Where does Life Couriers go from here?",
    ],
  },
  {
    personName: "Eddie Davidson",
    personRole: "Operations and Technology Director, Aegis Energy",
    company: "Aegis Energy",
    companyDomain: "aegisenergy.uk",
    genericEmail: "contact@aegisenergy.uk",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Building the refuelling network that commercial fleets will actually depend on, with 100 million behind it and a Rising Star shortlisting this year, is a story our readers would want to understand properly.",
    questions: [
      "Operators have been told to decarbonise for years without anywhere to refuel. What is genuinely changing?",
      "You are building for electric, hydrogen, bio-CNG and HVO at once. Why not pick one?",
      "What has to be true about a site before it is worth building a hub there?",
      "Hauliers plan in decades for depots and in months for contracts. How do you sell into that?",
      "What is the most common misconception fleet managers have about alternative fuels?",
      "What is the biggest constraint on the rollout right now?",
      "Where is the network in three years?",
    ],
  },
  {
    personName: "Jennifer Swain",
    personRole: "Director of Talent, Development and HR, Road to Logistics",
    company: "Road to Logistics",
    companyDomain: "roadtologistics.org",
    genericEmail: "info@roadtologistics.org",
    hookUrl: "https://vanfleetworld.co.uk/winners-revealed-for-2026-everywoman-in-transport-logistics-awards/",
    newsHook:
      "Winning the Industry Champion award for getting people into logistics who would never otherwise have found their way in is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "The driver shortage gets discussed endlessly and solved rarely. What actually works?",
      "You recruit from groups the industry has historically ignored. What has surprised you about how they do?",
      "What does an operator have to change internally before a new intake will stay?",
      "Which part of getting somebody licensed and employed is the real bottleneck?",
      "What do employers still get wrong when they hire a first-time driver?",
      "What did the Everywoman award change, practically?",
      "Where does Road to Logistics go from here?",
    ],
  },
  {
    personName: "Leigha Blake",
    personRole: "Head of Northern Operations, Woodland Logistics",
    company: "Woodland Logistics",
    companyDomain: "woodlandgroup.com",
    genericEmail: "web-emea@woodlandgroup.com",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted as a Rising Star while running northern operations for a global freight business is exactly the kind of story our readers want more of.",
    questions: [
      "You run northern operations for a business that works globally. What does the north of England do differently?",
      "Rising Star suggests a fast climb. What was the job that taught you the most?",
      "What is the hardest thing about operational leadership that nobody prepares you for?",
      "Freight has been through a violent few years. What has that looked like from an operations desk?",
      "What do customers most often misunderstand about what you can and cannot promise them?",
      "What advice would you give someone starting in logistics now?",
      "Where do you want to be in five years?",
    ],
  },
  {
    personName: "Josh Rand",
    personRole: "Workshop Management Apprentice, Bethell",
    company: "Bethell",
    companyDomain: "bethell.co.uk",
    genericEmail: "wecanhelp@bethell.co.uk",
    hookUrl: "https://logistics.org.uk/event/logistics-awards/",
    newsHook:
      "Being shortlisted as a Rising Star at this year's Logistics Awards while still an apprentice is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "You are shortlisted nationally while still an apprentice. How did that come about?",
      "What does an apprenticeship in workshop management actually involve day to day?",
      "What did you expect the job to be, and what is it really?",
      "Keeping a fleet on the road is invisible until something breaks. What do people miss about it?",
      "What would have made the route in easier for you?",
      "What do you want to be doing in ten years?",
      "What would you say to someone your age considering this rather than university?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
const { creds } = await siteCredentials(site.id);
const setting = async (key) => (await prisma.engineSetting.findFirst({ where: { siteId: site.id, key } }))?.value || null;
const franchise = (await setting("interview_franchise")) || "Fleet Professional";
const titleDescriptor = await setting("interview_title_descriptor");

const elsewhere = await prisma.interviewTarget.findMany({ where: { siteId: { not: site.id } }, select: { personName: true, companyDomain: true } });
const takenNames = new Set(elsewhere.map((r) => r.personName.toLowerCase()));
const takenDomains = new Set(elsewhere.map((r) => (r.companyDomain || "").toLowerCase()).filter(Boolean));

console.log(`Site      : ${site.name}\nFranchise : ${franchise}\nMode      : ${SEND ? "SEND" : "dry run"}\nPeople    : ${PEOPLE.length}\n`);

const opts = {
  outreach: creds?.outreach,
  titleName: site.name,
  titleDescriptor,
  siteUrl: siteUrl(site),
  senderName: creds?.outreach?.fromName || "James Burke",
  hunt: huntContact,
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PACE = Number((process.argv.find((a) => a.startsWith("--pace=")) || "").split("=")[1] || 30);

let sent = 0, failed = 0, skipped = 0;
for (const p of PEOPLE) {
  if (takenNames.has(p.personName.toLowerCase()) || takenDomains.has(p.companyDomain.toLowerCase())) {
    console.log(`SKIP (another title has them): ${p.personName}`); skipped++; continue;
  }
  const existing = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, personName: p.personName } });
  if (existing && existing.status !== "pending") { console.log(`skip (${existing.status}): ${p.personName}`); continue; }

  const row = existing || (await prisma.interviewTarget.create({
    data: {
      siteId: site.id, personName: p.personName, personRole: p.personRole, company: p.company,
      companyDomain: p.companyDomain, newsHook: p.newsHook, hookUrl: p.hookUrl,
      questions: p.questions.join("\n"), status: "pending",
    },
  }));
  const withAddresses = { ...row, genericEmail: p.genericEmail };

  if (!SEND) {
    const pick = await resolveAddress(withAddresses, { hunt: huntContact });
    console.log(`would send -> ${(pick?.email || "(nowhere)").padEnd(32)} [${pick?.source || "none"}]  ${p.personName}`);
    continue;
  }
  const res = await sendQuestionsUpFront(prisma, withAddresses, opts);
  if (res.sent) { sent++; console.log(`sent -> ${res.email.padEnd(32)} [${res.source}]  ${p.personName}`); }
  else { failed++; console.log(`FAILED (${res.reason}) ${p.personName}: ${res.error || ""}`); }
  if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
}
console.log(`\ndone. ${SEND ? `sent=${sent}` : `queued=${PEOPLE.length - skipped}`} skipped=${skipped} failed=${failed}`);
await prisma.$disconnect();
