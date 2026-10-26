/**
 * Turns each title's subscriber records (audience-raw.json, from
 * pull-audience-profile.mjs) into the percentages on its "Who reads" page:
 * seniority, most common roles, geography, and the panels each sector's buyer
 * cares about.
 *
 * WHAT IS REAL AND WHAT IS XX. Job title, country and industry are on every
 * Mailchimp record, so seniority, roles, geography and (where the industry
 * code is meaningful) sector are measured. Turnover, fleet size, NHS vs
 * private, chain vs independent and the like are held nowhere, so those panels
 * carry XX for JB to fill or for an enrichment pass to measure. Barbering's
 * records have job titles on only 3%, so its roles and seniority are XX too.
 *
 * Percentages are of records that carry the field, never of the whole list
 * with blanks counted as a category.
 */

/* ------------------------------------------------------------- seniority */
// First match wins, so the order is the precedence.
const TIER_RULES = [
  ["director", /vice president|\bvp\b|\bsvp\b|\bevp\b/],
  ["owner", /\b(owner|co-?owner|founder|co-?founder|proprietor|ceo|chief|president|principal|principle|partner|chair(man|woman|person)?|managing director|\bmd\b|farmer)\b/],
  ["director", /director|head of\b/],
  ["manager", /manager|superintendent|supervisor|controller|\bhead\b|\blead\b|administrator|coordinator|officer/],
];
export function tierOf(t) {
  for (const [tier, re] of TIER_RULES) if (re.test(t)) return tier;
  return "other";
}

/* --------------------------------------------------------------- regions */
const ALIAS = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Dominican Republic": "Dominican Rep.",
  "Hong Kong": "China",
  "Singapore": "Malaysia",
};
export const REGIONS = ["UK and Ireland", "Europe", "North America", "Latin America", "Middle East and Africa", "Asia", "Australia and NZ"];
export function regionOf(name, lon, lat) {
  if (name === "United Kingdom" || name === "Ireland") return "UK and Ireland";
  if (name === "Australia" || name === "New Zealand") return "Australia and NZ";
  if (name === "Mexico") return "Latin America";
  if (lon < -30) return lat > 24 ? "North America" : "Latin America";
  if (lon >= -30 && lon < 45 && lat >= 35) return "Europe";
  if (lon >= 25 && lon < 63 && lat >= 12 && lat < 42) return "Middle East and Africa";
  if (lon >= -30 && lon < 55 && lat < 35) return "Middle East and Africa";
  if (lat < -10 && lon > 110) return "Australia and NZ";
  return "Asia";
}

/* ---------------------------------------------------------------- titles */
// tiers: the four boxes. roles: [label, regex], first match wins, top six
// shown. panels: three sector-specific breakdowns; rows with a measure key are
// computed, the rest are XX.
const T = (owner, director, manager, other) => ({ owner, director, manager, other });

