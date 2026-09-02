// Golf Resort Leader, batch one.
//
// Golf is the hardest of the three titles to reach, and the reason is
// structural rather than a sourcing failure. Nineteen named people were pulled
// out of the trade press in one pass and addresses hunted for all eighteen
// organisations behind them. Seven had one, and the split was almost perfectly
// clean:
//
//   suppliers and brands PUBLISH an address   Paterson, Advanced Turf, Golf
//                                             Genius, Aquatrols, GKB, EIGCA
//   clubs and courses DO NOT                  Tewkesbury Park, London Golf
//                                             Club, Duddingston, Hazeltine,
//                                             Mid Ocean, St Andrews Links,
//                                             Lansdowne, Dreamland, England
//                                             Golf. All run contact forms.
//
// La Grande Mare is the exception that keeps it from being a rule: a resort
// that does publish. So this batch is suppliers plus one resort, not because
// club people are less interesting but because they cannot be emailed.
//
// Martin Hawtree, retiring after five decades of golf course architecture, is
// the one that got away. His practice publishes nothing on four candidate
// domains and the only route is the EIGCA inbox, which would have put the wrong
// company in the card. He is worth a manual chase.
//
// Run with --send to send, otherwise it seeds and prints what it would do.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const SLUG = "golf-resort-magazine";

const PEOPLE = [
  {
    personName: "Fraser Wilson",
    personRole: "Owner, Paterson Golf",
    company: "Paterson Golf",
    companyDomain: "patersongolf.com",
    genericEmail: "sales@patersongolf.com",
    hookUrl: "https://golfbusinessnews.com/news/people/paterson-golf-begins-new-chapter-as-next-generation-takes-the-reins-at-family-owned-accessories-company/",
    newsHook:
      "Taking over a forty year old family business from your father, and keeping it in the family rather than selling it, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "Your father Brian ran Paterson Golf for forty years. What is the hardest part of taking over from a parent?",
      "Was there ever a moment when selling the business was the obvious option, and what made you keep it?",
      "Supplying branded accessories to clubs and resorts is a relationship business. How much of that transfers with a change of owner, and how much do you have to earn again?",
      "What has changed most about what a pro shop wants to stock in the last decade?",
      "You are in Scotland selling into clubs across Europe. What does that make harder than people assume?",
      "What is the piece of advice from your father that you have kept, and one you have quietly dropped?",
      "Where does Paterson Golf go from here?",
    ],
  },
  {
    personName: "Ben Stimson",
    personRole: "Managing Director, La Grande Mare",
    company: "La Grande Mare",
    companyDomain: "lagrandemare.com",
    genericEmail: "info@lagrandemare.com",
    hookUrl: "https://golfbusinessnews.com/news/people/la-grande-mare-announces-key-hires-ahead-of-golf-course-opening/",
    newsHook:
      "Opening a golf course to the public in August, on an island where every visitor arrives by boat or plane, is a story our readers would genuinely learn from.",
    questions: [
      "Opening a course to the public is a bigger decision than it sounds. What made it the right one for La Grande Mare?",
      "Guernsey is a small market with a hard ceiling on local demand. How much of the plan depends on visitors?",
      "You hired a golf operations team ahead of the opening rather than after it. What did that buy you?",
      "Running a hotel and a golf course together is two businesses with different rhythms. Where do they actually help each other?",
      "What does operating on an island make expensive that mainland operators never think about?",
      "What is the biggest constraint on the resort right now?",
      "Where does La Grande Mare go from here?",
    ],
  },
  {
    personName: "Jeremy Vincent",
    personRole: "Sales Manager, Advanced Turf Technology",
    company: "Advanced Turf Technology",
    companyDomain: "infinicut.com",
    genericEmail: "info@infinicut.com",
    hookUrl: "https://golfbusinessnews.com/news/people/advanced-turf-technology-appoints-new-sales-manager/",
    newsHook:
      "Moving from selling the INFINICUT range as a dealer to working for the company that makes it is a change of side our readers would find genuinely interesting.",
    questions: [
      "You sold these machines as a dealer before you joined the manufacturer. What looks different from the inside?",
      "What do course managers ask you now that they never asked five years ago?",
      "Battery and lightweight mowing were a hard sell to greenkeepers for years. Has that argument actually been won?",
      "What is the most common mistake a club makes when it specifies new machinery?",
      "Turf machinery is a considered purchase on a tight budget. How do you have the money conversation honestly?",
      "What is the thing about greenkeeping that people outside the industry never appreciate?",
      "What is next for you in the role?",
    ],
  },
  {
    personName: "Sean Dainty",
    personRole: "Managing Director International, Golf Genius",
    company: "Golf Genius",
    companyDomain: "golfgenius.com",
    genericEmail: "sales@golfgenius.com",
    hookUrl: "https://golfbusinessnews.com/news/people/golf-genius-appoints-international-managing-director/",
    newsHook:
      "Stepping into an international managing director role as part of a planned succession, rather than after a departure, is a rarer thing than it should be and our readers would want to hear about it.",
    questions: [
      "Planned succession is unusual enough to be worth asking about. How was the handover actually done?",
      "Tournament software has to work on the day or it is worthless. How does that shape how you build and sell it?",
      "Clubs are famously slow to change systems. What finally moves one?",
      "What does international growth mean in practice when golf works differently in every country?",
      "What do club managers most often get wrong about the technology they already have?",
      "What is the hardest part of the job that nobody warned you about?",
      "Where does Golf Genius go from here?",
    ],
  },
  {
    personName: "Mika Nurminen",
    personRole: "European Account Manager, Aquatrols",
    company: "Aquatrols",
    companyDomain: "aquatrols.com",
    genericEmail: "info@aquatrols.com",
    hookUrl: "https://golfbusinessnews.com/news/people/aquatrols-company-appoints-mika-nurminen-as-european-account-manager/",
    newsHook:
      "Two decades of hands on sports surface work behind a new European role is exactly the kind of background our readers want to hear from.",
    questions: [
      "You spent twenty years on surfaces before moving to the supplier side. What does that let you say to a course manager that a salesperson cannot?",
      "Water is becoming the defining constraint on golf in much of Europe. What is genuinely changing on the ground?",
      "Soil surfactants are one of those products where the science is ahead of the belief. How do you close that gap?",
      "What differs most between how Nordic and southern European courses manage turf?",
      "What is the most common thing a club spends money on that it did not need?",
      "What has surprised you most about the move from the course to the supplier side?",
      "What is next in the role?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.log(`No site ${SLUG}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);
const setting = async (key) => (await prisma.engineSetting.findFirst({ where: { siteId: site.id, key } }))?.value || null;
const franchise = (await setting("interview_franchise")) || "Golf Resort Leader";
const titleDescriptor = await setting("interview_title_descriptor");

// Nobody is approached by two of our titles at once.
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
    console.log(`would send -> ${(pick?.email || "(nowhere)").padEnd(34)} [${pick?.source || "none"}]  ${p.personName}`);
    continue;
  }

  const res = await sendQuestionsUpFront(prisma, withAddresses, opts);
  if (res.sent) { sent++; console.log(`sent -> ${res.email.padEnd(34)} [${res.source}]  ${p.personName}`); }
  else { failed++; console.log(`FAILED (${res.reason}) ${p.personName}: ${res.error || ""}`); }
  if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
}

console.log(`\ndone. ${SEND ? `sent=${sent}` : `queued=${PEOPLE.length - skipped}`} skippedAsDuplicate=${skipped} failed=${failed}`);
await prisma.$disconnect();
