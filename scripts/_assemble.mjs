/**
 * The outreach sheet: verified brands we do NOT already receive content from.
 *
 * JB, 9 October: this is for signing up to new lists, so anything already
 * feeding us has no business on it. Three things count as already feeding us,
 * all built into known-domains.json: a live feed we pull, an item seen in the
 * last sixty days, or an email to one of our press@ addresses.
 *
 * Run: node --env-file=.env scripts/_assemble.mjs
 */
import fs from "node:fs";

const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const TITLES = [
  ["smart-sme", "Smart SME", "press@smartsme.co.uk"],
  ["fleet-magazine", "The Fleet Magazine", "press@thefleetmagazine.co.uk"],
  ["golf-resort-magazine", "Golf Resort Magazine", "press@golfresortmagazine.com"],
  ["barbering-business", "Barbering Business", "press@barberingbusiness.com"],
  ["airport-business-magazine", "Airport Business Magazine", "press@airportbusinessmagazine.com"],
  ["gym-business-news", "Gym Business News", "press@gymbusinessnews.com"],
  ["nursery-daily", "Nursery Daily", "press@nurserydaily.com"],
  ["senior-lifestyle-business", "Senior Lifestyle Business", "press@seniorlifestylebusiness.com"],
  ["dental-business-news", "Dental Business News", "press@dentalbusinessnews.com"],
  ["smart-farming-news", "Smart Farming News", "press@smartfarmingnews.com"],
];

const reg = (d) => {
  const h = String(d).toLowerCase().replace(/^www\./, "");
  const bits = h.split(".");
  return bits.length > 2 && bits.at(-2).length <= 3 && bits.at(-1).length <= 3 ? bits.slice(-3).join(".") : bits.slice(-2).join(".");
};
const known = new Set(JSON.parse(fs.readFileSync(`${SP}/known-domains.json`, "utf8")).map(reg));

const out = [];
let kept = 0, already = 0, dead = 0;
for (const [slug, name, email] of TITLES) {
  const file = `${SP}/verified-${slug}.json`;
  if (!fs.existsSync(file)) { console.log(`${slug.padEnd(28)} not verified yet, skipped`); continue; }
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  const picked = [];
  for (const r of rows) {
    if (!r.live) { dead++; continue; }
    if (known.has(reg(r.domain))) { already++; continue; }
    picked.push({ n: r.name, d: r.domain, u: r.press || r.site || `https://${r.domain}/`, p: r.press ? 1 : 0, b: r.bucket, w: r.why || "" });
  }
  kept += picked.length;
  out.push({ slug, name, email, rows: picked });
  console.log(`${slug.padEnd(28)} ${String(picked.length).padStart(3)} new  (${rows.filter((r) => r.live && known.has(reg(r.domain))).length} already feeding us, ${rows.filter((r) => !r.live).length} dead)`);
}
// The agencies tab is fleet-wide rather than per title, and the firms already
// emailing us are excluded by the same rule as everything else.
if (fs.existsSync(`${SP}/verified-agencies.json`)) {
  const rows = JSON.parse(fs.readFileSync(`${SP}/verified-agencies.json`, "utf8"))
    .filter((r) => r.live && !known.has(reg(r.domain)))
    .map((r) => ({ n: r.name, d: r.domain, u: r.press || r.site || `https://${r.domain}/`, p: r.press ? 1 : 0, b: r.bucket, w: r.why || "" }));
  out.push({ slug: "agencies", name: "Agencies and platforms", email: "any press@ address", rows });
  console.log(`${"agencies".padEnd(28)} ${String(rows.length).padStart(3)} new`);
}

fs.writeFileSync(`${SP}/outreach.json`, JSON.stringify(out));
console.log(`\n${kept} rows across ${out.length} titles. Removed ${already} we already receive from and ${dead} dead domains.`);
