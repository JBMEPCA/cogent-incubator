// Apply the title alignment sheets to the running configuration.
//
// The sheets (Tom on Barbering, Lucas on Fleet and Airports, JB on Smart SME,
// August and September 2026) were distilled into docs on the day they arrived
// and then sat there: nothing from them reached the Site rows the agent
// prompts open with, the source list the wire reads, the keyword registry, or
// the advertiser and interview lists. This script is the rollout, and it is
// idempotent: every write is an upsert keyed on something stable, so running
// it twice changes nothing the second time.
//
// The brief text lives in scripts/alignment/<slug>.* and is read from there by
// this script AND by the seed-*-title scripts, so a reseed cannot undo it.
//
//   node --env-file=.env scripts/apply-alignment.mjs [--site=<slug>] [--dry-run]

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;
const DIR = path.resolve("scripts/alignment");
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8").trim();
const prisma = new PrismaClient();

const STAMP = "Alignment sheet rollout, 6 Sep 2026";

// ---------------------------------------------------------------- per title

const TITLES = {
  "barbering-business": {
    sections: [
      { name: "News", target: 5, commissionable: true },
      { name: "Business & Money", target: 6, commissionable: true },
      { name: "Marketing & Clients", target: 6, commissionable: true },
      { name: "Products & Tools", target: 7, commissionable: true },
      { name: "Shop & Fit-Out", target: 4, commissionable: true },
      { name: "Tech & Booking", target: 5, commissionable: true },
      { name: "People & Training", target: 4, commissionable: true },
      { name: "Trends & Services", target: 7, commissionable: true },
    ],
    // name, website, category, notes. The scan cron discovers the feed itself;
    // a competitor row is monitoring only, never a source to rewrite from.
    sources: [
      ["Dojo", "https://dojo.tech", "Payments & tipping", "Advertiser wishlist (Tom). Card terminals for shops."],
      ["Tyl by NatWest", "https://www.tyl.co.uk", "Payments & tipping", "Advertiser wishlist (Tom)."],
      ["Barber Blades", "https://www.barberblades.co.uk", "Wholesale", "Seen advertising everywhere (Tom)."],
      ["King C. Gillette", "https://www.gillette.co.uk/king-c-gillette", "Grooming brands", "Big brand the old Barber Mag could not land (Tom). Long-term target."],
      ["L'Oreal Professionnel", "https://www.lorealprofessionnel.co.uk", "Grooming brands", "Big brand, several sub-brands (Tom). Long-term target."],
      ["Modern Barber", "https://modernbarber.co.uk", "Sector press (competitor)", "The main competitor (Tom). Monitoring only; awards finalists are In the Chair targets."],
      ["LWPR", "https://www.lwpr.co.uk", "PR agency", "Agency for the big hair brands (Tom). Ask to be added to distribution."],
      ["SLBPR", "https://www.slbpr.co.uk", "PR agency", "Agency for the big hair brands (Tom). Ask to be added to distribution."],
      ["AJC93", "https://www.ajc93.com", "PR agency", "Agency for the big hair brands (Tom). Ask to be added to distribution."],
      ["Barber Connect", "https://www.barberconnect.co.uk", "Events", "Trade show, Telford, late spring. Exhibitor list is the prospect database."],
      ["Salon International", "https://www.salonexhibitions.co.uk", "Events", "London, October."],
      ["British Barbering Awards", "https://www.britishbarberingawards.co.uk", "Events", "Shortlists name shop owners: In the Chair targets."],
    ],
    // company, website, category, rationale, product
    prospects: [
      ["Wahl UK", "https://www.wahl.co.uk", "Clippers & tools", "Advertises everywhere in the sector (Tom). Long-term electrical tools target.", "banner"],
      ["Andis", "https://www.andis.com", "Clippers & tools", "Advertises everywhere (Tom).", "banner"],
      ["Uppercut Deluxe", "https://uppercutdeluxe.com", "Grooming brands", "Advertises everywhere (Tom).", "banner"],
      ["Dojo", "https://dojo.tech", "Payments", "Advertises everywhere; payments is a long-term wishlist category (Tom).", "web_story"],
      ["Captain Fawcett", "https://www.captainfawcett.com", "Grooming brands", "Advertises everywhere (Tom).", "banner"],
      ["Slick Gorilla", "https://www.slickgorilla.co.uk", "Grooming brands", "Advertises everywhere (Tom). Styling product: the easy early money.", "banner"],
      ["Barber Blades", "https://www.barberblades.co.uk", "Wholesale", "Seen advertising (Tom).", "banner"],
      ["Booksy", "https://booksy.com", "Booking software", "Long-term wishlist: booking systems (Tom).", "web_story"],
      ["Takara Belmont UK", "https://www.takarabelmont.co.uk", "Furniture & fit-out", "Long-term wishlist: furniture (Tom).", "banner"],
      ["Tyl by NatWest", "https://www.tyl.co.uk", "Payments", "Long-term wishlist: payment systems (Tom).", "web_story"],
      ["Fresha", "https://www.fresha.com", "Booking software", "Booking systems category (Tom).", "web_story"],
      ["SumUp", "https://www.sumup.com/en-gb", "Payments", "Payment systems category (Tom).", "banner"],
      ["Square UK", "https://squareup.com/gb", "Payments", "Payment systems category (Tom).", "banner"],
      ["Reuzel", "https://reuzel.com", "Grooming brands", "Styling product: small-brand tier Tom says converts first.", "banner"],
      ["Dapper Dan", "https://www.dapperdan.co.uk", "Grooming brands", "Styling product: small-brand tier.", "banner"],
      ["Morgan's Pomade", "https://www.morganspomade.co.uk", "Grooming brands", "Styling product: small-brand tier.", "banner"],
      ["StyleCraft", "https://www.stylecraftus.com", "Clippers & tools", "Electrical tools tier.", "banner"],
      ["BaByliss Pro UK", "https://www.babylisspro.co.uk", "Clippers & tools", "Electrical tools tier.", "banner"],
    ],
    // title, category, brief, search term to claim
    topics: [
      ["Card Machines and Payment Systems for Barbershops: Dojo, Tyl, SumUp, Square and Zettle Compared", "Tech & Booking",
        "Tom's reader search: 'payment systems for my barbershop'. A plain buyer's guide for a shop owner: monthly fees, per-transaction rates, contactless and tap-to-phone, tips handling, next-day payouts, booking-system integration. Name each provider, show what a shop taking £4,000 a week actually pays on each, and say which suits a one-chair shop versus a six-chair one. Spell out the so-what: faster payouts mean cash in the bank on Monday, lower rates mean an extra £X a month.",
        "payment systems for barbershop"],
      ["How to Hire a Barber for Your Shop: Employed, Self-Employed or Chair Rent, and What Each Costs", "People & Training",
        "Tom's reader search: 'employ a barber for my barbershop'. The owner's guide to taking on a barber: employed on PAYE versus self-employed versus chair rental, what each costs the shop per week, the HMRC employment-status test in plain words, where to advertise, what a trial day looks like, and the contract points that matter. Explain every point to the money.",
        "employ a barber for my barbershop"],
      ["New Kit for Barbers: September 2026's Launches, Prices and Who They Are For", "Products & Tools",
        "Tom's reader search: 'new products for barbers'. The first of a monthly round-up: the month's clipper, trimmer, shear, styling product and shop-kit launches, with UK prices and one line on who each is for. Real launches only, from the wire and brand newsrooms, each linked. This is the coverage the small styling brands and tool makers want to sit beside.",
        "new products for barbers"],
      ["The £90,000 Question: VAT and the Barbershop That Wants to Grow", "Business & Money",
        "From the launch content plan, wave 2. The VAT threshold explained for a shop owner: what happens to prices and margin the day you cross it, the flat rate scheme, whether to split or stay under, chair-renters and the threshold. Positive turn: how shops that crossed it made it pay.",
        "vat threshold barbershop"],
      ["How Much Should a Haircut Cost? Setting Barbershop Prices When Everything Costs More", "Business & Money",
        "From the launch content plan, wave 3. Pricing for a shop owner: cost per chair-hour, what the local market charges, how to put prices up without losing regulars, add-ons that lift the average ticket. Attributed price ranges only.",
        "how much should a haircut cost barbershop"],
      ["Beyond the Cut: The Services That Raise Average Spend Per Chair", "Trends & Services",
        "From the launch content plan, wave 2. The upsells and add-on services (hot towel shave, beard sculpt, scalp treatments, skin fades as premium, colour, grooming retail) with what each adds per visit, what kit it needs, and how to sell it without a hard pitch.",
        "barbershop services to increase revenue"],
    ],
    claims: ["employ a barber for my barbershop", "payment systems for my barbershop", "new products for barbers"],
  },

  "fleet-magazine": {
    sections: null,
    sources: [
      ["Influence Associates", "https://www.influenceassociates.com", "PR agency", "Commercial vehicle PR (Lucas). Ask to be added to distribution."],
      ["Garnett Keeler", "https://www.garnettkeeler.com", "PR agency", "Commercial vehicle PR (Lucas). Ask to be added to distribution."],
      ["Agility PR", "https://www.agilitypr.co.uk", "PR agency", "Automotive PR (Lucas). Domain unverified. Ask to be added to distribution."],
      ["Crowd Pull", "https://www.crowdpull.co.uk", "PR agency", "Automotive PR (Lucas). Domain unverified. Ask to be added to distribution."],
      ["Bott", "https://www.bottltd.co.uk", "Vehicle conversion & racking", "Seen at Fleet and Mobility Live (Lucas)."],
      ["FMG", "https://www.fmg.co.uk", "Incident & accident management", "Seen at Fleet and Mobility Live (Lucas)."],
      ["ForEV", "https://www.forev.co.uk", "Electric & charging", "Seen at Fleet and Mobility Live (Lucas)."],
      ["Fleet Service GB", "https://www.fleetservicegb.co.uk", "Fleet management", "Seen at UK Fleet Champions Awards (Lucas)."],
      ["MJ Quinn", "https://www.mjquinn.co.uk", "Fleet operators", "Seen at UK Fleet Champions Awards (Lucas)."],
      ["Motive", "https://gomotive.com", "Telematics & technology", "Seen at Fleet and Mobility Live (Lucas)."],
      ["FORS", "https://www.fors-online.org.uk", "Trade bodies", "Fleet Operator Recognition Scheme. Annual conference in September (Lucas)."],
      ["Motor Transport", "https://motortransport.co.uk", "Sector press (competitor)", "Motor Transport Awards in September: winners are Fleet Professional targets (Lucas)."],
      ["UK Fleet Champions Awards", "https://www.brake.org.uk/fleet-champions", "Events", "September awards run by Brake. Winners and sponsors are targets (Lucas)."],
      ["Fleet and Mobility Live", "https://www.fleetandmobilitylive.co.uk", "Events", "October. A Fleet News event: cover the news, expect no access (Lucas)."],
      ["Commercial Fleet Show", "https://www.commercialfleetshow.co.uk", "Events", "April (Lucas). Domain unverified."],
    ],
    prospects: [
      ["Ayvens", "https://www.ayvens.com/en-gb", "Leasing & funding", "Wishlist #1: huge fleet and leasing company; advertises in Fleet News (Lucas).", "banner"],
      ["Arval UK", "https://www.arval.co.uk", "Leasing & funding", "Wishlist #2: big player, company cars and EV (Lucas).", "banner"],
      ["Webfleet", "https://www.webfleet.com/en_gb", "Telematics & technology", "Wishlist #3: cost reduction and productivity, great fit for readers (Lucas).", "web_story"],
      ["Samsara", "https://www.samsara.com/uk", "Telematics & technology", "Wishlist #4: strong audience fit; seen at Fleet and Mobility Live (Lucas).", "web_story"],
      ["Zenith", "https://www.zenith.co.uk", "Leasing & funding", "Wishlist #5: leasing and fleet management; seen at Fleet and Mobility Live (Lucas).", "banner"],
      ["Volvo Trucks UK", "https://www.volvotrucks.co.uk", "Manufacturers", "Wishlist #6: advertises with Fleet News (Lucas).", "banner"],
      ["Allstar Business Solutions", "https://www.allstarcard.co.uk", "Fuel & energy", "Wishlist #7: fuel and EV cards; seen at Fleet and Mobility Live (Lucas).", "banner"],
      ["Geotab", "https://www.geotab.com/uk", "Telematics & technology", "Wishlist #8: big in the industry (Lucas).", "web_story"],
      ["BP Pulse", "https://www.bppulse.co.uk", "Electric & charging", "Wishlist #9: sponsors the big events (Lucas).", "banner"],
      ["Northgate Vehicle Hire", "https://www.northgatevehiclehire.co.uk", "Rental & hire", "Wishlist #10: vehicle hire, a different corner of the industry (Lucas).", "banner"],
      ["Athlon UK", "https://www.athlon.com/uk", "Leasing & funding", "Seen at Fleet and Mobility Live (Lucas).", "banner"],
      ["ForEV", "https://www.forev.co.uk", "Electric & charging", "Seen at Fleet and Mobility Live (Lucas).", "banner"],
      ["Bott", "https://www.bottltd.co.uk", "Vehicle conversion & racking", "Seen at Fleet and Mobility Live (Lucas).", "banner"],
      ["FMG", "https://www.fmg.co.uk", "Incident management", "Seen at Fleet and Mobility Live (Lucas).", "banner"],
      ["Motive", "https://gomotive.com", "Telematics & technology", "Seen at Fleet and Mobility Live (Lucas).", "web_story"],
      ["Quartix", "https://www.quartix.com", "Telematics & technology", "Seen at UK Fleet Champions Awards (Lucas).", "banner"],
      ["Fleet Service GB", "https://www.fleetservicegb.co.uk", "Fleet management", "Seen at UK Fleet Champions Awards (Lucas).", "banner"],
      ["MJ Quinn", "https://www.mjquinn.co.uk", "Fleet operators", "Seen at UK Fleet Champions Awards (Lucas).", "other"],
      ["The AA", "https://www.theaa.com/business", "Roadside & breakdown", "Seen at media events (Lucas).", "banner"],
    ],
    topics: [
      ["Best Vans for a Small Business in 2026: A Fleet Buyer's Shortlist With Running Costs and Tax", "Vans & LCV",
        "Lucas's reader search: 'what is the best van for a small business'. Written for a business buyer, never the public: a shortlist by job (small panel van, medium, large, pickup, electric), with list price, typical lease rate, payload, real-world running cost per mile, VED and van benefit charge, and which fits a five-van trade fleet versus a fifty-van one. Every figure attributed and dated per the figure rule.",
        "best van for a small business"],
    ],
    claims: ["best van for a small business", "tax rules on company cars", "how much does it cost to run an electric van",
      // Beat ownership: terms Smart SME has already published against and must not bid for again.
      "uk fleet platform", "van mandate review", "used ev sales record share", "zev mandate", "company car tax", "electric van running costs", "fleet management software"],
    // PrBrand name -> note to append (Lucas's press contacts, unverified until a human confirms)
    contactNotes: {
      "Ford Pro UK": "Press contact per Lucas's sheet (26 Aug 2026, unverified): product press office, cbrow559@ford.com.",
      "Toyota GB Fleet": "Press contact per Lucas's sheet (26 Aug 2026, unverified): Charles Holcomb, Head of PR, charles.holcomb@tgb.toyota.co.uk.",
      "Ayvens UK": "Press contact per Lucas's sheet (26 Aug 2026, unverified): communications@ayvens.com.",
      "BVRLA": "Press contacts published on bvrla.co.uk/media-centre (verified 6 Sep 2026): Adam Forshaw, head of communications, adamf@bvrla.co.uk; Helen Lawrence, senior communications officer, helen@bvrla.co.uk (the 'Helen' on Lucas's sheet).",
      "SMMT": "Media team address published on smmt.co.uk/press-pr (verified 6 Sep 2026): communications@smmt.co.uk. Lucas's sheet also names ebutcher@smmt.co.uk (unverified).",
    },
  },

  "airport-business-magazine": {
    sections: [
      { name: "News", target: 8, commissionable: true },
      { name: "Revenue & Commercial", target: 6, commissionable: true },
      { name: "Expansion & Construction", target: 8, commissionable: true },
      { name: "Technology & Systems", target: 7, commissionable: true },
      { name: "Operations & Resilience", target: 5, commissionable: true },
      { name: "Route Development", target: 4, commissionable: true },
      { name: "Sustainability & Energy", target: 4, commissionable: true },
    ],
    sources: [
      ["8020 Communications", "https://www.8020comms.com", "PR agency", "Aviation and travel PR covering a large part of the sector (Lucas). Lucas has already asked to be added to their database: chase it."],
      ["Positive Story PR", "https://www.positivestory.co.uk", "PR agency", "Weaker, but has an aviation client list (Lucas). Domain unverified."],
      ["ESRI", "https://www.esri.com/en-us/industries/airports", "Airport IT & software", "Seen advertising on Airport World (Lucas)."],
      ["Siemens Logistics", "https://www.siemens-logistics.com", "Baggage handling", "Wishlist #5: baggage, power and electrical infrastructure (Lucas)."],
      ["Cisco", "https://newsroom.cisco.com", "Airport IT & software", "Wishlist #7: networking and cybersecurity (Lucas)."],
      ["Arup", "https://www.arup.com/news", "Consultants & engineers", "Airport consultancy; Jenny Buckley is an Airside with target (Lucas)."],
      ["Business Airport International", "https://www.businessairportinternational.com", "Trade press (competitor)", "Lucas's exemplar source. Monitoring only."],
      ["Inter Airport", "https://www.interairport.com", "Events", "October. Airport equipment, tech, design and services; exhibitor list is the prospect database (Lucas)."],
      ["Airports Innovate", "https://www.airportsinnovate.com", "Events", "November. ACI innovation event with big sponsors (Lucas). Domain unverified."],
      ["Passenger Terminal Expo", "https://www.passengerterminal-expo.com", "Events", "April. Big exhibitors; site has reusable interview and panel material (Lucas)."],
      ["Airport Experience Summit", "https://aci.aero/events", "Events", "August/September. ACI World CEO-level experience event with awards (Lucas)."],
      ["Jointline", "https://www.jointline.co.uk", "Airfield systems", "Inter Airport exhibitor: small-tier prospect (Lucas)."],
      ["Flofuel Support", "https://www.flofuelsupport.com", "Ground support equipment", "Inter Airport exhibitor: small-tier prospect (Lucas). Domain unverified."],
      ["Page GSE", "https://www.pagegse.com", "Ground support equipment", "Inter Airport exhibitor: small-tier prospect (Lucas). Domain unverified."],
      ["ElectroAir", "https://www.electroair.co.uk", "Ground support equipment", "Inter Airport exhibitor: small-tier prospect (Lucas). Domain unverified."],
      ["JM Enterprise", "https://www.jmenterprise.co.uk", "Ground support equipment", "Inter Airport exhibitor: small-tier prospect (Lucas). Domain unverified."],
    ],
    prospects: [
      ["SITA", "https://www.sita.aero", "Airport IT & software", "Wishlist #1: global airport tech, already advertising elsewhere (Lucas).", "banner"],
      ["Thales", "https://www.thalesgroup.com", "Security & identity", "Wishlist #2: security, identity and tech (Lucas).", "banner"],
      ["Vanderlande", "https://www.vanderlande.com", "Baggage handling", "Wishlist #3: baggage and handling, already advertising elsewhere (Lucas).", "banner"],
      ["ADB Safegate", "https://adbsafegate.com", "Airfield systems", "Wishlist #4: used by airports everywhere; seen in Airport World and at Inter Airport (Lucas).", "banner"],
      ["Siemens Logistics", "https://www.siemens-logistics.com", "Baggage handling", "Wishlist #5: baggage, power and electrical infrastructure (Lucas).", "banner"],
      ["IDEMIA", "https://www.idemia.com", "Biometrics & security", "Wishlist #6: passenger processing (Lucas).", "web_story"],
      ["Cisco", "https://www.cisco.com", "Airport IT & software", "Wishlist #7: networking and cybersecurity, big name (Lucas).", "banner"],
      ["WHSmith Travel", "https://www.whsmithplc.co.uk/travel", "Retail & concessions", "Wishlist #8: the concession-vendor archetype, wants to reach the people who award retail space (Lucas).", "banner"],
      ["Barclays Corporate Banking", "https://www.barclayscorporate.com", "Finance & infrastructure", "Wishlist #9: the infrastructure-finance archetype (Lucas).", "banner"],
      ["Leidos", "https://www.leidos.com", "Biometrics & security", "Wishlist #10: covers a lot of areas (Lucas).", "banner"],
      ["Smiths Detection", "https://www.smithsdetection.com", "Biometrics & security", "Seen advertising in multiple places (Lucas).", "banner"],
      ["Clear Channel Outdoor", "https://clearchannel.com", "Advertising concessions", "Seen advertising on Airport World (Lucas).", "banner"],
      ["ESRI", "https://www.esri.com", "Airport IT & software", "Seen advertising on Airport World (Lucas).", "banner"],
      ["Jointline", "https://www.jointline.co.uk", "Airfield systems", "Inter Airport exhibitor (Lucas). Small tier.", "other"],
      ["Flofuel Support", "https://www.flofuelsupport.com", "Ground support equipment", "Inter Airport exhibitor (Lucas). Small tier.", "other"],
      ["Page GSE", "https://www.pagegse.com", "Ground support equipment", "Inter Airport exhibitor (Lucas). Small tier.", "other"],
      ["ElectroAir", "https://www.electroair.co.uk", "Ground support equipment", "Inter Airport exhibitor (Lucas). Small tier.", "other"],
      ["JM Enterprise", "https://www.jmenterprise.co.uk", "Ground support equipment", "Inter Airport exhibitor (Lucas). Small tier.", "other"],
    ],
    topics: [
      ["How Airports Cut Security Wait Times: The Technology Shortlist and What It Costs", "Technology & Systems",
        "Lucas's reader search: 'ways to decrease wait times in airports'. A buyer's guide for a head of security or passenger experience: CT checkpoint scanners, automated tray return, queue measurement (Xovis and rivals), biometric e-gates, virtual queuing, staffing analytics. For each: named vendors, what it costs per lane or per airport where published, what it did to throughput at a named airport (Vienna's 35-scanner rollout, others on the wire). Every figure sourced and dated.",
        "ways to decrease wait times in airports"],
      ["The Technology Every Airport Will Be Running by 2030: What Is Being Rolled Out Now and What It Costs", "Technology & Systems",
        "Tom's rollout rule: cover technology at the point of mass adoption, when vendor budgets are open. CT checkpoint scanners under the EU and TSA mandates, biometric e-gates and digital travel credentials, cloud AODB and operations platforms, autonomous ground equipment, electrified airside, SAF supply. For each: who is rolling it out (named airports, 2026), who supplies it (named vendors), what it costs where published, and the deadline or mandate driving it. This is the 'what is next' piece a chief executive reads to set the capital plan.",
        "airport technology rollouts 2030"],
      ["The Biggest Airport Capital Programmes of 2026-27: Who Is Spending, and Who Is Supplying Them", "Expansion & Construction",
        "Tom's capital programme rule: big renovations and new airports make every supplier spend. A table of the largest live programmes (new terminals, new airports, government-funded programmes tied to World Cup 2030, Expo, national plans), each with promoter, budget as stated and dated, timeline, and the named design, construction and systems contractors awarded so far. Scope-and-figure rule applies to every number. The supplier column is the point: those companies are the advertisers.",
        "airport capital programmes 2026"],
      ["Airport Sustainability Programmes Compared: What the Leaders Spend and What It Returns", "Sustainability & Energy",
        "Lucas's reader search: 'airport sustainability'. Not a virtue piece: a comparison of what named airports (Gatwick's net zero by 2030, Schiphol, Kelowna, Brisbane and others on the wire) are spending on solar, HVO and electrified airside, SAF, and what each reports back in cost, revenue or regulatory position. Named suppliers throughout.",
        "airport sustainability"],
      ["Airport Security Technology in 2026: The Vendors, the Mandates and the Prices", "Technology & Systems",
        "Lucas's reader search: 'airport security technology'. A vendor map at procurement level only (the incident rule: never vulnerability level): CT scanners (Smiths Detection, Leidos, Rapiscan, others), body scanners, biometric identity (IDEMIA, Thales, SITA, Vision-Box), explosives trace, with the mandate driving each and prices where published.",
        "airport security technology"],
    ],
    claims: ["airport security technology", "airport sustainability", "ways to decrease wait times in airports"],
    contactNotes: {
      "ACI World": "Media relations published on aci.aero (verified 6 Sep 2026): mediarelations@aci.aero.",
      "ACI Europe": "Press contact per Lucas's sheet (25 Aug 2026, unverified): Agata Lyznik, Director of Communications, agata.lyznik@aci-europe.org.",
      "IATA pressroom": "Press contact per Lucas's sheet (25 Aug 2026, unverified): corpcomms@iata.org.",
      "SITA": "Lucas signed up to receive all SITA news (25 Aug 2026).",
    },
  },

  "smart-sme": {
    sections: null,
    sources: [
      ["Harvard", "https://www.harvard.co.uk", "PR agency", "Tech PR (JB). Ask to be added to distribution."],
      ["ITPR", "https://www.itpr.co.uk", "PR agency", "Tech PR (JB). Ask to be added to distribution."],
      ["Wildfire", "https://www.wildfirepr.com", "PR agency", "Tech PR (JB). Ask to be added to distribution."],
      ["Touchdown PR", "https://www.touchdownpr.com", "PR agency", "Tech PR (JB). Ask to be added to distribution."],
      ["Element Communications", "https://elementcommunications.co.uk", "PR agency", "Tech PR (JB). Ask to be added to distribution."],
      ["Fourth Day", "https://www.fourthday.co.uk", "PR agency", "Tech PR (JB). Ask to be added to distribution."],
      ["Elite Business Magazine", "https://elitebusinessmagazine.co.uk", "Sector press (competitor)", "Best competitor by far (JB). Monitoring only."],
      ["Business Live", "https://www.business-live.co.uk", "Sector press (competitor)", "Regional business news; appointment stories for SME Movers (JB). Monitoring only."],
      ["Business Matters", "https://bmmagazine.co.uk", "Sector press (competitor)", "Monitoring only. Advertisers seen here: NFU Mutual, Hiscox."],
      ["SME Business News", "https://www.smebusinessnews.co.uk", "Sector press (competitor)", "Monitoring only. Domain unverified."],
      ["SEFE Energy", "https://www.sefe-energy.co.uk", "Energy & utilities", "Seen advertising on Business Live (JB)."],
      ["Clearcourse", "https://www.clearcourse.com", "Payments & ecommerce", "Seen advertising on Elite Business (JB)."],
      ["Howden Insurance", "https://www.howdeninsurance.co.uk", "Insurance & services", "Seen advertising on Elite Business (JB)."],
      ["SuperBenji", "https://www.superbenji.ai", "AI & productivity", "Seen advertising on Elite Business (JB). Domain unverified."],
      ["marketlocation", "https://www.marketlocation.com", "Data & AI platforms", "Seen advertising on Elite Business (JB)."],
      ["London Tech Week", "https://londontechweek.com", "Events", "June (JB)."],
      ["Great British Business Show", "https://www.greatbritishbusinessshow.co.uk", "Events", "November, ExCeL (JB)."],
      ["B2B Expos", "https://www.b2bexpos.co.uk", "Events", "Regional, through the year (JB)."],
      ["Business Revival Series", "https://www.businessrevivalseries.co.uk", "Events", "(JB)."],
    ],
    prospects: [
      ["SEFE Energy", "https://www.sefe-energy.co.uk", "Energy & utilities", "Seen advertising on Business Live (JB, 4 Sep 2026).", "banner"],
      ["NFU Mutual", "https://www.nfumutual.co.uk", "Insurance & services", "Seen advertising on Business Matters (JB, 4 Sep 2026).", "banner"],
      ["Clearcourse", "https://www.clearcourse.com", "Payments & software", "Seen advertising on Elite Business (JB, 4 Sep 2026).", "banner"],
      ["Howden Insurance", "https://www.howdeninsurance.co.uk", "Insurance & services", "Seen advertising on Elite Business (JB, 4 Sep 2026).", "banner"],
      ["Cisco", "https://www.cisco.com/c/en_uk/solutions/small-business.html", "Connectivity & hardware", "Seen advertising on Elite Business (JB, 4 Sep 2026).", "banner"],
      ["SuperBenji", "https://www.superbenji.ai", "AI & productivity", "Seen advertising on Elite Business (JB, 4 Sep 2026).", "web_story"],
      ["marketlocation", "https://www.marketlocation.com", "Data & marketing", "Seen advertising on Elite Business (JB, 4 Sep 2026).", "banner"],
    ],
    topics: [
      ["How to Use AI in Your Small Business: A Plain-English Starter Guide for 2026", "AI & Automation",
        "JB's pillar search: 'how to use AI in business'. For a busy owner with no technical background: what AI can do for a small firm today (writing, admin, customer service, bookkeeping, marketing), the five things to try first with the exact tool named at each step, what each costs, the mistakes to avoid, and how to bring staff along. Every step ends in what it saves or earns.",
        "how to use ai in business"],
      ["Best AI Tools for Small Business in 2026: What to Use for What, and What It Costs", "AI & Automation",
        "JB's pillar search: 'best AI for small business'. A comparison by job: assistants (Claude, ChatGPT, Copilot, Gemini), writing, meetings, bookkeeping, customer service, design. UK prices, a table, and a clear recommendation for a typical ten-person firm. At least two names the reader would not already know.",
        "best ai for small business"],
      ["AI for Small Business Marketing: The Tools That Actually Save a Small Team Time", "Marketing",
        "JB's pillar search: 'marketing AI'. Email, social, ads, SEO and content tools with AI built in, what each does for a two-person marketing team, UK prices, and what to try first. Named tools throughout with a verdict.",
        "ai for small business marketing"],
      ["AI in Small Business Finance: Bookkeeping, Forecasting and Chasing Invoices Without a Finance Team", "Finance",
        "JB's pillar search: 'finance AI'. Xero, QuickBooks, FreeAgent and Sage AI features, Chaser and the credit-control tools, forecasting apps, what each costs and what it removes from the owner's week. Explain every term.",
        "ai for small business finance"],
      ["AI Social Media Tools for Small Businesses: Posting, Replying and Reporting Without a Team", "Marketing",
        "JB's pillar search: 'AI social media'. The scheduling and AI-writing tools for a small firm's social media, with UK prices, what each does well, and a recommendation by business type. A plain how-to for a non-technical owner.",
        "ai social media tools for small business"],
      ["Best Business Insurance for Small Businesses in 2026: Compared and Costed", "Finance",
        "The comparison the insurers on the advertiser list want to sit beside (JB). Public liability, employers' liability, professional indemnity, cyber: what a typical small firm needs, named providers (Hiscox, NFU Mutual, Simply Business, Howden, AXA, Superscript and others), indicative UK premiums where published, and how to buy without overpaying. Explain every term.",
        "best business insurance for small business"],
      ["Best Business Energy Suppliers for UK SMEs in 2026: Tariffs, Contracts and the Traps", "Operations",
        "The comparison the energy advertisers want to sit beside (JB). Named suppliers (SEFE, British Gas Business, EDF, Octopus Business, Drax and others), fixed versus variable, contract lengths, the rollover trap, brokers, and what a typical small premises pays. Attributed figures only.",
        "best business energy supplier for small business"],
      ["Best Business Broadband for Small Businesses in 2026: Speed, Price and What You Actually Need", "Operations",
        "The comparison for the connectivity advertisers (JB). BT Business, Virgin Media Business, Vodafone, TalkTalk Business, Hyperoptic and the challengers: what a small office actually needs, UK prices, contract terms, and a recommendation by business size.",
        "best business broadband for small business"],
    ],
    claims: ["how to use ai in business", "ai for small business", "best ai for small business", "best crm for small business", "ai for small business marketing", "ai for small business finance", "ai social media tools for small business"],
    // The wire search JB's never rule removes. The code entry goes with it.
    removeSearches: ["Wire: insolvency and closures"],
  },
  // James Davies, Publication Manager of Care Home Magazine, 22 Sep 2026.
  // Sections are left as launch set them: the sheet did not contradict them.
  // Every URL here came from his sheet or is a domain confident enough to
  // stand behind; anything else is marked so a human checks it before use.
  "senior-lifestyle-business": {
    sources: [
      ["ARCO (Associated Retirement Community Operators)", "https://www.arcouk.org", "Trade body", "Where news breaks first (James). The leading UK trade body, and being an approved ARCO media partner is the title's three-year goal."],
      ["Retirement Housing Group", "https://retirementhousinggroup.com", "Trade body", "Where news breaks first (James)."],
      ["Argentum", "https://www.argentum.org", "Trade body (US)", "Where news breaks first (James). The US benchmark, and the body behind the Senior Living Executive Conference."],
      ["Ageing Australia", "https://ageingaustralia.asn.au", "Trade body (AU)", "Where news breaks first (James). The AU market this title treats as its second."],
      ["Senior Housing News", "https://seniorhousingnews.com", "Trade press (competitor)", "The competitor James rates most: news, interviews, case studies and expert advice. Monitoring only, never rewritten from."],
      ["Housing Today", "https://www.housingtoday.co.uk", "Trade press", "James's exemplar: the Epping Forest 144-home consent story is exactly the scheme-news format this title should own."],
      ["Seniors Housing Business", "https://seniorshousingbusiness.com", "Trade press (competitor)", "Where James sees Yardi, Sabra and Salto advertising. Monitoring and advertiser intelligence."],
      ["Home Care Insight", "https://www.homecareinsight.co.uk", "Trade press (competitor)", "Where James sees Care Handbook and Evondos advertising. Adjacent sector; monitoring only, and the front-door rule still applies."],
      ["Seniors Housing Awards", "https://seniorshousingawards.com", "Events and awards", "Named by James. Winners and sponsors are both advertiser prospects and interview targets."],
      ["Retirement Living Awards", "https://rlawards.co.uk", "Events and awards", "Named by James. Where he saw White Oaks, Prosperwell and Commercial Acceleration advertising."],
      ["Retirement Living Conference", "https://retirementlivingconf.com", "Events", "March. The retirement living exhibition (James). Exhibitor list is the prospect database."],
      ["Senior Living Executive Conference (Argentum)", "https://www.hmpglobalevents.com", "Events", "May. Argentum's official meeting for US owners, operators and executives (James). The US benchmark event."],
      ["Care Homes Conference", "https://www.carehomesconference.com", "Events", "December. Runs a retirement living track (James). The conference is adjacent: cover the retirement living content, not the care home content."],
      ["Care Show Retirement Living", "https://www.careshow.co.uk", "Events", "October. The Retirement Living Show executive club (James)."],
      ["Brazil St", "https://brazilst.co.uk", "PR agency", "Serves this sector (James). Ask to be added to the distribution list."],
      ["Prosperwell", "https://www.prosperwell.co.uk", "PR agency", "Serves this sector AND advertises at the RL Awards (James), so it is both a source and a prospect."],
      ["Brookdale Senior Living", "https://www.brookdale.com", "Operator press office (US)", "Press list James named: media.relations@brookdale.com. Get press@ added."],
      ["Sunrise Senior Living", "https://www.sunriseseniorliving.com", "Operator press office (US)", "Press list James named: media@sunriseseniorliving.com. Get press@ added."],
      ["Inspired Villages", "https://www.inspiredvillages.co.uk", "Operator press office", "Press list James named: communications@inspiredvillages.co.uk. Get press@ added. Kat Andrews is an interview target."],
      ["Retirement Villages Group", "https://www.rvg.co.uk", "Operator press office", "Press list James named: pressoffice@rvg.co.uk. Get press@ added. Viv Rowe is an interview target."],
    ],
    prospects: [
      ["Octopus Capital", "https://octopusgroup.com", "Finance and investment", "Wishlist #1 (James): big financing company for new developments, seen at the Seniors Housing Awards. He named it Octopus Capital; the property arm trades as Octopus Real Estate, so check which entity buys.", "banner"],
      ["TIS (Total Integrated Solutions)", "https://www.tisltd.com", "Fire safety and compliance", "Wishlist #2 (James): fire safety brand. Domain unverified.", "banner"],
      ["Direct Supply", "https://www.directsupply.com", "Procurement", "Wishlist #3 (James): large US procurement partner. A US prospect for a title the owner wants global.", "banner"],
      ["Trowers & Hamlins LLP", "https://www.trowers.com", "Legal and advisory", "Wishlist #4 (James): strategic partners with ARCO, which is also the title's media-partner target.", "banner"],
      ["Siemens", "https://www.siemens.com", "Building systems and technology", "Wishlist #5 (James): relevance across many departments, and a name that pulls other advertisers in.", "banner"],
      ["Autumna", "https://www.autumna.co.uk", "Directory and lead generation", "Wishlist #6 (James): large directory network. Consumer-facing, so any coverage must stay on the operator side of the front-door rule.", "banner"],
      ["Cisco", "https://www.cisco.com", "Networking and cybersecurity", "Wishlist #7 (James): big name, would gain attention and draw other advertisers.", "banner"],
      ["Bridgman Commercial", "https://www.bridgman.co.uk", "Furniture and FF&E", "Wishlist #8 (James): furniture. Domain unverified. The Hotel Magazine's FF&E book is the crossover to test here.", "banner"],
      ["Nobi", "https://nobi.life", "Resident technology", "Wishlist #9 (James): fall prevention technology. Domain unverified. Claims rule applies hard to anything it says about outcomes.", "web_story"],
      ["Foodbuy", "https://www.foodbuy.co.uk", "Catering and procurement", "Wishlist #10 (James): the UK's largest group purchasing organisation for catering. Domain unverified.", "banner"],
      ["Yardi", "https://www.yardi.com", "Operator software", "Seen advertising on Seniors Housing Business (James).", "banner"],
      ["Sabra Health Care REIT", "https://www.sabrahealth.com", "REIT and investment", "Seen advertising on Seniors Housing Business (James). A REIT advertising to operators is exactly this title's reader.", "banner"],
      ["Salto", "https://www.saltosystems.com", "Access control", "Seen advertising on Seniors Housing Business (James).", "banner"],
      ["Care Handbook", "https://www.carehandbook.com", "Compliance and publishing", "Seen advertising on Home Care Insight (James). Domain unverified; adjacent sector, check the fit before approaching.", "other"],
      ["Evondos", "https://www.evondos.com", "Medication technology", "Seen advertising on Home Care Insight (James). Adjacent sector.", "web_story"],
      ["Symphony Sound", "https://www.symphonysound.co.uk", "Audio and AV", "Seen advertising in multiple places (James). Domain unverified.", "other"],
      ["Virgin Money", "https://uk.virginmoney.com", "Finance", "Seen advertising in multiple places (James).", "banner"],
      ["TYL by NatWest", "https://www.tylbynatwest.com", "Payments", "Seen advertising in multiple places (James).", "banner"],
      ["White Oaks", "https://www.whiteoaks.co.uk", "Marketing and PR", "Seen advertising at the RL Awards (James). Domain unverified.", "other"],
      ["Commercial Acceleration", "https://www.commercialacceleration.com", "Sales and growth consultancy", "Seen advertising at the RL Awards (James). Domain unverified.", "other"],
      ["Prosperwell", "https://www.prosperwell.co.uk", "Marketing and PR", "Seen advertising at the RL Awards (James), and named by him as a PR agency serving the sector. Both a source and a prospect.", "other"],
    ],
    topics: [
      ["What UK Retirement Village Operators Can Learn From the US Market", "Operators & Economics",
        "James's named gap: there is no big competitor offering a global read on how these markets compare, and he believes there is a great deal the UK could learn from the US. Compare the two on the things an operator controls: staffing models and manager retention, amenity mix and what earns its space, occupancy and how it is measured, the fee model (deferred management fee against US entry-fee and rental models), and where capital comes from. Named operators on both sides, figures with market, source, year and scope under the scope-and-figure rule, and a clear statement of what does not transfer. Argentum, NIC MAP and Knight Frank are the anchors.",
        "uk us retirement living comparison"],
      ["The Retirement Village Schemes Approved This Quarter, and Who Is Building Them", "Development & Planning",
        "The beat James picked out unprompted: his favourite article on the site is the Rangeford Villages planning win, and his exemplar from a competitor is another consent story. Make it a recurring quarterly round-up: every scheme granted, refused or appealed in the quarter, with operator, place, home count, and the named contractor and adviser where published. The supplier column is the commercial point, because those companies are advertisers. Each entry links to the original council decision notice.",
        "new retirement village"],
      ["How Retirement Village Operators Are Marketing Themselves Now", "Sales & Marketing",
        "Three of James's ten reader search terms are marketing ones (marketing for retirement villages, for retirement community, for senior living), which makes this the clearest demand signal on the sheet and nobody is serving it well. Written for a sales and marketing director: what the lead sources actually are, what a reservation costs to win, how operators handle the long decision cycle and the adult children in it, what the good websites and show homes do differently, and which agencies and directories operators use. Named operators throughout, and no consumer-facing advice.",
        "marketing for retirement villages"],
      ["Who Supplies the Retirement Living Sector: The Categories and the Names", "Operators & Economics",
        "Two of James's reader search terms are supplier ones (senior living suppliers, retirement living suppliers) and no competitor has built the answer. A structured directory piece by category: development and construction, FF&E and furniture, catering and procurement, access control and security, resident technology and falls, operator software, insurance, legal, marketing. Named companies in each, what they actually sell, and who in the operator buys it. This is the piece the advertiser wishlist wants to sit next to, and it is a standing asset rather than a news story.",
        "retirement living suppliers"],
      ["How Operators Are Building Culture and Keeping Village Managers", "Operators & Economics",
        "James's exemplar articles from Senior Housing News are both people pieces: six operators on creating culture, and what providers can learn from one operator's university partnership. Village manager recruitment and retention is the constraint operators name most often. Interview-led, at least three named operators on the record, covering what they pay, how they promote from within, what training and partnership arrangements exist, and what actually reduced turnover. No invented quotes, and no advice framing.",
        "retirement village manager recruitment"],
    ],
    claims: [
      "senior living news",
      "retirement living news",
      "senior living suppliers",
      "retirement living suppliers",
      "marketing for retirement villages",
      "marketing for retirement community",
      "marketing for senior living",
      "new senior living providers",
      "new retirement community",
      "new retirement village",
    ],
  },
};

