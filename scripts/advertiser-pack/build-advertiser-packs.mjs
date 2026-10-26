/**
 * One advertiser pack per title, all ten, as editable .pptx.
 *
 * JB, 20 Oct 2026: "I need all 10 now ... exactly in the format of how we've
 * changed dental", with correct numbers and XX where there is no number.
 *
 * So this does not redraw anything. It opens JB's own edited Dental file
 * (Dental-Business-News-Advertiser-Pack-v4.pptx, the one he reworked in
 * PowerPoint on 19 Oct) and, per title, swaps the words, the numbers, the
 * palette, the masthead and the two photographs. Every position, size and
 * font is his.
 *
 * Numbers come from pack-stats.json, written by pull-pack-stats.mjs (Mailchimp
 * and GA4, live). Run that first.
 *
 * Run: node scripts/advertiser-pack/build-advertiser-packs.mjs [slug]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import sharp from "sharp";
import { computeProfile, PROFILES, regionOf } from "./audience-profile.mjs";
import { projectedProfile } from "./projected-profiles.mjs";
import { buildProfileSlide } from "./profile-slide.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, "Dental-Business-News-Advertiser-Pack-v4.pptx");
// PACK_OUT lets a rebuild land beside the usual folder while a pack there is
// open in PowerPoint, which locks it.
const OUT_DIR = path.join(HERE, process.env.PACK_OUT || "packs");
const BRAND = path.resolve(HERE, "../../../cogent-base-theme/scripts/brand");
const STATS = JSON.parse(fs.readFileSync(path.join(HERE, "pack-stats.json"), "utf8"));
// Subscriber records for the "Who reads" page (pull-audience-profile.mjs) and
// the projected world map it shades (world-paths.json, Natural Earth via
// world-atlas, projected once so no map library is needed here).
const RAW = JSON.parse(fs.readFileSync(path.join(HERE, "audience-raw.json"), "utf8"));
const WORLD = JSON.parse(fs.readFileSync(path.join(HERE, "world-paths.json"), "utf8"));
const PAGES = 7;

/** The one-line headline fact under "Who reads", per title. */
function calloutFor(slug, p) {
  const fmt = (v) => (v == null ? "XX%" : `${(v * 100).toFixed(0)}%`);
  const role = (l) => p.roles.find((r) => r.label === l)?.pct ?? 0;
  const rest = `Profiled from ${p.records.toLocaleString("en-GB")} subscriber records by job title and company, not a self-selecting survey.`;
  if (slug === "barbering-business") return { figure: "XX%", lead: "are shop owners.", rest: "Job titles are being added to this list, so the figures marked XX follow." };
  if (slug === "smart-sme") return { figure: fmt(p.tiers[0].pct + p.tiers[1].pct), lead: "are company owners or directors.", rest };
  if (slug === "dental-business-news") {
    const d = role("Owner or principal dentist") + role("Associate dentist") + role("Specialist or consultant") + role("Dentist");
    return { figure: fmt(d), lead: "are dentists or practice owners, the people who choose what the practice buys.", rest: "Profiled from subscriber records by job title, not a survey." };
  }
  if (slug === "gym-business-news") return { figure: fmt(role("Personal trainer")), lead: `are personal trainers and ${fmt(p.managerPlus)} manage a gym or above.`, rest: "Profiled from subscriber records by job title, not a survey." };
  return { figure: fmt(p.managerPlus), lead: "sit at manager level or above.", rest };
}

/**
 * Adds the "Who reads" page to the pack as slide 3. The slide is a pptxgenjs
 * slide, so its XML is lifted in whole and its layout pointed at the
 * template's blank layout; its images are renamed so they cannot collide.
 */
