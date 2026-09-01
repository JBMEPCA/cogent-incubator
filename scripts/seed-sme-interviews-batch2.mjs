// SME Leaders, batch two. Twenty people, sourced the same way as batch one:
// find the news first, then the person it belongs to.
//
// What is different from batch one is where the mail goes. Every address in
// batch one resolved to a shared inbox, because that send ran before the
// verifier was wired into resolveAddress and because addressCandidates() split
// names on whitespace, so "Dr Mark Owen Williams" asked for dr@ and the probe
// never stood a chance. Both are fixed. Probed on 26 Aug 2026, fifteen of these
// twenty have a personal mailbox MillionVerifier confirms exists. The other
// five sit on catch-all domains, where the answer is genuinely unknowable, and
// they get the inbox their own website publishes with a pass-it-on line at the
// top.
//
// Run with --send to send, otherwise it seeds and prints what it would do.
// --limit=N stops after N people.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendPreAsk, resolveAddress } from "../lib/interviews.js";
import { verifyEmail } from "../lib/prospects.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const SLUG = "smart-sme";

// hook: reads directly after "and I'd like the next one to be you." so it has
// to be a complete sentence naming something real and recent about them.
// genericEmail is the fallback for a catch-all domain, and is only ever an
// address the company publishes on its own site.
const PEOPLE = [
  {
    personName: "Emma Heathcote-James",
    personRole: "Founder and CEO, Little Soap Company",
    company: "Little Soap Company",
    companyDomain: "littlesoapcompany.co.uk",
    genericEmail: "info@littlesoapcompany.co.uk",
    hookUrl: "https://bmmagazine.co.uk/in-business/kings-awards-enterprise-2026-sme-winners-60th-anniversary/",
    newsHook:
      "Taking a business you started hand-making soap at a Cotswold kitchen table in 2008 all the way to a King's Award for Enterprise in the scheme's sixtieth year is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "You started at a kitchen table in 2008 because you could not find natural soap on a supermarket shelf. When did it stop being a personal frustration and start being a company?",
      "Getting a small brand into the big grocers is the thing most founders are chasing. What actually got you through the door?",
      "You manufacture in Scotland and northern England rather than offshore. What has that cost you, and what has it given you?",
      "You have been vocal about principles over margin. Has that ever cost you a contract you wanted?",
      "The King's Award takes real work to apply for. What changed after you won it?",
      "What is the most expensive mistake you made in the early years?",
      "What is next for Little Soap Company?",
    ],
  },
  {
    personName: "Dr Minshad Ansari",
    personRole: "Founder and CEO, Bionema Group",
    company: "Bionema Group",
    companyDomain: "bionema.com",
    genericEmail: "info@bionema.com",
    hookUrl: "https://www.smeweb.com/kings-awards-for-enterprise-recognise-186-businesses-in-60th-year-the-full-list-of-winners/",
    newsHook:
      "Building a biopesticide company out of Swansea University since 2012 and taking it to a King's Award for Enterprise is a story our readers would genuinely learn from.",
    questions: [
      "You were an academic at Swansea before you were a founder. What was the moment you decided the research had to become a business?",
      "Biological pest control was a hard sell when you started in 2012. Has the argument got easier, or just louder?",
      "You raised grant funding and equity in the same period. What do you know now about each that you wish you had known then?",
      "NemaTrident took years of development before it earned anything. How did you fund the patience?",
      "You are in Wales rather than a life sciences cluster. How much does location shape a science business?",
      "What is the hardest hire you have ever had to make?",
      "Where does Bionema go from here?",
    ],
  },
  {
    personName: "Mitchell Barnes",
    personRole: "Founder and CEO, RYSE 3D",
    company: "RYSE 3D",
    companyDomain: "ryse3d.com",
    hookUrl: "https://www.tctmagazine.com/ryse-3d-ceo-mitchell-barnes-wins-second-kings-award/",
    newsHook:
      "Starting RYSE 3D in your early twenties and becoming the first to hold two King's Awards in three years, from a unit in Shipston-on-Stour, is exactly the kind of story our readers want more of.",
    questions: [
      "You started developing a 3D printer as an undergraduate. At what point did that become a company rather than a project?",
      "You build this with your brother Cameron. What is the rule that keeps working with family workable?",
      "Twenty three hypercar programmes is a very particular customer base. How did you win the first one?",
      "Nearly half your turnover is now export. What did you have to change to sell into the US and Europe?",
      "Two King's Awards in three years is a UK first. What has it actually changed about how customers deal with you?",
      "What is the biggest constraint on your growth right now?",
      "Where do you want RYSE 3D to be in five years?",
    ],
  },
  {
    personName: "Jenny Holloway",
    personRole: "Founder and CEO, Fashion-Enter",
    company: "Fashion-Enter",
    companyDomain: "fashion-enter.com",
    genericEmail: "info@fashion-enter.com",
    hookUrl: "https://www.fashioncapital.co.uk/insights/fel-receives-kings-award-for-enterprise-at-st-jamess-palace/",
    newsHook:
      "Being told by the King at St James's Palace in July that you are fashion sustainability, after years of arguing that clothes can still be made properly in Britain, is a story our readers would want to hear properly.",
    questions: [
      "You have spent years arguing that UK garment manufacturing is viable. What is the argument you are still having with people?",
      "The ethical micro-factory model is slower and lower volume by design. How do you make the numbers work?",
      "You run apprenticeships alongside production. Does the training pay for itself, or is it something you subsidise?",
      "What do brands most misunderstand about what a garment actually costs to make well?",
      "Leicester Made and Regions came out of a difficult period for the industry. What has genuinely changed there?",
      "What is the hardest thing about growing a manufacturing business in London?",
      "What is next for Fashion-Enter?",
    ],
  },
  {
    personName: "Cheryl Hadland",
    personRole: "Founder and Managing Director, Tops Day Nurseries",
    company: "Tops Day Nurseries",
    companyDomain: "topsdaynurseries.co.uk",
    genericEmail: "enquiries@topsdaynurseries.co.uk",
    hookUrl: "https://kingsawards.blog.gov.uk/2026/06/12/tops-day-nurseries-receives-kings-award-for-enterprise-in-sustainability/",
    newsHook:
      "A second King's Award for sustainability, having built more than thirty nurseries into the first large group to operate at net zero, is a decade of work our readers would want to understand.",
    questions: [
      "Childcare runs on very thin margins. How do you fund sustainability work in a sector like that?",
      "You were the first large nursery group where every setting hit a Green Flag. Which setting was hardest to bring with you?",
      "Parents say they care about sustainability. Do they actually choose a nursery on it?",
      "You have written and campaigned as well as run the business. Has the campaigning ever made the operating harder?",
      "What is the least glamorous part of running thirty plus nurseries that nobody warns you about?",
      "Is there a decision from the early years you would reverse?",
      "What does the next five years look like for Tops?",
    ],
  },
  {
    personName: "Angela Morris",
    personRole: "Founder, Woolcool",
    company: "Woolcool",
    companyDomain: "woolcool.com",
    genericEmail: "sales@woolcool.com",
    hookUrl: "https://www.woolcool.com/2026/05/06/woolcool-kings-award/",
    newsHook:
      "A third King's Award, this one for international trade, for a wool packaging idea you had back in 2001, is exactly the kind of long game our readers want to read about.",
    questions: [
      "The idea started as a packaging consultant's design concept in 2001. How long was it before anyone would buy it?",
      "Wool against polystyrene is a price argument you were always going to lose on the invoice. How do you win it anyway?",
      "Food, pharmaceutical and life sciences are three very different customers. Which was hardest to get right?",
      "This is your third King's Award across three categories. Does the third one still change anything?",
      "You are in Stone rather than near a port or a city. What has that cost and what has it given you?",
      "What is the most common thing a new customer asks for that you talk them out of?",
      "Where does Woolcool go from here?",
    ],
  },
  {
    personName: "Sean Scott",
    personRole: "Founder, Vuba",
    company: "Vuba",
    companyDomain: "vubagroup.com",
    hookUrl: "https://www.insidermedia.com/news/yorkshire/yorkshire-winners-of-2026-kings-awards-revealed-a-great-honour-and-an-incredibly-proud-moment",
    newsHook:
      "Starting Vuba in 2009 in the middle of the financial crisis and taking it to King's Awards in two consecutive years is a story our readers would genuinely learn from.",
    questions: [
      "You started in 2009, straight out of installing resin flooring yourself, into the worst market in decades. What made you think that was the moment?",
      "Vuba manufactures its own chemistry rather than buying it in. When did you decide that was worth the capital?",
      "Easihold put you in front of a consumer audience. What did that do to the rest of the business?",
      "You have won for innovation and then for international trade in consecutive years. Which was harder?",
      "Hull and Beverley are not where anyone would expect a world leader in resin surfacing. Has that helped or hurt?",
      "What is the most expensive mistake you made on the way up?",
      "What is the ambition for the next five years?",
    ],
  },
  {
    personName: "Dr Paul Taylor",
    personRole: "Founder, Laser Wire Solutions",
    company: "Laser Wire Solutions",
    companyDomain: "laserwiresolutions.com",
    genericEmail: "sales@laserwiresolutions.com",
    hookUrl: "https://www.laserwiresolutions.com/laser-wire-solutions-awarded-kings-award-for-enterprise-in-international-trade/",
    newsHook:
      "Building a laser processing business in Pontypridd since 2011 into an exporter with people in the US, Mexico and Costa Rica, with a King's Award to go with it, is a story our readers would want to hear.",
    questions: [
      "You founded the company in 2011 around a very specific problem, stripping wire with light. Who was the first customer who believed it?",
      "Medical, aerospace, automotive and data centres all buy from you. Which of those taught you the most?",
      "Most of your machines go overseas. What did you get wrong about exporting before you got it right?",
      "You have grown to nearly sixty people, most of them in South Wales. How hard is it to hire that skill set there?",
      "What do customers underestimate about what a bespoke laser system actually takes to build?",
      "What is the biggest constraint on your growth right now?",
      "Where do you want the business to be in five years?",
    ],
  },
  {
    personName: "Jamie Sobrany",
    personRole: "Co-founder and CEO, Linnk Group",
    company: "Linnk Group",
    companyDomain: "linnk.com",
    hookUrl: "https://bmmagazine.co.uk/in-business/kings-awards-enterprise-2026-sme-winners-60th-anniversary/",
    newsHook:
      "Taking a STEM staffing business into Qatar, Saudi Arabia, India and the UAE in seven years, with a King's Award for international trade to show for it, is exactly the kind of story our readers want more of.",
    questions: [
      "You had thirty years in the industry before Linnk. What did you want to do differently that you could not do elsewhere?",
      "The Gulf is a very different market to the UK. What did you have to unlearn?",
      "Staffing is a people business with thin loyalty in both directions. How do you keep good recruiters?",
      "Which of your markets has been the hardest to make work, and why?",
      "What do UK clients most misunderstand about hiring STEM talent internationally?",
      "The King's Award is a trade award. Has it opened doors, or is it mostly internal pride?",
      "Where does Linnk go from here?",
    ],
  },
  {
    personName: "Jarrod Hunt",
    personRole: "Founder and Managing Director, Continuous Process Solutions",
    company: "Continuous Process Solutions",
    companyDomain: "cpsuk.co",
    publishedEmail: "jarrod@cpsuk.co",
    hookUrl: "https://rubberworld.com/continuous-process-solutions-founder-named-as-finalist-in-the-great-british-entrepreneur-awards/",
    newsHook:
      "Being shortlisted as Family Business Entrepreneur of the Year at this year's Great British Entrepreneur Awards, having just moved the business into a historic Shropshire site, is a story our readers would find genuinely interesting.",
    questions: [
      "Steel conveyor belts are not a business most people fall into. How did you end up specialising in them?",
      "You run the company as a family business. What is the rule that keeps that workable?",
      "Moving to Calcutts House in Jackfield is a serious commitment to a place. What was the thinking?",
      "Your customers run continuous processes where a stoppage is expensive. How does that shape the way you have to work?",
      "You are making your PPMA Show debut. What are you hoping to get out of it that you cannot get any other way?",
      "What is the hardest part of growing a specialist engineering business that people outside it would not guess?",
      "What is next for CPS?",
    ],
  },
  {
    personName: "Chris Tattersall",
    personRole: "Managing Director, Woolroom",
    company: "Woolroom",
    companyDomain: "thewoolroom.com",
    hookUrl: "https://bedtimesmagazine.com/2026/05/woolroom-wins-kings-award-for-enterprise-following-record-overseas-growth/",
    newsHook:
      "Growing overseas sales by more than 130 per cent in three years from Rutland, with a second royal award for international trade to show for it, is a story our readers would want to understand properly.",
    questions: [
      "Wool bedding is a category most people have never considered. How much of your job is still explaining the product rather than selling it?",
      "North America now drives your growth. What did you get wrong about that market before you got it right?",
      "You built distribution hubs and an in-market team rather than shipping from Rutland. When did you decide that was necessary?",
      "This is the second royal award for international trade. What did the first one change, honestly?",
      "British wool has had a difficult few decades. What would actually help the farmers you buy from?",
      "What is the least glamorous part of running this business that nobody warns you about?",
      "What does the next five years look like?",
    ],
  },
  {
    personName: "Stuart Burns",
    personRole: "Managing Director, Dura Composites",
    company: "Dura Composites",
    companyDomain: "duracomposites.com",
    hookUrl: "https://www.duracomposites.com/royal-recognition-for-dura-in-triple-crown-success/",
    newsHook:
      "A fourth King's Award, this time for sustainability, for a Clacton business turning recovered composite back into new product, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "You came to Dura from a decade of commercial roles at Heinz. What did that teach you that applies to composites?",
      "Closed loop recycling of glass reinforced polymer was considered close to impossible. What made you take it on?",
      "Rail and infrastructure buyers are famously slow to change materials. How do you shift a specification?",
      "Four King's Awards across three categories is unusual. Which one meant the most and why?",
      "Clacton-on-Sea is not an obvious manufacturing base. What has that cost you and what has it given you?",
      "What is the hardest hire you have had to make?",
      "Where does Dura go from here?",
    ],
  },
  {
    personName: "James and Lyle Metcalfe",
    personRole: "Co-founders, VOLT",
    company: "VOLT",
    companyDomain: "voltbikes.co.uk",
    hookUrl: "https://www.business.hsbc.uk/en-gb/insights/growing-a-business/sbgp-winners-2026",
    newsHook:
      "Winning the Family Business Award at this year's Small Business Growth Awards, having brought your e-bike manufacturing back from overseas to Milton Keynes, is a story our readers would love.",
    questions: [
      "You launched in 2010, when people thought you were mad. What was the first year actually like?",
      "Bringing manufacturing back to the UK runs against everything the industry did for twenty years. What made the numbers work?",
      "Two brothers running a company together is easy to romanticise. What is the rule that makes it work?",
      "The e-bike market has had a brutal shakeout. What has that felt like from inside the business?",
      "You sell through more than a hundred dealers as well as your own showroom. How do you keep both happy?",
      "What do customers still get wrong about buying an electric bike?",
      "What is the ambition for the next five years?",
    ],
  },
  {
    personName: "Tim Overfield",
    personRole: "Founder and Chairman, C-Kore Systems",
    company: "C-Kore Systems",
    companyDomain: "c-kore.com",
    hookUrl: "https://oceannews.com/news/milestones/c-kore-systems-honored-with-another-kings-award-for-enterprise",
    newsHook:
      "Another King's Award for a York business whose subsea test tools save operators days of vessel time is exactly the kind of story our readers want more of.",
    questions: [
      "Subsea testing used to mean a vessel, a crew and a lot of waiting. What did you see that the incumbents did not?",
      "Offshore energy customers are conservative buyers. How long did it take to get the first one to trust the tool?",
      "You are in York, a long way from the North Sea supply chain. Has that helped or hurt?",
      "The industry has swung between oil and gas and offshore wind. How do you plan through that?",
      "This is not your first King's Award. What has it done for you commercially?",
      "What is the biggest constraint on your growth right now?",
      "Where does C-Kore go from here?",
    ],
  },
  {
    personName: "Elaine Brown",
    personRole: "Chief Executive, Edinburgh Remakery",
    company: "Edinburgh Remakery",
    companyDomain: "edinburghremakery.org.uk",
    genericEmail: "hello@edinburghremakery.org.uk",
    hookUrl: "https://bmmagazine.co.uk/in-business/kings-awards-enterprise-2026-sme-winners-60th-anniversary/",
    newsHook:
      "A King's Award for Enterprise for a ten-person social enterprise keeping technology out of landfill in Edinburgh is a story our readers would genuinely learn from.",
    questions: [
      "A social enterprise has to trade as well as do good. Which of those is harder on a bad month?",
      "Refurbished technology still carries a stigma for a lot of buyers. What actually shifts that?",
      "You are ten people doing work large companies claim they cannot make pay. How?",
      "Digital inclusion and waste reduction pull in slightly different directions. How do you decide between them?",
      "What did the King's Award change, practically, about how people deal with you?",
      "What is the most common misunderstanding about what you do?",
      "What does the next five years look like?",
    ],
  },
  {
    personName: "Sam Malins",
    personRole: "Founder and CEO, Reacton Fire Suppression",
    company: "Reacton Fire Suppression",
    companyDomain: "reactonfire.com",
    genericEmail: "info@reactonfire.com",
    hookUrl: "https://www.reactonfire.com/news/kings-award-for-enterprise-innovation-2026",
    newsHook:
      "Taking on a small start-up in 2010 and building it into a business protecting assets worth billions worldwide, with a King's Award for innovation this year, is a story our readers would want to hear.",
    questions: [
      "You took on a small start-up in 2010 rather than starting from nothing. What did you see in it?",
      "Dual agent suppression took real development. How did you fund that while running the day job?",
      "You manufacture in the UK and sell through distributors in the Americas and the Middle East. What is hardest about that model?",
      "Fire suppression only proves its value on the worst day. How do you sell something people hope never works?",
      "What did the King's Award change, practically, about how customers deal with you?",
      "What is the hardest hire you have had to make?",
      "Where does Reacton go from here?",
    ],
  },
  {
    personName: "Chris Down",
    personRole: "Founder, OpenWorks Engineering",
    company: "OpenWorks Engineering",
    companyDomain: "openworksengineering.com",
    genericEmail: "info@openworksengineering.com",
    hookUrl: "https://www.insidermedia.com/news/north-east/five-north-east-firms-win-kings-awards-in-60th-anniversary-year",
    newsHook:
      "Building a hundred-person counter-drone engineering business in Prudhoe since 2015, with a King's Award for international trade this year, is exactly the kind of story our readers do not hear often enough.",
    questions: [
      "OpenWorks started in 2015 with a handful of engineers. What was the first contract that made it real?",
      "The drone threat changed faster than almost any market. How do you build product against a moving target?",
      "Selling into defence and security means long procurement cycles. How does a young company survive them?",
      "You have scaled to a hundred people in Prudhoe. How hard has it been to find that engineering talent in the North East?",
      "What do customers most misunderstand about counter drone systems?",
      "What is the biggest constraint on your growth right now?",
      "Where do you want OpenWorks to be in five years?",
    ],
  },
  {
    personName: "Martyn Barklett-Judge",
    personRole: "Managing Director, Pet Remedy",
    company: "Pet Remedy",
    companyDomain: "petremedy.co.uk",
    genericEmail: "info@petremedy.co.uk",
    hookUrl: "https://www.petgazette.biz/256847-pet-remedy-wins-kings-award-for-enterprise/",
    newsHook:
      "A King's Award for innovation for a Devon business making calming products used by vets and rescue centres around the world is a story our readers would find genuinely interesting.",
    questions: [
      "Calming products for animals without sedation is a claim that invites scepticism. How did you get vets to take it seriously?",
      "The range works for mammals, birds and reptiles. How much of the development was trial and error?",
      "You are in Newton Abbot rather than near a big distribution hub. What has that cost and what has it given you?",
      "Rescue organisations cannot pay much. How do you balance that against a commercial business?",
      "What did meeting the King at St James's Palace actually feel like from the inside?",
      "What is the most common misunderstanding pet owners have about stress in animals?",
      "What is next for Pet Remedy?",
    ],
  },
  {
    personName: "Chris Tullett",
    personRole: "Founding Director, CTE Advanced Technologies",
    company: "CTE Advanced Technologies",
    companyDomain: "cte-adv-tech.com",
    genericEmail: "info@cte-adv-tech.com",
    hookUrl: "https://www.smeweb.com/kings-awards-for-enterprise-recognise-186-businesses-in-60th-year-the-full-list-of-winners/",
    newsHook:
      "A King's Award for international trade for an Aylesbury business you started yourself, fabricating thermal insulation for industry, is exactly the kind of story our readers want more of.",
    questions: [
      "The company began as Chris Tullett Exhausts. How did it become an advanced thermal insulation business?",
      "Precision fabrication is a craft as much as a process. How do you train people into it now?",
      "Which export market took the longest to crack, and what finally worked?",
      "You still handle customer relationships yourself. At what size does a founder have to stop doing that?",
      "What do customers underestimate about what a bespoke insulation solution takes to make?",
      "What is the most expensive mistake you made in the early years?",
      "What is the ambition for the next five years?",
    ],
  },
  {
    personName: "David Mitson",
    personRole: "Founder and CEO, evoke Country and Equestrian",
    company: "evoke Country and Equestrian",
    companyDomain: "evoke-group.com",
    genericEmail: "hello@evoke-group.com",
    hookUrl: "https://www.business.hsbc.uk/en-gb/insights/growing-a-business/sbgp-winners-2026",
    newsHook:
      "Founding a helmet brand after a concussion of your own, winning the Start-Up Award at this year's Small Business Growth Awards and then becoming the official helmet of US Equestrian, is a story our readers would love.",
    questions: [
      "The business started with your own fall and a concussion that should have been minor. How long from that to deciding to build helmets?",
      "You launched in spring 2024 with three million behind you. What did that money buy that bootstrapping could not?",
      "Four international safety standards is a very deliberate choice. What does certification actually cost a start-up?",
      "Becoming the official helmet of US Equestrian is a big early win. How did that conversation start?",
      "The replacement scheme is unusual in your industry. Does it pay for itself?",
      "What do riders still get wrong about helmet safety?",
      "Where do you want evoke to be in three years?",
    ],
  },
];

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.log(`No site ${SLUG}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);

const batch = LIMIT ? PEOPLE.slice(0, LIMIT) : PEOPLE;

console.log(`Site      : ${site.name}`);
console.log(`Sending as: ${creds?.outreach?.fromEmail || "(not configured)"}`);
console.log(`Mode      : ${SEND ? "SEND" : "dry run"}`);
console.log(`People    : ${batch.length}\n`);

const opts = {
  outreach: creds?.outreach,
  titleName: "Smart SME",
  franchise: "SME Leaders",
  siteUrl: "smartsme.co.uk",
  senderName: creds?.outreach?.fromName || "James Burke",
  // Probe each candidate mailbox before writing to it. Without this the
  // resolver falls straight through to the shared inbox, which is safe but
  // never finds the person directly. That is what happened to batch one.
  verify: verifyEmail,
};

let sent = 0, failed = 0, personal = 0;
for (const p of batch) {
  // Seeding and sending are two decisions. A row that already exists is only
  // skipped once it has moved past "pending", so a dry run can seed the queue
  // and the send pass afterwards picks that same queue up rather than treating
  // its own earlier work as a duplicate.
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
        hookUrl: p.hookUrl,
        questions: p.questions.join("\n"),
        status: "pending",
      },
    }));

  const withAddresses = { ...row, publishedEmail: p.publishedEmail, genericEmail: p.genericEmail };
  const isPersonal = (s) => s === "verified" || s === "published";

  // Resolve even on a dry run. It costs a few verifier credits, but printing
  // the shared inbox while a real send would reach a personal mailbox would
  // make the dry run actively misleading.
  if (!SEND) {
    const pick = await resolveAddress(withAddresses, { verify: verifyEmail });
    if (isPersonal(pick?.source)) personal++;
    console.log(`would send -> ${(pick?.email || "(nowhere)").padEnd(40)} [${pick?.source || "none"}]  ${p.personName}`);
    continue;
  }

  const res = await sendPreAsk(prisma, withAddresses, opts);
  if (res.sent) {
    sent++;
    if (isPersonal(res.source)) personal++;
    console.log(`sent -> ${res.email.padEnd(40)} [${res.source}]  ${p.personName}`);
  } else {
    failed++;
    console.log(`FAILED (${res.reason}) ${p.personName}: ${res.error || ""}`);
  }
}

console.log(`\ndone. ${SEND ? `sent=${sent}` : `queued=${batch.length}`} personal=${personal} failed=${failed}`);
await prisma.$disconnect();