// ------------------------------------------------------------------ helpers

const log = (...a) => console.log(...a);

async function upsertSource(siteId, [name, website, category, notes]) {
  const existing = await prisma.prBrand.findFirst({ where: { siteId, name } });
  if (existing) {
    if (!existing.notes?.includes(STAMP)) {
      if (!DRY) await prisma.prBrand.update({ where: { id: existing.id }, data: { notes: `${existing.notes ? existing.notes + "\n" : ""}${STAMP}: ${notes}` } });
      return "noted";
    }
    return "kept";
  }
  if (!DRY) {
    await prisma.prBrand.create({
      data: { siteId, name, website, category, newsHubUrl: new URL(website).origin, notes: `${STAMP}: ${notes}` },
    });
  }
  return "created";
}

async function upsertProspect(siteId, [company, website, category, rationale, product]) {
  const existing = await prisma.advertiserProspect.findFirst({ where: { siteId, company } });
  if (existing) return "kept";
  if (!DRY) await prisma.advertiserProspect.create({ data: { siteId, company, website, category, rationale, suggestedProduct: product } });
  return "created";
}

async function upsertTopic(siteId, [title, category, brief, term]) {
  const existing = await prisma.researchTopic.findFirst({ where: { siteId, title } });
  if (existing) return "kept";
  if (!DRY) {
    await prisma.researchTopic.create({
      data: { siteId, title, category, source: "jb", query: brief, rationale: `${STAMP}. Search term: ${term}`, score: 100, status: "proposed" },
    });
  }
  return "created";
}

