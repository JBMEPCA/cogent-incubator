// SME Leaders, batch three.
//
// Sourced from the f:Entrepreneur #iAlso100 for 2026, Small Business Britain's
// list of a hundred leading UK women founders. The best source found so far
// for this title: the list names the person AND the business, where award
// shortlists usually name only the company and leave you hunting the human.
//
// Fourteen candidates, seven reachable. The seven without a published address
// are the smallest of them, which is the pattern throughout: a solo consultancy
// or a maker often runs on a contact form and a social account.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const SLUG = "smart-sme";
const HOOK_URL = "https://f-entrepreneur.com/ialso-100-2026/";

const PEOPLE = [
  {
    personName: "Clementine Schouteden",
    personRole: "Founder, Kavee",
    company: "Kavee",
    companyDomain: "kavee.com",
    genericEmail: "help@kavee.com",
    newsHook:
      "Turning a genetics PhD into a global pet products business, and being named in this year's f:Entrepreneur 100, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "You have a PhD in genetics and you build modular pet enclosures. How did one lead to the other?",
      "What did a scientific training give you that a business course would not have?",
      "You sell direct to consumers internationally. Which market surprised you most?",
      "What was the point at which this stopped being a side project and became a company?",
      "Direct to consumer got much harder as advertising costs rose. What changed in how you sell?",
      "What is the most expensive mistake you made in the early years?",
      "Where does Kavee go from here?",
    ],
  },
  {
    personName: "Emma Dearlove",
    personRole: "Founder, Auxilium Finance",
    company: "Auxilium Finance",
    companyDomain: "auxiliumfinance.co.uk",
    genericEmail: "hello@auxiliumfinance.co.uk",
    newsHook:
      "Building a Teesside consultancy that changes how small businesses actually understand their own numbers, and being named in this year's f:Entrepreneur 100, is a story our readers would genuinely learn from.",
    questions: [
      "Most small business owners can read a P&L and still not know what it is telling them. Where does that gap come from?",
      "What is the number you most often find a business is not watching?",
      "You are open about being a neurodiverse entrepreneur. What has that changed about how you run the firm?",
      "Teesside rather than London. What has that cost you and what has it given you?",
      "When a client is in trouble, what is usually the real cause rather than the stated one?",
      "What is the advice you find yourself repeating most often?",
      "Where does Auxilium go from here?",
    ],
  },
  {
    personName: "Birgit Kehrer",
    personRole: "Founder, ChangeKitchen CIC",
    company: "ChangeKitchen CIC",
    companyDomain: "changekitchen.co.uk",
    genericEmail: "marketing@changekitchen.co.uk",
    newsHook:
      "Running a climate-friendly catering business since 2010 that exists to employ people the labour market has written off, and being named in this year's f:Entrepreneur 100, is exactly the kind of story our readers want more of.",
    questions: [
      "A community interest company has to trade as hard as any caterer. Which is harder on a bad month, the trading or the mission?",
      "You founded it in 2010. What has actually changed about how clients treat social value since then?",
      "Event catering has thin margins and unforgiving timing. How does employing people with barriers to work fit that?",
      "What do corporate clients say they want from a supplier like you, and what do they actually buy on?",
      "What is the least glamorous part of the business that nobody warns you about?",
      "Is there a decision from the early years you would reverse?",
      "Where does ChangeKitchen go from here?",
    ],
  },
  {
    personName: "Emily Vass",
    personRole: "Founder, Nourished Accounting",
    company: "Nourished Accounting",
    companyDomain: "nourishedaccounting.com",
    genericEmail: "support@nourishedaccounting.com",
    newsHook:
      "Building a digital accountancy practice for people who find their own finances frightening, and being named in this year's f:Entrepreneur 100, is a story our readers would genuinely learn from.",
    questions: [
      "A lot of your clients are creatives and sole traders who avoid their numbers. What actually gets someone past that?",
      "Accountancy is being automated hard. What is left that a person must do?",
      "What do small business owners most often get wrong in their first two years of trading?",
      "You built the practice digital first. What did that let you do that a high street firm cannot?",
      "Making Tax Digital keeps moving. How much of your job is now translating government policy?",
      "What is the hardest part of running a practice that nobody outside it sees?",
      "Where does Nourished go from here?",
    ],
  },
  {
    personName: "Alison Leach",
    personRole: "Founder, BooksForTopics",
    company: "BooksForTopics",
    companyDomain: "booksfortopics.com",
    genericEmail: "info@booksfortopics.com",
    newsHook:
      "Turning a primary teacher's booklists into a resource that thousands of schools rely on, and being named in this year's f:Entrepreneur 100, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "It began as booklists made for your own classroom. When did you realise other schools needed it too?",
      "Selling to schools is famously slow and budget bound. How did you build something that works anyway?",
      "What does a teacher actually need from a resource that publishers keep failing to provide?",
      "You went from teaching to running a business. What was the hardest part of that switch?",
      "How do you keep recommendations genuinely independent when publishers would like to influence them?",
      "What is the biggest constraint on your growth right now?",
      "Where does BooksForTopics go from here?",
    ],
  },
  {
    personName: "Bridie Rimmer",
    personRole: "Founder, Luxe Rebel Leather Co",
    company: "Luxe Rebel Leather Co",
    companyDomain: "luxerebelleatherco.com",
    genericEmail: "info@luxerebelleatherco.com",
    newsHook:
      "Building a handmade leather brand where every piece is made to a customer's own brief, and being named in this year's f:Entrepreneur 100, is a story our readers would want to hear.",
    questions: [
      "Everything is handmade and bespoke, which is the opposite of how most brands scale. How do you grow without losing that?",
      "What does a genuinely custom piece cost to make properly, and how do you have that conversation?",
      "Leather is a material with a difficult reputation right now. How do you address that with customers?",
      "What was the point at which this became a business rather than a craft?",
      "Where do your customers actually find you?",
      "What is the most common thing a customer asks for that you talk them out of?",
      "Where does Luxe Rebel go from here?",
    ],
  },
  {
    personName: "Amy Jackson",
    personRole: "Founder, AJ Illustration",
    company: "AJ Illustration",
    companyDomain: "ajillustration.co.uk",
    genericEmail: "info@ajillustration.co.uk",
    newsHook:
      "Building a Swansea art business on intricate dotwork, across prints, stickers and apparel, and being named in this year's f:Entrepreneur 100, is exactly the kind of story our readers want more of.",
    questions: [
      "Dotwork is enormously slow to produce. How do you price work that takes that long?",
      "You sell prints, stickers and apparel from the same drawings. Which actually pays?",
      "AI image tools have upended illustration. What has that meant for you commercially?",
      "Swansea rather than a big city. What has that cost you and what has it given you?",
      "What was the moment this became a business rather than commissions?",
      "What do people misunderstand about making a living from art?",
      "Where does AJ Illustration go from here?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
const { creds } = await siteCredentials(site.id);
const setting = async (key) => (await prisma.engineSetting.findFirst({ where: { siteId: site.id, key } }))?.value || null;
const titleDescriptor = await setting("interview_title_descriptor");
const franchise = (await setting("interview_franchise")) || "SME Leaders";

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
      companyDomain: p.companyDomain, newsHook: p.newsHook, hookUrl: HOOK_URL,
      questions: p.questions.join("\n"), status: "pending",
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
console.log(`\ndone. ${SEND ? `sent=${sent}` : `queued=${PEOPLE.length - skipped}`} skipped=${skipped} failed=${failed}`);
await prisma.$disconnect();