export const PROFILES = {
  "smart-sme": {
    tiers: T("Owner, founder or MD", "Director", "Manager", "Other staff"),
    roles: [
      ["Managing director", /managing director|\bmd\b/],
      ["Chief executive", /chief executive|\bceo\b/],
      ["Founder or owner", /founder|owner|proprietor/],
      ["Operations director", /operations director|director of operations|chief operating|\bcoo\b/],
      ["Sales or commercial director", /(sales|commercial|business development).*director|director of (sales|business)/],
      ["Finance director", /financ\w* director|director of finance|chief financial|\bcfo\b/],
      ["Technical or production director", /(technical|engineering|production|it|technology) director|\bcto\b/],
      ["Marketing director", /marketing director|director of marketing|\bcmo\b/],
      ["Company director", /director/],
    ],
    panels: [
      { title: "Company turnover", rows: ["Under £1m", "£1m to £5m", "£5m to £25m", "£25m to £100m", "Over £100m"] },
      { title: "Sector", measure: "industry", top: 5 },
      { title: "Staff", rows: ["1 to 9", "10 to 49", "50 to 249", "250 or more"] },
    ],
    callout: "manager",
  },
  "fleet-magazine": {
    tiers: T("Owner or C-suite", "Director or head of", "Manager", "Engineers, admin and planners"),
    roles: [
      ["Transport manager", /transport manager|head of transport|transport (operations|team|compliance|planning) manager|(regional|group|operations) transport manager/],
      ["Depot manager", /depot/],
      ["Fleet manager", /fleet manager|head of fleet|fleet operations manager|group fleet|fleet director|fleet engineering manager/],
      ["Shift and first-line managers", /shift|first line|\bflm\b/],
      ["Fleet engineers", /fleet (support )?engineer|maintenance|workshop/],
      ["Fleet admin and coordinators", /fleet (administrator|coordinator|controller)|administrator|coordinator/],
      ["Operations directors", /director/],
    ],
    panels: [
      { title: "Fleet size", rows: ["Under 25 vehicles", "25 to 99", "100 to 499", "500 or more"] },
      { title: "Company turnover", rows: ["Under £10m", "£10m to £50m", "£50m to £250m", "Over £250m"] },
      { title: "Sector", measure: "industry", top: 5 },
    ],
    callout: "manager",
  },
  "airport-business-magazine": {
    tiers: T("CEO or managing director", "Director", "Manager", "Specialists"),
    roles: [
      ["Airport and station managers", /airport (manager|director|general manager)|station manager|airport team manager/],
      ["Duty and operations managers", /duty manager|operations manager|airport services manager|airport service manager/],
      ["Managing and executive directors", /managing director|executive director|chief executive|\bceo\b|president/],
      ["Operations directors", /director of operations|operations director|service director/],
      ["Commercial, sales and marketing", /commercial|sales|business development|marketing/],
      ["Engineering and maintenance", /technical|maintenance|engineer/],
      ["Finance and HR", /financ|human resources|\bhr\b|people/],
      ["Security", /security/],
      ["Cabin and in-flight services", /cabin|in-?flight|flight/],
      ["Directors, other functions", /director/],
    ],
    panels: [
      { title: "Organisation", measure: "industry", top: 4,
        groups: [["Airlines", /airlines/], ["Airports and terminals", /airport services|terminal/], ["Freight and logistics", /freight|logistics|courier/]] },
      { title: "Department", measure: "department",
        groups: [["Operations", /operation|duty|station|airport manager|airport team/], ["Commercial", /commercial|sales|business development|marketing|customer/], ["Engineering", /technical|maintenance|engineer/], ["Security", /security/], ["Finance and HR", /financ|human resources|\bhr\b|people/]] },
      { title: "Airport size, passengers a year", rows: ["Under 1m", "1m to 5m", "5m to 20m", "Over 20m"] },
    ],
    callout: "manager",
  },
  "golf-resort-magazine": {
    tiers: T("Owner or C-suite", "Director of golf or director", "Manager or head professional", "Golf professionals and staff"),
    roles: [
      ["Head golf professional", /head (golf )?professional/],
      ["Course superintendent", /superintendent|course manager|greenkeeper|course maintenance|golf course manager/],
      ["Director of golf", /director of golf|golf director/],
      ["Assistant golf professional", /assistant|associate/],
      ["General and club managers", /general manager|club manager|golf manager|operations manager/],
      ["Golf professional and instructor", /professional|\bpga\b|instructor|coach/],
      ["Pro shop and retail", /shop|retail|merchandis/],
    ],
    panels: [
      { title: "Venue type", measure: "industry", top: 4,
        groups: [["Members' clubs", /membership/], ["Golf courses and facilities", /golf courses|recreation|amusement/], ["Resorts and hotels", /hotels|resorts/], ["Developments", /land subdivision|real estate/]] },
      { title: "Ownership", rows: ["Independent", "Resort or hotel group", "Management company", "Members-owned"] },
      { title: "Holes", rows: ["9", "18", "27", "36 or more"] },
    ],
    callout: "manager",
  },
  "barbering-business": {
    tiers: T("Shop owner", "Multi-site owner or director", "Shop manager", "Barbers and chair renters"),
    unmeasured: true, // job titles on 3% of records
    roles: [["Shop owner"], ["Barber"], ["Chair renter"], ["Shop manager"], ["Multi-site owner"], ["Educator or trainer"]],
    panels: [
      { title: "Shop type", rows: ["Independent, one shop", "Small group, 2 to 4", "Chain, 5 or more", "Self-employed chair renter"] },
      { title: "UK region", rows: ["London", "South East", "Midlands", "North of England", "Scotland, Wales and NI"] },
      { title: "Chairs", rows: ["1 to 2", "3 to 5", "6 or more"] },
    ],
    callout: "owner",
  },
  "gym-business-news": {
    tiers: T("Owner or founder", "Director", "Gym or fitness manager", "Personal trainers and instructors"),
    roles: [
      ["Personal trainer", /personal trainer|personal fitness|\bpt\b/],
      ["Regional and area managers", /regional|district|area|cluster/],
      ["Fitness manager", /fitness manager/],
      ["Gym and club manager", /gym manager|club manager|general manager|site manager|spa area manager/],
      ["Owner or founder", /owner|founder|proprietor/],
      ["Instructor and coach", /instructor|coach/],
      ["Director", /director/],
    ],
    panels: [
      { title: "Business type", rows: ["Independent gym", "Boutique or class studio", "Franchise", "Chain site", "Self-employed PT"] },
      { title: "Turnover", rows: ["Under £100k", "£100k to £500k", "£500k to £1m", "Over £1m"] },
      { title: "Sites", rows: ["One", "2 to 4", "5 or more"] },
    ],
    callout: "manager",
  },
  "nursery-daily": {
    tiers: T("Owner or director", "Head or area director", "Nursery manager", "Practitioners and staff"),
    roles: [
      ["Nursery manager", /nursery manager|daycare manager|early years manager|head of nursery|setting manager/],
      ["Deputy manager", /deputy/],
      ["Owner or director", /owner|director|proprietor|founder/],
      ["Operations and area managers", /operations|area|regional|district|development manager|quality manager/],
      ["Practitioners and nursery nurses", /practitioner|nursery nurse|assistant|room leader|educator|supervisor/],
      ["Education and administration", /administrator|higher education|teaching/],
    ],
    panels: [
      { title: "Setting type", rows: ["Day nursery", "Pre-school", "Childminder", "Out-of-school club"] },
      { title: "Group size", rows: ["Single setting", "2 to 5 settings", "6 to 20", "Over 20"] },
      { title: "Turnover", rows: ["Under £500k", "£500k to £1m", "£1m to £5m", "Over £5m"] },
    ],
    callout: "manager",
  },
  "senior-lifestyle-business": {
    tiers: T("Owner or C-suite", "Director", "Manager", "Specialists"),
    roles: [
      ["Regional and area directors", /regional|district|area director|area manager/],
      ["General manager", /general manager|executive director|community director/],
      ["Operations director", /director of .*operations|operations director/],
      ["Operations manager", /operations manager/],
      ["Sales and marketing", /sales|marketing/],
      ["Facilities and property", /plant|facilit|maintenance|property/],
      ["Clinical and care", /clinical|nurs|wellness|care/],
      ["Chief executive or founder", /chief|ceo|president|founder/],
    ],
    panels: [
      { title: "Organisation", measure: "industry", top: 4,
        groups: [["Operators and care providers", /health services|social services/], ["Property and REITs", /real estate|holding|investment/], ["Developers and builders", /construction|subdivision|building/], ["Hospitality", /hotels/]] },
      { title: "Community size, residents", rows: ["Under 100", "100 to 250", "250 to 500", "Over 500"] },
      { title: "Operator turnover", rows: ["Under £10m", "£10m to £50m", "£50m to £250m", "Over £250m"] },
    ],
    callout: "manager",
  },
  "dental-business-news": {
    tiers: T("Owner or principal", "Director or clinical lead", "Practice manager", "Dentists, nurses and hygienists"),
    roles: [
      ["Owner or principal dentist", /principal|principle|owner|proprietor|founder|partner/],
      ["Practice manager", /practice manager|manager/],
      ["Associate dentist", /associate/],
      ["Specialist or consultant", /specialist|consultant|orthodont|endodont|periodont|implant/],
      ["Dentist", /dentist|dental surgeon|practitioner|dental officer|\bgdp\b/],
      ["Hygienist or therapist", /hygien|therapist/],
      ["Dental nurse", /nurse|dental assistant|sister/],
    ],
    panels: [
      { title: "Practice type", rows: ["Fully private", "Mostly private", "Mixed NHS and private", "Mostly NHS"] },
      { title: "Ownership", rows: ["Independent", "Small group, 2 to 9", "Corporate, 10 or more"] },
      { title: "Practice turnover", rows: ["Under £500k", "£500k to £1m", "£1m to £3m", "Over £3m"] },
    ],
    callout: "manager",
  },
  "smart-farming-news": {
    tiers: T("Farmer, owner or partner", "Director", "Farm manager", "Farm staff and specialists"),
    roles: [
      ["Farm manager", /farm (business |operations )?manager|agriculture manager|farm director|regional farm manager/],
      ["Farmer or owner", /farmer|owner|proprietor|partner/],
      ["Director or head", /director|head of|vice president/],
      ["Agronomists and specialists", /specialist|agronom|technician|consultant|advis|scientist/],
      ["Trading, buying and sales", /trader|sales|buyer|procurement/],
      ["Farm staff and supervisors", /farm hand|farm worker|stockman|tractor|supervisor|herdsman/],
    ],
    panels: [
      { title: "Farm type", rows: ["Arable", "Livestock", "Dairy", "Mixed"] },
      { title: "Farm size", rows: ["Under 100 ha", "100 to 500 ha", "500 to 1,000 ha", "Over 1,000 ha"] },
      { title: "Turnover", rows: ["Under £250k", "£250k to £1m", "£1m to £5m", "Over £5m"] },
    ],
    callout: "manager",
  },
};