async function spliceProfile(zip, slug, name, pal) {
  // Projected by default (JB, 20 Oct: estimates for the directors);
  // PROFILE_MODE=measured prints today's Mailchimp profile instead.
  const measured = process.env.PROFILE_MODE === "measured";
  const profile = measured ? computeProfile(slug, RAW[slug], WORLD) : projectedProfile(slug, PROFILES[slug].tiers, WORLD, regionOf);
  const { slideXml, relsXml, media } = await buildProfileSlide({
    name, pal, profile, world: WORLD, callout: measured ? calloutFor(slug, profile) : profile.callout, pageNo: 3, pages: PAGES,
  });
  let rels = relsXml
    .replace(/Target="\.\.\/slideLayouts\/slideLayout\d+\.xml"/, 'Target="../slideLayouts/slideLayout1.xml"')
    .replace(/<Relationship [^>]*notesSlide[^>]*\/>/g, "");
  for (const [file, buf] of Object.entries(media)) {
    zip.file(`ppt/media/profile-${file}`, buf);
    rels = rels.replaceAll(`../media/${file}`, `../media/profile-${file}`);
  }
  zip.file("ppt/slides/slide7.xml", slideXml);
  zip.file("ppt/slides/_rels/slide7.xml.rels", rels);

  let ct = await zip.file("[Content_Types].xml").async("string");
  ct = ct.replace("</Types>", '<Override PartName="/ppt/slides/slide7.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
  zip.file("[Content_Types].xml", ct);

  let prels = await zip.file("ppt/_rels/presentation.xml.rels").async("string");
  prels = prels.replace("</Relationships>", '<Relationship Id="rIdWhoReads" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide7.xml"/></Relationships>');
  zip.file("ppt/_rels/presentation.xml.rels", prels);

  let pres = await zip.file("ppt/presentation.xml").async("string");
  const ids = [...pres.matchAll(/<p:sldId id="(\d+)"[^>]*\/>/g)];
  const next = Math.max(...ids.map((m) => Number(m[1]))) + 1;
  const second = ids[1][0];
  pres = pres.replace(second, `${second}<p:sldId id="${next}" r:id="rIdWhoReads"/>`);
  zip.file("ppt/presentation.xml", pres);

  let app = await zip.file("docProps/app.xml").async("string");
  zip.file("docProps/app.xml", app.replace("<Slides>6</Slides>", `<Slides>${PAGES}</Slides>`));
  return profile;
}

// The benchmarks JB put on the Dental page. A title below one is not compared
// against it: the line says what the figure is measured over instead.
const OPEN_BENCH = 0.25;
const CLICK_BENCH = 0.02;

/* ------------------------------------------------------------------ titles */
// G is the cover and table ground, L the light type on it, A the accent used
// on white (bullets, mock-ups, results figures), INK the headline colour.
// Lifted from each title's brand-kit palette in cogent-base-theme specs.mjs,
// darkened where the reversed masthead would otherwise vanish into the ground.
const TITLES = {
  "dental-business-news": {
    keep: true,
    photos: ["dental-cover.jpg", "dental-close.jpg"], // JB's own words stay as he left them; photos replaced 20 Oct
    G: "0B5E63", L: "9FE3DD", A: "2BB3AA", INK: "0B1F24",
    noun: "dental professionals",
  },
  "smart-sme": {
    G: "151B6E", L: "A9B0FF", A: "2E3EEE", INK: "0A0C16",
    photos: ["sme-cover.jpg", "sme-close.jpg"],
    tagline: "For the people who own, run and grow UK small and mid-sized businesses.",
    para: "Smart SME goes to founders, managing directors, directors and managers of UK businesses with under 250 staff, in every sector.",
    noun: "business leaders",
    buys: [
      "Business software, AI and IT services",
      "Business finance, lending and payments",
      "Accountancy, tax and legal services",
      "HR, payroll and recruitment",
      "Insurance and business protection",
      "Marketing, sales and ecommerce tools",
    ],
  },
  "fleet-magazine": {
    G: "0F2D52", L: "8DBBF0", A: "1D5FAA", INK: "0E1726",
    photos: ["fleet-cover.jpg", "fleet-close.jpg"],
    tagline: "For the people who run, buy and fund UK vans, trucks and company cars.",
    para: "The Fleet Magazine goes to fleet directors, fleet managers and transport managers, and the finance and procurement people who share their decisions.",
    noun: "fleet decision makers",
    buys: [
      "Vehicle leasing, contract hire and funding",
      "Telematics, tracking and fleet software",
      "EV charging and electrification",
      "Fuel cards, tyres and maintenance",
      "Fleet insurance and risk management",
      "Driver training, compliance and recruitment",
    ],
  },
  "golf-resort-magazine": {
    G: "0F3D2B", L: "9FDDBB", A: "1F8A55", INK: "0F1F18",
    photos: ["golf-cover.jpg", "golf-close.jpg"],
    tagline: "For the people who own, run and supply golf resorts worldwide.",
    para: "Golf Resort Magazine goes to resort owners, general managers, directors of golf and course managers, and the developers and suppliers around them.",
    noun: "golf resort professionals",
    buys: [
      "Course machinery, irrigation and maintenance",
      "Golf carts and buggy fleets",
      "Tee-time, booking and club software",
      "Clubhouse, hospitality and food and drink",
      "Course design, construction and renovation",
      "Marketing, tour operators and travel partners",
    ],
  },
  "barbering-business": {
    G: "6E2B2B", L: "F0B9B5", A: "A84540", INK: "171310",
    mark: "wordmark-stacked-reversed",
    photos: ["barbering-cover.jpg", "barbering-close.jpg"],
    tagline: "For the people who own, run and rent chairs in UK barbershops.",
    para: "Barbering Business goes to barbershop owners and managers, and the self-employed barbers who buy their own kit.",
    noun: "barbering professionals",
    buys: [
      "Clippers, trimmers and tools",
      "Chairs, fit-out and shop furniture",
      "Booking, payments and EPOS software",
      "Grooming products and retail stock",
      "Insurance, accountancy and finance",
      "Education, training and recruitment",
    ],
  },
  "airport-business-magazine": {
    G: "123B66", L: "9CCBF5", A: "2A78C8", INK: "0D1321",
    photos: ["airport-cover.jpg", "airport-close.jpg"],
    tagline: "For the people who run, build and equip airports worldwide.",
    para: "Airport Business Magazine goes to airport chief executives, commercial directors and the heads of security, operations, passenger experience and cargo.",
    noun: "airport professionals",
    buys: [
      "Security screening and detection",
      "Baggage handling and ground equipment",
      "Terminal technology and passenger systems",
      "Retail, food and drink concessions",
      "Construction, design and engineering",
      "Cargo, logistics and sustainability",
    ],
  },
  "gym-business-news": {
    G: "16181B", L: "FF7A70", A: "D62828", INK: "16181B",
    mark: "wordmark-stacked-reversed",
    photos: ["gym-cover.jpg", "gym-close.jpg"],
    tagline: "For the people who own and run gyms, studios and personal training businesses.",
    para: "Gym Business News goes to owners and managers of independent gyms and studios, self-employed personal trainers and fitness franchisees.",
    noun: "fitness business owners and managers",
    buys: [
      "Gym equipment and strength kit",
      "Membership, booking and payments software",
      "Flooring, fit-out and facilities",
      "Insurance, accountancy and finance",
      "Supplements and retail stock",
      "Marketing, training and recruitment",
    ],
  },
  "nursery-daily": {
    G: "9E1F4D", L: "F8B4CB", A: "D6336C", INK: "1A1712",
    photos: ["nursery-cover.jpg", "nursery-close.jpg"],
    tagline: "For the people who own, run, fund and supply UK early years settings.",
    para: "Nursery Daily goes to nursery owners, directors and managers, group operations and finance leads, and childminders running their own business.",
    noun: "early years professionals",
    buys: [
      "Nursery management software and parent apps",
      "Furniture, toys and learning resources",
      "Food, catering and supplies",
      "Finance, valuation and M&A advice",
      "Insurance, HR and payroll",
      "Recruitment, training and qualifications",
    ],
  },
  "senior-lifestyle-business": {
    G: "4A1427", L: "E3A3B9", A: "9E3358", INK: "1C1720",
    photos: ["senior-cover.jpg", "senior-close.jpg"],
    tagline: "For the people who develop, fund and run retirement communities.",
    para: "Senior Lifestyle Business goes to operator chief executives, finance and development directors, village general managers, investors and lenders.",
    noun: "senior living professionals",
    buys: [
      "Development, construction and design",
      "Resident and assistive technology",
      "Sales, marketing and resident acquisition",
      "Finance, investment and lending",
      "Hospitality, catering and facilities",
      "Legal, planning and advisory services",
    ],
  },
  "smart-farming-news": {
    G: "1E441E", L: "A8DC86", A: "3E8E2F", INK: "12151A",
    mark: "wordmark-stacked-reversed",
    photos: ["farming-cover.jpg", "farming-close.jpg"],
    tagline: "For the people who own, run, finance and advise UK farms and rural businesses.",
    para: "Smart Farming News goes to farm owners, tenant farmers and estate managers, and the land agents, accountants and lenders who advise them.",
    noun: "farming professionals",
    buys: [
      "Farm machinery and precision technology",
      "Farm software, data and drones",
      "Renewable energy and diversification",
      "Agri-finance, lending and tax advice",
      "Insurance and land agency",
      "Feed, seed and livestock technology",
    ],
  },
};

/* ----------------------------------------------------------------- helpers */
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const tint = (h, t) => toHex(hex(h).map((v) => v + (255 - v) * t));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const n0 = (v) => (v == null ? "XX" : Math.round(v).toLocaleString("en-GB"));
const pct = (v, dp) => (v == null ? "XX%" : `${(v * 100).toFixed(dp)}%`);

/** Replace one whole text run, and insist it was there. */
function swapRun(xml, from, to, file) {
  const needle = `<a:t>${esc(from)}</a:t>`;
  if (!xml.includes(needle)) throw new Error(`${file}: run not found: ${from}`);
  return xml.split(needle).join(`<a:t>${esc(to)}</a:t>`);
}

/** Point the colour of the run holding `text` at a placeholder, before the palette swap. */
function recolourRun(xml, text, from, placeholder) {
  const re = new RegExp(`(<a:r>(?:(?!</a:r>).)*?)val="${from}"((?:(?!</a:r>).)*?<a:t>${text}</a:t>)`);
  if (!re.test(xml)) throw new Error(`run colour not found: ${text}`);
  return xml.replace(re, `$1val="${placeholder}"$2`);
}

async function photo(file) {
  // The photo frame on the cover and closing page is 4288536 x 7562088 EMU.
  // Photos are from the titles' own published articles (photos/), chosen
  // 20 Oct 2026 after JB rejected the brand-kit stock ones.
  return sharp(path.join(HERE, "photos", file))
    .resize(1200, Math.round(1200 / (4288536 / 7562088)), { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 84 })
    .toBuffer();
}

/* ------------------------------------------------------------------- build */
async function build(slug) {
  const t = TITLES[slug];
  const s = STATS.sites[slug];
  const name = s.name;
  const domain = s.domain;
  const e = s.email ?? {};
  const w = s.web ?? {};
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));

  const openLine = e.openRate == null ? "average open rate." :
    e.openRate >= OPEN_BENCH ? "average open rate against an industry average of 25%." :
    `average open rate across our last ${e.sends} issues.`;
  const clickLine = e.clickRate == null ? "average click rate." :
    e.clickRate >= CLICK_BENCH ? "average click rate against an industry average of 2%." :
    `average click rate across our last ${e.sends} issues.`;

  // Palette: every colour in JB's file mapped to its counterpart for this title.
  const pal = {
    "0B5E63": t.G, "2BB3AA": t.A, "9FE3DD": t.L, "0B1F24": t.INK,
    "428286": tint(t.G, 0.22), "F1F6F6": tint(t.G, 0.94), "D8E4E4": tint(t.G, 0.84),
    "3C7E82": tint(t.G, 0.2), "7FB8B8": tint(t.G, 0.475), "9FC4C4": tint(t.G, 0.607), "DCEAEA": tint(t.G, 0.857),
    LLLLLL: t.L,
  };
  const recolour = (xml) => xml.replace(/srgbClr val="([0-9A-Z]{6})"/g, (m, c) => `srgbClr val="${pal[c] ?? c}"`);

  const edits = {
    1: (x) => t.keep ? x : swapRun(x, "For the people who own, run, buy and finance UK dental practices.", t.tagline, "cover"),
    2: (x) => {
      if (!t.keep) {
        x = swapRun(x, "Dental Business News goes to owners, principals, practice managers and the buyers from UK dental practices. ", t.para, "audience");
        const old = ["Practice management software and technology", "Equipment, chairs and imaging", "Practice finance and patient finance",
          "Valuation, brokerage and legal advice", "Accountancy, insurance and indemnity", "Recruitment, training and marketing"];
        old.forEach((o, i) => { x = swapRun(x, o, t.buys[i], "buys"); });
      }
      x = swapRun(x, "7,601", n0(s.subscribers), "subs");
      x = swapRun(x, "named dental professionals on the newsletter list, 7,358 of them in the UK.", `named ${t.noun} subscribed to the newsletter.`, "subs");
      x = swapRun(x, "21,804", n0(w.visits), "visits");
      x = swapRun(x, "48.3%", pct(e.openRate, 1), "open");
      x = swapRun(x, "average open rate against an industry average of 25%.", openLine, "open");
      x = swapRun(x, "6.54%", pct(e.clickRate, 2), "click");
      x = swapRun(x, "average click rate against an industry average of 2%.", clickLine, "click");
      return x;
    },
    3: (x) => t.keep ? x :
      swapRun(swapRun(x,
        "Your story in “The Monday Check-Up”, next to our editorial and labelled as sponsored.",
        "Your story in our Monday Briefing, next to our editorial and labelled as sponsored.", "sponsored"),
        "Your brand as the named sponsor of every issue of The Monday Check-Up.",
        "Your brand as the named sponsor of every issue of our Monday Briefing.", "sponsorship"),
    4: (x) => {
      x = recolourRun(x, "TALK IT THROUGH", "2BB3AA", "LLLLLL");
      return t.keep ? x : swapRun(x, "Named sponsor of The Monday Check-Up", "Named sponsor of the Monday Briefing", "rates");
    },
    5: (x) => {
      x = recolourRun(x, "WHEN YOU GET A REPORT", "2BB3AA", "LLLLLL");
      x = swapRun(x, "7,601", n0(s.subscribers), "delivered");
      x = swapRun(x, "48.3%", pct(e.openRate, 1), "opens");
      x = swapRun(x, "6.5%", pct(e.clickRate, 1), "clicks");
      x = swapRun(x, "13.4%", pct(e.clickToOpen, 1), "cto");
      x = swapRun(x, "0.08%", pct(e.unsubRate, 2), "unsubs");
      x = swapRun(x, "21,804", n0(w.visits), "visits");
      x = swapRun(x, "12,615", n0(w.users), "users");
      return x;
    },
    6: (x) => x,
  };

  // Masthead, scaled into the box Dental's sits in without distorting it.
  const markSvg = path.join(BRAND, "dist", slug, `${t.mark ?? "wordmark-reversed"}.svg`);
  const markPng = await sharp(markSvg, { density: 900 }).resize({ width: 2080, withoutEnlargement: true }).png().toBuffer();
  const mm = await sharp(markPng).metadata();
  const ratio = mm.width / mm.height;
  const MAXW = 3108960, MAXH = 882396; // 3.4in x 0.965in
  let mw = Math.min(MAXW, MAXH * ratio);
  let mh = mw / ratio;
  mw = Math.round(mw); mh = Math.round(mh);

  for (let i = 1; i <= 6; i++) {
    const f = `ppt/slides/slide${i}.xml`;
    let x = await zip.file(f).async("string");
    x = edits[i](x);
    x = x.replaceAll("DENTALBUSINESSNEWS.COM", domain.toUpperCase())
      .replaceAll("dentalbusinessnews.com", domain)
      .replaceAll("DENTAL BUSINESS NEWS", name.toUpperCase())
      .replaceAll("Dental Business News", name);
    // The new page goes in at 3, so everything after it moves up one.
    const renumber = { 2: 2, 3: 4, 4: 5, 5: 6 };
    if (renumber[i]) x = swapRun(x, `${i} / 6`, `${renumber[i]} / ${PAGES}`, "page number");
    if (i === 1 || i === 6) {
      x = x.replace(/(<a:blip r:embed="rId4"\/>(?:(?!<\/p:pic>).)*?<a:ext )cx="\d+" cy="\d+"/, `$1cx="${mw}" cy="${mh}"`);
    }
    zip.file(f, recolour(x));
  }

  // Speaker notes: where each figure came from, not the Dental build notes.
  const pulled = new Date(STATS.pulledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
  const notes = {
    2: `Subscribers: Mailchimp, subscribed members on ${pulled}. Open and click rates: pooled across all ${e.sends ?? "XX"} issues sent to this list. Visits: GA4 sessions, ${w.from} to ${w.to}.`,
    5: `Delivered is the current list size. Rates pooled across ${e.sends ?? "XX"} issues. Visits and unique visitors: GA4 sessions and total users, ${w.from} to ${w.to}.`,
  };
  for (let i = 1; i <= 6; i++) {
    const f = `ppt/notesSlides/notesSlide${i}.xml`;
    let x = await zip.file(f).async("string");
    let first = true;
    x = x.replace(/<a:t>([^<]*)<\/a:t>/g, (m, txt) => {
      if (/^\d+$/.test(txt)) return m; // slide number field
      const out = first && notes[i] ? esc(notes[i]) : "";
      first = false;
      return `<a:t>${out}</a:t>`;
    });
    zip.file(f, x);
  }

  for (const f of ["docProps/core.xml", "docProps/app.xml"]) {
    const x = await zip.file(f).async("string");
    zip.file(f, x.replaceAll("Dental Business News", esc(name)));
  }

  zip.file("ppt/media/image1.jpg", await photo(t.photos[0]));
  zip.file("ppt/media/image3.jpg", await photo(t.photos[1]));
  if (slug !== "dental-business-news") zip.file("ppt/media/image2.png", markPng);
  const prof = await spliceProfile(zip, slug, name, t);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${name} Advertiser Pack.pptx`);
  fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`${slug.padEnd(28)} subs ${n0(s.subscribers)}  visits ${n0(w.visits)}  open ${pct(e.openRate, 1)}  click ${pct(e.clickRate, 2)}  mgr+ ${prof.managerPlus == null ? "XX" : pct(prof.managerPlus, 0)}  ->  ${path.basename(out)}`);
}

const only = process.argv[2];
for (const slug of Object.keys(TITLES)) if (!only || only === slug) await build(slug);