function normaliseTerm(t) {
  return String(t || "").toLowerCase().replace(/[\s ]+/g, " ").replace(/^[\s"'“”‘’.,:;!?()-]+|[\s"'“”‘’.,:;!?()-]+$/g, "").trim();
}

async function claim(site, term) {
  const t = normaliseTerm(term);
  const held = await prisma.keywordTarget.findMany({ where: { term: t, market: site.markets?.[0] || "GB", siteId: { not: site.id } }, select: { site: { select: { name: true } } } });
  if (held.length) return `HELD by ${held.map((h) => h.site.name).join(", ")}`;
  const mine = await prisma.keywordTarget.findFirst({ where: { siteId: site.id, term: t } });
  if (mine) return "kept";
  if (!DRY) await prisma.keywordTarget.create({ data: { siteId: site.id, term: t, market: site.markets?.[0] || "GB", source: "gap", status: "claimed", claimedAt: new Date() } });
  return "claimed";
}

// --------------------------------------------------------------------- main

for (const [slug, cfg] of Object.entries(TITLES)) {
  if (ONLY && ONLY !== slug) continue;
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { log(`!! no site ${slug}`); continue; }
  log(`\n#### ${site.name} (${slug})${DRY ? "  [DRY RUN]" : ""}`);

  // 1. The brief: reader line, editorial standard, house style, sections.
  const data = {
    audience: read(`${slug}.audience.txt`),
    editorialStandardMd: read(`${slug}.editorial-standard.md`),
    houseStyleMd: read(`${slug}.house-style.md`),
  };
  if (cfg.sections) data.sections = cfg.sections;
  const changed = Object.keys(data).filter((k) => JSON.stringify(site[k]) !== JSON.stringify(data[k]));
  if (changed.length) {
    if (!DRY) await prisma.site.update({ where: { id: site.id }, data });
    log(`  brief: updated ${changed.join(", ")}`);
  } else log("  brief: unchanged");

  // 2. Sources.
  const s = { created: 0, noted: 0, kept: 0 };
  for (const row of cfg.sources) s[await upsertSource(site.id, row)]++;
  log(`  sources: ${s.created} created, ${s.noted} annotated, ${s.kept} already present`);

  // 3. Press-contact notes on existing rows.
  let noted = 0;
  for (const [name, note] of Object.entries(cfg.contactNotes || {})) {
    const row = await prisma.prBrand.findFirst({ where: { siteId: site.id, name } });
    if (!row) { log(`  !! contact note: no source named "${name}"`); continue; }
    if (row.notes?.includes(note)) continue;
    if (!DRY) await prisma.prBrand.update({ where: { id: row.id }, data: { notes: `${row.notes ? row.notes + "\n" : ""}${note}` } });
    noted++;
  }
  if (Object.keys(cfg.contactNotes || {}).length) log(`  press contacts: ${noted} notes added`);

  // 4. Advertiser prospects.
  const p = { created: 0, kept: 0 };
  for (const row of cfg.prospects) p[await upsertProspect(site.id, row)]++;
  log(`  advertiser prospects: ${p.created} created, ${p.kept} already present`);

  // 5. Commissions, through the Director's JB lane.
  const t = { created: 0, kept: 0 };
  for (const row of cfg.topics) t[await upsertTopic(site.id, row)]++;
  log(`  commissions queued for the Director: ${t.created} new, ${t.kept} already queued`);

  // 6. Keyword registry.
  for (const term of cfg.claims) log(`  registry: "${term}" -> ${await claim(site, term)}`);

  // 7. Searches removed by the never rule.
  for (const name of cfg.removeSearches || []) {
    const row = await prisma.prBrand.findFirst({ where: { siteId: site.id, name } });
    if (!row) { log(`  search "${name}": already gone`); continue; }
    if (!DRY) await prisma.prBrand.delete({ where: { id: row.id } });
    log(`  search "${name}": removed`);
  }
}

await prisma.$disconnect();
log(DRY ? "\n--- DRY RUN, nothing written ---" : "\ndone.");
