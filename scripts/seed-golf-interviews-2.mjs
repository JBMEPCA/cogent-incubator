// Golf Resort Leader, batch two. Sourced with scripts/find-people.mjs rather
// than by searching: the prospector reads a company's own team page for names
// and its contact page for the inbox, both from the same domain. Twenty four
// turf and golf supplier domains produced these three complete pairs.
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const PEOPLE = [
  {
    personName: "Richard Campey",
    personRole: "Founder and Managing Director, Campey Turf Care Systems",
    company: "Campey Turf Care Systems",
    companyDomain: "campeyturfcare.com",
    genericEmail: "info@campeyturfcare.com",
    hookUrl: "https://campey40.com/",
    newsHook:
      "Forty years of a turf machinery business you founded in Cheshire in 1986, still in your name, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "You started in 1986. What did groundsmen and greenkeepers want then that they no longer ask for?",
      "Campey imports and distributes as well as innovating. How do you decide which to do?",
      "What is the machine you are proudest of introducing to the UK, and why did it take convincing?",
      "Turf machinery is a considered purchase on a tight budget. How do you have the money conversation honestly?",
      "Forty years in, what has actually changed about how a course specifies equipment?",
      "What is the most expensive mistake you made along the way?",
      "What happens to Campey next?",
    ],
  },
  {
    personName: "Paul Dawson",
    personRole: "Managing Director, Rolawn",
    company: "Rolawn",
    companyDomain: "rolawn.co.uk",
    genericEmail: "info@rolawn.co.uk",
    hookUrl: "https://www.rolawn.co.uk/",
    newsHook:
      "Running one of Britain's largest turf growers as a family business, in a trade where most of the value is decided by weather you cannot control, is a story our readers would genuinely learn from.",
    questions: [
      "Turf is a crop with a delivery window measured in hours. How does that shape the whole operation?",
      "It is a family business across generations. What is the rule that keeps that workable?",
      "How much of a year's result is weather, and what can you actually do about the rest?",
      "What do landscapers and course managers most often get wrong when they order turf?",
      "Sustainability claims in growing media and turf are hard for a buyer to check. How should they?",
      "What is the biggest constraint on the business right now?",
      "Where does Rolawn go from here?",
    ],
  },
  {
    personName: "Kieran Ellis",
    personRole: "Production and Estates Manager, Tillers Turf",
    company: "Tillers Turf",
    companyDomain: "tillersturf.co.uk",
    genericEmail: "sales@tillersturf.co.uk",
    hookUrl: "https://www.tillersturf.co.uk/",
    newsHook:
      "Running production and estates for a turf grower supplying sports surfaces, where the crop has to be perfect on a date set months earlier, is exactly the kind of story our readers want more of.",
    questions: [
      "You are responsible for a crop that has to be ready on a fixed date. How far ahead does planning actually start?",
      "What separates turf destined for a golf course from turf destined for a garden?",
      "Which part of the growing year worries you most?",
      "What has changed most in turf production in the last decade?",
      "What do buyers underestimate about what happens before a roll reaches them?",
      "What is the hardest part of the job that nobody outside it sees?",
      "Where do you want to take production next?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: "golf-resort-magazine" } });
const { creds } = await siteCredentials(site.id);
const setting = async (k) => (await prisma.engineSetting.findFirst({ where: { siteId: site.id, key: k } }))?.value || null;
const titleDescriptor = await setting("interview_title_descriptor");
const elsewhere = await prisma.interviewTarget.findMany({ where: { siteId: { not: site.id } }, select: { personName: true, companyDomain: true } });
const taken = new Set(elsewhere.map((r) => (r.companyDomain || "").toLowerCase()));

const opts = { outreach: creds?.outreach, titleName: site.name, titleDescriptor, siteUrl: siteUrl(site), senderName: creds?.outreach?.fromName || "James Burke", hunt: huntContact };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let sent = 0;
for (const p of PEOPLE) {
  if (taken.has(p.companyDomain.toLowerCase())) { console.log(`SKIP ${p.personName}`); continue; }
  const existing = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, personName: p.personName } });
  if (existing && existing.status !== "pending") { console.log(`skip (${existing.status}) ${p.personName}`); continue; }
  const row = existing || (await prisma.interviewTarget.create({ data: {
    siteId: site.id, personName: p.personName, personRole: p.personRole, company: p.company,
    companyDomain: p.companyDomain, newsHook: p.newsHook, hookUrl: p.hookUrl,
    questions: p.questions.join("\n"), status: "pending" } }));
  const t = { ...row, genericEmail: p.genericEmail };
  if (!SEND) { const pick = await resolveAddress(t, { hunt: huntContact }); console.log(`would send -> ${pick?.email} [${pick?.source}] ${p.personName}`); continue; }
  const res = await sendQuestionsUpFront(prisma, t, opts);
  console.log(res.sent ? `sent -> ${res.email.padEnd(30)} ${p.personName}` : `FAILED (${res.reason}) ${p.personName}`);
  if (res.sent) sent++;
  await wait(30000 + Math.floor(Math.random() * 30000));
}
console.log(`\ndone. sent=${sent}`);
await prisma.$disconnect();
