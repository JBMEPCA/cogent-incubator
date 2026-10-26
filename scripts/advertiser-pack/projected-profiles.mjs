/**
 * PROJECTED "Who reads" figures: what each title's readership should look
 * like at scale, with tens of thousands of subscribers, for JB to put in front
 * of his directors (20 Oct 2026).
 *
 * THESE ARE ESTIMATES, NOT MEASUREMENTS. They are judged from the shape of
 * each industry (how many owners, managers and specialists it has, how its
 * businesses split by size and type) and from what a mature trade title in
 * that sector typically reaches. The page says "projected" on it so nobody
 * reads them as data. The measured profile, from today's Mailchimp records,
 * is what audience-profile.mjs computes; switch back with PROFILE_MODE=measured.
 *
 * Every number is a percentage of readers. Tiers and panels sum to 100;
 * roles are the six largest and need not.
 */
export const PROJECTED = {
  "smart-sme": {
    tiers: [45, 30, 20, 5],
    callout: ["75%", "are owners, founders or directors."],
    roles: [["Managing director", 22], ["Founder or owner", 18], ["Operations director", 9], ["Finance director", 9], ["Sales or commercial director", 8], ["General or office manager", 7]],
    regions: [["UK and Ireland", 95], ["Europe", 3], ["Rest of world", 2]],
    panels: [
      ["Company turnover", [["Under £1m", 30], ["£1m to £5m", 32], ["£5m to £25m", 24], ["£25m to £100m", 10], ["Over £100m", 4]]],
      ["Sector", [["Professional services", 22], ["Manufacturing", 18], ["Retail and ecommerce", 14], ["Construction and trades", 13], ["Hospitality and leisure", 10]]],
      ["Staff", [["1 to 9", 28], ["10 to 49", 38], ["50 to 249", 27], ["250 or more", 7]]],
    ],
  },
  "fleet-magazine": {
    tiers: [6, 16, 58, 20],
    callout: ["80%", "sit at manager level or above."],
    roles: [["Fleet manager", 24], ["Transport manager", 22], ["Operations director", 10], ["Depot manager", 9], ["Procurement and finance", 8], ["Fleet engineer", 6]],
    regions: [["UK and Ireland", 92], ["Europe", 5], ["Rest of world", 3]],
    panels: [
      ["Fleet size", [["Under 25 vehicles", 20], ["25 to 99", 32], ["100 to 499", 30], ["500 or more", 18]]],
      ["Company turnover", [["Under £10m", 22], ["£10m to £50m", 30], ["£50m to £250m", 28], ["Over £250m", 20]]],
      ["Sector", [["Haulage and logistics", 30], ["Construction and trades", 18], ["Utilities and facilities", 14], ["Public sector", 12], ["Retail and distribution", 10]]],
    ],
  },
  "airport-business-magazine": {
    tiers: [8, 34, 44, 14],
    callout: ["86%", "sit at manager level or above."],
    roles: [["Operations managers", 18], ["Commercial and retail directors", 12], ["Security managers", 10], ["Engineering and estates", 9], ["Airport CEOs and MDs", 8], ["Passenger experience", 8]],
    regions: [["Europe", 28], ["North America", 22], ["UK and Ireland", 18], ["Middle East and Africa", 16], ["Asia", 16]],
    panels: [
      ["Organisation", [["Airport operators", 48], ["Suppliers and contractors", 26], ["Airlines and handlers", 16], ["Consultants and government", 10]]],
      ["Department", [["Operations", 34], ["Commercial", 20], ["Engineering", 16], ["Security", 14], ["Finance and HR", 10]]],
      ["Airport size, passengers a year", [["Under 1m", 22], ["1m to 5m", 30], ["5m to 20m", 28], ["Over 20m", 20]]],
    ],
  },
  "golf-resort-magazine": {
    tiers: [10, 24, 44, 22],
    callout: ["78%", "sit at manager level or above."],
    roles: [["General managers", 18], ["Directors of golf", 16], ["Course managers", 15], ["Head golf professionals", 14], ["Owners and investors", 8], ["Resort directors", 7]],
    regions: [["North America", 40], ["UK and Ireland", 22], ["Europe", 20], ["Asia", 8], ["Rest of world", 10]],
    panels: [
      ["Venue type", [["Resorts and hotels", 34], ["Members' clubs", 28], ["Golf courses", 24], ["Developments", 8], ["Suppliers", 6]]],
      ["Ownership", [["Independent", 44], ["Resort or hotel group", 26], ["Management company", 18], ["Members-owned", 12]]],
      ["Holes", [["9", 8], ["18", 52], ["27", 15], ["36 or more", 25]]],
    ],
  },
  "barbering-business": {
    tiers: [52, 8, 12, 28],
    callout: ["60%", "own a shop or run their own chair."],
    roles: [["Shop owner", 46], ["Self-employed chair renter", 18], ["Barber", 16], ["Shop manager", 10], ["Multi-site owner", 6], ["Educator or trainer", 4]],
    regions: [["UK and Ireland", 90], ["North America", 4], ["Europe", 4], ["Rest of world", 2]],
    panels: [
      ["Shop type", [["Independent, one shop", 58], ["Small group, 2 to 4", 16], ["Chain, 5 or more", 6], ["Self-employed chair renter", 20]]],
      ["UK region", [["North of England", 28], ["London", 22], ["Midlands", 18], ["South East", 16], ["Scotland, Wales and NI", 16]]],
      ["Chairs", [["1 to 2", 30], ["3 to 5", 50], ["6 or more", 20]]],
    ],
  },
  "gym-business-news": {
    tiers: [38, 8, 30, 24],
    callout: ["76%", "own, direct or manage a gym or studio."],
    roles: [["Gym or studio owner", 32], ["PT running own business", 20], ["Gym manager", 18], ["Fitness manager", 8], ["Franchisee", 6], ["Area or operations manager", 5]],
    regions: [["UK and Ireland", 75], ["North America", 10], ["Europe", 8], ["Australia and NZ", 4], ["Rest of world", 3]],
    panels: [
      ["Business type", [["Independent gym", 34], ["Boutique or class studio", 24], ["Self-employed PT", 22], ["Franchise", 12], ["Chain site", 8]]],
      ["Turnover", [["Under £100k", 34], ["£100k to £500k", 38], ["£500k to £1m", 16], ["Over £1m", 12]]],
      ["Sites", [["One", 70], ["2 to 4", 22], ["5 or more", 8]]],
    ],
  },
  "nursery-daily": {
    tiers: [30, 10, 42, 18],
    callout: ["82%", "own, direct or manage a setting."],
    roles: [["Nursery manager", 32], ["Owner or proprietor", 22], ["Nursery director", 10], ["Deputy manager", 9], ["Childminder", 8], ["Area or operations manager", 7]],
    regions: [["UK and Ireland", 96], ["Europe", 2], ["Rest of world", 2]],
    panels: [
      ["Setting type", [["Day nursery", 62], ["Pre-school", 18], ["Childminder", 12], ["Out-of-school club", 8]]],
      ["Group size", [["Single setting", 58], ["2 to 5 settings", 24], ["6 to 20", 11], ["Over 20", 7]]],
      ["Turnover", [["Under £500k", 40], ["£500k to £1m", 30], ["£1m to £5m", 22], ["Over £5m", 8]]],
    ],
  },
  "senior-lifestyle-business": {
    tiers: [14, 32, 40, 14],
    callout: ["86%", "sit at manager level or above."],
    roles: [["Village general managers", 20], ["Operations directors", 12], ["Sales and marketing directors", 11], ["Development directors", 9], ["Chief executives", 8], ["Investors and lenders", 7]],
    regions: [["UK and Ireland", 48], ["Australia and NZ", 24], ["North America", 18], ["Europe", 6], ["Rest of world", 4]],
    panels: [
      ["Organisation", [["Operators", 52], ["Developers and builders", 18], ["Investors and lenders", 16], ["Suppliers and advisers", 14]]],
      ["Community size, residents", [["Under 100", 26], ["100 to 250", 40], ["250 to 500", 24], ["Over 500", 10]]],
      ["Operator turnover", [["Under £10m", 30], ["£10m to £50m", 32], ["£50m to £250m", 24], ["Over £250m", 14]]],
    ],
  },
  "dental-business-news": {
    tiers: [38, 8, 30, 24],
    callout: ["76%", "own, lead or manage a practice."],
    roles: [["Practice owner or principal", 34], ["Practice manager", 28], ["Associate dentist", 14], ["Group operations and finance", 6], ["Dental specialist", 6], ["Treatment coordinator", 4]],
    regions: [["UK and Ireland", 96], ["Europe", 2], ["Rest of world", 2]],
    panels: [
      ["Practice type", [["Fully private", 28], ["Mostly private", 30], ["Mixed NHS and private", 26], ["Mostly NHS", 16]]],
      ["Ownership", [["Independent", 64], ["Small group, 2 to 9", 18], ["Corporate, 10 or more", 18]]],
      ["Practice turnover", [["Under £500k", 30], ["£500k to £1m", 34], ["£1m to £3m", 26], ["Over £3m", 10]]],
    ],
  },
  "smart-farming-news": {
    tiers: [48, 10, 26, 16],
    callout: ["84%", "own, direct or manage a farm business."],
    roles: [["Farm owner or partner", 40], ["Farm manager", 22], ["Tenant farmer", 10], ["Estate manager", 8], ["Land agent or adviser", 8], ["Agronomist", 5]],
    regions: [["UK and Ireland", 92], ["Europe", 4], ["Rest of world", 4]],
    panels: [
      ["Farm type", [["Arable", 30], ["Livestock", 28], ["Mixed", 26], ["Dairy", 16]]],
      ["Farm size", [["Under 100 ha", 34], ["100 to 500 ha", 42], ["500 to 1,000 ha", 14], ["Over 1,000 ha", 10]]],
      ["Turnover", [["Under £250k", 38], ["£250k to £1m", 36], ["£1m to £5m", 20], ["Over £5m", 6]]],
    ],
  },
};

/** Shapes a projection like computeProfile's output, so the page builder takes either. */
export function projectedProfile(slug, tierLabels, world, regionOf) {
  const P = PROJECTED[slug];
  const f = (n) => n / 100;
  const regions = P.regions.map(([label, v]) => ({ label, pct: f(v) }));
  const named = new Set(regions.map((r) => r.label));
  // Shade every country in a named region; "Rest of world" shades nothing.
  const countries = {};
  for (const c of world.countries) if (named.has(regionOf(c.name, c.lon, c.lat))) countries[c.name] = 1;
  return {
    projected: true,
    tiers: ["owner", "director", "manager", "other"].map((k, i) => ({ label: tierLabels[k], pct: f(P.tiers[i]) })),
    roles: P.roles.map(([label, v]) => ({ label, pct: f(v) })),
    regions, countries,
    panels: P.panels.map(([title, rows]) => ({ title, rows: rows.map(([label, v]) => ({ label, pct: f(v) })) })),
    callout: { figure: P.callout[0], lead: P.callout[1], rest: "Projected profile at scale, for planning. Measured figures replace these as the list is profiled." },
  };
}