/* ------------------------------------------------------------- compute */
const share = (n, d) => (d ? n / d : null);

export function computeProfile(slug, rows, world) {
  const P = PROFILES[slug];
  const titled = rows.map((r) => r.t.toLowerCase().trim()).filter(Boolean);

  // Seniority
  let tiers;
  if (P.unmeasured) tiers = ["owner", "director", "manager", "other"].map((k) => ({ label: P.tiers[k], pct: null }));
  else {
    const c = { owner: 0, director: 0, manager: 0, other: 0 };
    for (const t of titled) c[tierOf(t)]++;
    tiers = ["owner", "director", "manager", "other"].map((k) => ({ label: P.tiers[k], pct: share(c[k], titled.length) }));
  }
  const managerPlus = tiers[0].pct == null ? null : tiers[0].pct + tiers[1].pct + tiers[2].pct;

  // Roles
  let roles;
  if (P.unmeasured) roles = P.roles.map(([label]) => ({ label, pct: null }));
  else {
    const c = Object.fromEntries(P.roles.map(([l]) => [l, 0]));
    for (const t of titled) { const hit = P.roles.find(([, re]) => re.test(t)); if (hit) c[hit[0]]++; }
    roles = Object.entries(c).map(([label, n]) => ({ label, pct: share(n, titled.length) }))
      .sort((a, b) => b.pct - a.pct).slice(0, 6);
  }

  // Geography
  const byName = Object.fromEntries(world.countries.map((c) => [c.name, c]));
  const reg = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  const countries = {};
  let located = 0;
  for (const r of rows) {
    if (!r.c) continue;
    const name = ALIAS[r.c] ?? r.c;
    const w = byName[name];
    const region = w ? regionOf(name, w.lon, w.lat) : null;
    if (!region) continue;
    located++; reg[region]++; countries[name] = (countries[name] ?? 0) + 1;
  }
  let regions = REGIONS.map((label) => ({ label, pct: share(reg[label], located) })).sort((a, b) => b.pct - a.pct);
  if (regions.length > 5) {
    const rest = regions.slice(4).reduce((n, r) => n + r.pct, 0);
    regions = [...regions.slice(0, 4), { label: "Rest of world", pct: rest }];
  }
  // A title read in one place shows one region, not a row of 0.0% boxes.
  regions = regions.filter((r, i) => i === 0 || r.pct >= 0.001);
  const ukShare = share(countries["United Kingdom"] ?? 0, located);

  // Panels
  const panels = P.panels.map((p) => {
    if (p.rows) return { title: p.title, rows: p.rows.map((label) => ({ label, pct: null })) };
    if (p.measure === "industry" && !p.groups) {
      const c = {}; let n = 0;
      for (const r of rows) if (r.i) { c[r.i] = (c[r.i] ?? 0) + 1; n++; }
      // Industry codes are Apollo's SIC group names, too long for a panel row.
      const SHORT = {
        "Industrial & Commercial Machinery": "Industrial machinery", "Electronic & Electrical Equipment": "Electronics and electrical",
        "Food & Kindred Products": "Food and drink", "Engineering, Accounting & Management": "Professional services",
        "Freight Forwarding & Logistics": "Freight and logistics", "Specialty Trade Contractors": "Trade contractors",
        "Trucking — Long Distance": "Haulage", "Wholesale Trade — Durable Goods": "Wholesale", "Equipment Rental & Leasing": "Equipment hire",
        "Warehousing & Storage": "Warehousing", "Health Services": "Health services", "Business Services": "Business services",
      };
      const tidy = (s) => SHORT[s] ?? s.split(/ — |, /)[0].replace(/ & /g, " and ");
      const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, p.top);
      return { title: p.title, rows: top.map(([k, v]) => ({ label: tidy(k), pct: v / n })) };
    }
    const src = p.measure === "department" ? titled : rows.map((r) => r.i.toLowerCase()).filter(Boolean);
    const c = Object.fromEntries(p.groups.map(([l]) => [l, 0])); let other = 0;
    for (const v of src) { const hit = p.groups.find(([, re]) => re.test(v)); if (hit) c[hit[0]]++; else other++; }
    const total = src.length;
    const out = p.groups.map(([label]) => ({ label, pct: share(c[label], total) }));
    if (p.measure === "industry") out.push({ label: "Suppliers and other", pct: share(other, total) });
    return { title: p.title, rows: out.sort((a, b) => b.pct - a.pct).slice(0, 5) };
  });

  return {
    records: rows.length, titledShare: share(titled.length, rows.length),
    tiers, managerPlus, roles, regions, countries, located, ukShare, panels, callout: P.callout,
  };
}
