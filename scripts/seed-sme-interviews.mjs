// Seed the SME Leaders trial and send the pre-asks.
//
// Every person below was verified against the company's own website or
// Companies House before being written here, and every address written here is
// one a human published. Those published addresses are the FALLBACK: at send
// time the resolver probes for a real personal mailbox first and only drops
// back to these when the domain is catch-all. Run with --send to send,
// otherwise it seeds and prints what it would do.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendPreAsk, resolveAddress } from "../lib/interviews.js";
import { verifyEmail } from "../lib/prospects.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const SLUG = "smart-sme";

// hook: reads directly after "we'd like the next one to be you." so it must be
// a complete sentence naming something real and recent about them.
const PEOPLE = [
  {
    personName: "Dr Mark Owen Williams",
    personRole: "Founder and CEO, Limb-art",
    company: "Limb-art",
    companyDomain: "limb-art.com",
    publishedEmail: "info@limb-art.com",
    newsHook:
      "Being appointed OBE for services to prosthetics in January, for a business you and Rachael started in a village in Conwy, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "Limb-art started because you wanted a cover for your own prosthetic leg. When did you realise it was a business rather than a personal project?",
      "You are in a village in North Wales rather than a city. What has that cost you, and what has it given you?",
      "What did the OBE change, practically, about how people deal with you?",
      "You and Rachael are a couple running a company together. What is the rule that keeps that workable?",
      "Prosthetics is a regulated, medical-adjacent market. What surprised you most about selling into it?",
      "What is the most expensive mistake you made in the early years?",
      "What is next for Limb-art?",
    ],
  },
  {
    personName: "Pip Murray",
    personRole: "Founder and CEO, Pip & Nut",
    company: "Pip & Nut",
    companyDomain: "pipandnut.com",
    publishedEmail: "pr@pipandnut.com",
    newsHook:
      "Taking Pip & Nut from a market stall in 2013 to one of the best known challenger brands on the shelf is a story our readers would genuinely learn from.",
    questions: [
      "You started Pip & Nut with a market stall and a stint on a friend's sofa. What was the first moment it felt like a real company?",
      "Getting into the big grocers is the thing most food founders are chasing. What actually got you through the door?",
      "You have raised money more than once. What do you know now about investors that you wish you had known at the first round?",
      "The nut butter aisle looked crowded even in 2015. How did you decide there was room?",
      "What is the hardest part of running a food brand right now that people outside the industry would not guess?",
      "What is the piece of advice you were given early that turned out to be wrong?",
      "Where does Pip & Nut go from here?",
    ],
  },
  {
    personName: "Ros Heathcote",
    personRole: "Founder, Borough Broth Co",
    company: "Borough Broth Co",
    companyDomain: "boroughbroth.co.uk",
    publishedEmail: "hello@boroughbroth.co.uk",
    newsHook:
      "Securing 7.5 million from Piper for a business you started making broth in your own kitchen in 2015 is a decade of work our readers would want to hear about properly.",
    questions: [
      "You started Borough Broth in your kitchen in 2015. What was the point at which you stopped cooking and started manufacturing?",
      "Bone broth was close to unknown in the UK when you began. How much of the first few years was spent explaining the product rather than selling it?",
      "You have just taken significant investment. What made you decide the time was right?",
      "Organic and B Corp both cost money and slow you down. Why hold onto them?",
      "What is the least glamorous part of running a food business that nobody warns you about?",
      "Is there a decision from the early years you would reverse?",
      "What does the next five years look like?",
    ],
  },
  {
    personName: "Mike Bagshaw",
    personRole: "Founder and Managing Director, I.T.S",
    company: "I.T.S (International Taste Solutions)",
    companyDomain: "itstaste.com",
    publishedEmail: "info@itstaste.com",
    newsHook:
      "Putting 10 million into the new Hungerford site, sixteen years after starting I.T.S at a kitchen table, is a serious bet and our readers would want to understand the thinking behind it.",
    questions: [
      "I.T.S began at a kitchen table in 2009. What was the first order that made it feel viable?",
      "The new site gives you twenty times the production capacity. What has to be true for that to pay off?",
      "Flavour houses are dominated by very large multinationals. How does a 40 person business compete with them?",
      "What do your customers ask for now that they never asked for five years ago?",
      "You have grown without becoming a household name. Has staying under the radar helped or hurt?",
      "What is the hardest hire you have ever had to make?",
      "What is the ambition for the next ten years?",
    ],
  },
  {
    personName: "Wade Lyn CBE",
    personRole: "Founder and Managing Director, Cleone Foods",
    company: "Cleone Foods (Island Delight)",
    companyDomain: "cleone.co.uk",
    publishedEmail: "Contact@cleone.co.uk",
    newsHook:
      "Building Island Delight from 1988 into one of the best known Caribbean food brands in Britain, and a CBE along the way, is a story of the kind of business our readers admire most.",
    questions: [
      "You founded Cleone Foods in 1988. What did the market for Caribbean food in Britain look like then compared to now?",
      "Island Delight is in the major supermarkets. What did it take to get a patty onto those shelves?",
      "You have talked about the difficulty Black-owned businesses face raising finance. Has that changed in nearly forty years?",
      "What is the single decision that did most to grow the business?",
      "You have served as High Sheriff of the West Midlands. How does public service sit alongside running a factory?",
      "What advice would you give a food entrepreneur starting in Birmingham today?",
      "What happens to Cleone Foods next?",
    ],
  },
  {
    personName: "Tomasz Dyl",
    personRole: "Founder and Managing Director, GottaBe!",
    company: "GottaBe!",
    companyDomain: "gottabemarketing.co.uk",
    publishedEmail: "hello@gottabemarketing.co.uk",
    newsHook:
      "Starting an agency at seventeen, four years after arriving from Poland and in the middle of the 2008 crash, and then winning the national Diversity and Inclusion award this year, is a story our readers would genuinely want to read.",
    questions: [
      "You started GottaBe! at seventeen, during a financial crisis, having moved to the UK four years earlier. What made you think that was a good idea?",
      "Multicultural marketing was a niche in 2008. When did the big brands start taking it seriously?",
      "What do most British companies still get wrong when they try to reach multicultural audiences?",
      "You went through Goldman Sachs 10,000 Small Businesses. What did it actually change?",
      "Going from one person to twelve is the hardest stretch for most agencies. What broke along the way?",
      "What is the piece of business advice you would give your seventeen year old self?",
      "Where do you want GottaBe! to be in five years?",
    ],
  },
  {
    personName: "Andy Evangelou",
    personRole: "Co-founder and Managing Director, Plug In Stations",
    company: "Plug In Stations",
    companyDomain: "plugin-stations.com",
    publishedEmail: "enquiries@plugin-stations.com",
    newsHook:
      "Starting in a shed in 2020 with two friends and no funding, and taking third place and 50,000 at the Stelios Young Entrepreneur Awards, is the kind of story our readers want more of.",
    questions: [
      "Plug In Stations started in Natalya's shed with three founders and no funding. How did you divide the work at the beginning?",
      "EV charging has had a turbulent few years. What has that felt like from inside a young company?",
      "What is the most common misunderstanding customers have about installing a charger?",
      "Three founders is unusual and often unstable. What keeps it working?",
      "What did the Stelios award change for the business?",
      "What is the biggest constraint on your growth right now?",
      "Where do you want to be in three years?",
    ],
  },
  {
    personName: "Jonathan Sanderson",
    personRole: "Founder and Managing Director, Corecom Consulting",
    company: "Corecom Consulting",
    companyDomain: "corecomconsulting.co.uk",
    publishedEmail: "j.sanderson@corecomconsulting.co.uk",
    newsHook:
      "Building Corecom in Leeds since 2008 and then setting up the Tech Academy with the aim of putting a thousand people into work is a use of a recruitment business our readers would find genuinely interesting.",
    questions: [
      "You founded Corecom in 2008, into a recession. What did that teach you that has stuck?",
      "The Tech Academy is a separate venture with a social mobility mission. Why build it rather than just recruit harder?",
      "A thousand people into work over three years is a big number. What is the bottleneck?",
      "Tech recruitment has been through a brutal couple of years. How has that changed your business?",
      "What do employers get wrong when they hire junior technical staff?",
      "What is the hardest thing about growing a business in Leeds rather than London?",
      "What is next for Corecom?",
    ],
  },
  {
    personName: "Oli and Emily Arnold",
    personRole: "Co-founders, Vanlife Conversions",
    company: "Vanlife Conversions",
    companyDomain: "vanlifeconversions.co.uk",
    publishedEmail: "contact@vanlifeconversions.co.uk",
    newsHook:
      "An Army captain and an NHS doctor converting their own van and turning it into an award winning business, with the national Service Excellence award this year, is a story our readers would love.",
    questions: [
      "You converted your own van, Archie, for a trip round Europe. At what point did that become a company?",
      "One of you came from the Army and one from the NHS. What did each of those bring to running a business?",
      "You won the national Service Excellence award this year. What do you do differently from other converters?",
      "Working together as a married couple is not easy. What is the rule that makes it work?",
      "You are in rural Essex and took Rural England Prosperity Fund money. How much does location shape the business?",
      "What is the most common thing customers ask for that you talk them out of?",
      "What does the next stage look like?",
    ],
  },
  {
    personName: "Matt Kennedy",
    personRole: "Founder and CEO, Fussy",
    company: "Fussy",
    companyDomain: "getfussy.com",
    publishedEmail: "hi@getfussy.com",
    newsHook:
      "Building a refillable deodorant brand into a B Corp with serious scale, having launched it in 2020 and taken it through Dragons' Den, is a story our readers would learn a lot from.",
    questions: [
      "Refillable deodorant is a hard sell against a 2 pound aerosol. How did you get the first customers?",
      "Dragons' Den is a strange experience for a founder. What did it actually do for the business?",
      "B Corp certification is a lot of work. Was it worth it commercially, or was it a principle?",
      "You launched in 2020. How much did the timing help or hurt?",
      "What is the hardest part of a subscription model that people underestimate?",
      "What have you had to stop doing in order to grow?",
      "Where does Fussy go next?",
    ],
  },
  {
    personName: "Ross Evans and Ashley Weight",
    personRole: "Co-founders, ShuttersUp",
    company: "ShuttersUp",
    companyDomain: "shuttersup.co.uk",
    publishedEmail: "info@shuttersup.co.uk",
    newsHook:
      "Two school friends starting in a nan's garage in 2006, working Underground night shifts to fund it, and now running a 50 plus person business shortlisted at the British Business Excellence Awards, is exactly the kind of story our readers want.",
    questions: [
      "You started in Ashley's nan's garage in 2006 while working nights on the Underground. How long before you could stop doing both?",
      "Shutters are a considered purchase in a market full of small fitters. How did you build something bigger than that?",
      "Fifty plus staff is the point where most trade businesses stall. What changed in how you ran it?",
      "You have been friends since school. Has that ever made a business decision harder?",
      "What do customers not understand about what shutters actually cost to make well?",
      "You are targeting 10 million by 2028. What has to happen?",
      "What is the ambition beyond that?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.log(`No site ${SLUG}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);

console.log(`Site      : ${site.name}`);
console.log(`Sending as: ${creds?.outreach?.fromEmail || "(not configured)"}`);
console.log(`Mode      : ${SEND ? "SEND" : "dry run"}`);
console.log(`People    : ${PEOPLE.length}\n`);

const opts = {
  outreach: creds?.outreach,
  titleName: "Smart SME",
  franchise: "SME Leaders",
  siteUrl: "smartsme.co.uk",
  senderName: creds?.outreach?.fromName || "James Burke",
  // Probe each candidate mailbox before writing to it. Without this the
  // resolver falls straight through to the published address, which is safe
  // but never finds the founder directly.
  verify: verifyEmail,
};

let sent = 0, failed = 0;
for (const p of PEOPLE) {
  // Seeding and sending are two decisions, not one. A row that already exists
  // is only skipped if it has moved past "pending": a dry run seeds the queue,
  // and the send pass afterwards has to be able to pick that same queue up
  // rather than treating its own earlier work as a duplicate.
  const existing = await prisma.interviewTarget.findFirst({
    where: { siteId: site.id, personName: p.personName },
  });
  if (existing && existing.status !== "pending") {
    console.log(`skip (${existing.status}): ${p.personName}`);
    continue;
  }

  const row =
    existing ||
    (await prisma.interviewTarget.create({
      data: {
        siteId: site.id,
        personName: p.personName,
        personRole: p.personRole,
        company: p.company,
        companyDomain: p.companyDomain,
        newsHook: p.newsHook,
        questions: p.questions.join("\n"),
        status: "pending",
      },
    }));

  // Resolve even on a dry run. It costs a few verifier credits, but printing
  // the published fallback while a real send would reach a personal mailbox
  // would make the dry run actively misleading.
  if (!SEND) {
    const pick = await resolveAddress({ ...row, publishedEmail: p.publishedEmail }, { verify: verifyEmail });
    console.log(`would send -> ${pick?.email || "(nowhere)"}  [${pick?.source || "none"}]  (${p.personName})`);
    continue;
  }

  // publishedEmail is passed alongside the row so nextAddress() prefers the
  // address a human actually published over anything it could infer.
  const res = await sendPreAsk(prisma, { ...row, publishedEmail: p.publishedEmail }, opts);
  if (res.sent) { sent++; console.log(`sent -> ${res.email}  (${p.personName})`); }
  else { failed++; console.log(`FAILED (${res.reason}) ${p.personName}: ${res.error || ""}`); }
}

console.log(`\ndone. sent=${sent} failed=${failed}`);
await prisma.$disconnect();
