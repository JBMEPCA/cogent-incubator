/**
 * Every subscribed member of each title's Mailchimp audience, reduced to the
 * fields the "Who reads" page profiles: job title, country, industry, company,
 * address. Written raw to audience-raw.json (git-ignored scratch, personal
 * data) so the classifier can be tuned without re-pulling.
 *
 * Run: node scripts/advertiser-pack/pull-audience-profile.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.loadEnvFile(".env");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const key = process.env.MAILCHIMP_API_KEY.trim().replace(/^["']|["']$/g, "");
const mc = async (p) => {
  const r = await fetch(`https://${key.split("-").pop()}.api.mailchimp.com/3.0${p}`, { headers: { Authorization: "Basic " + Buffer.from(`x:${key}`).toString("base64") } });
  if (!r.ok) throw new Error(`Mailchimp ${r.status} ${p}`);
  return r.json();
};
const LISTS = {
  "smart-sme": "707a3f613c", "fleet-magazine": "7caa62e2bc", "golf-resort-magazine": "2f3226d63b",
  "barbering-business": "35319dae03", "airport-business-magazine": "fc5a96f64e", "gym-business-news": "a57d7246f4",
  "nursery-daily": "0edd196e2b", "senior-lifestyle-business": "f4e4773aca", "dental-business-news": "c393325424",
  "smart-farming-news": "b72c3e43c2",
};
const out = {};
for (const [slug, id] of Object.entries(LISTS)) {
  const rows = [];
  for (let o = 0; ; o += 1000) {
    const d = await mc(`/lists/${id}/members?status=subscribed&count=1000&offset=${o}&fields=members.merge_fields,members.location.country_code,total_items`);
    for (const m of d.members) {
      const f = m.merge_fields;
      const addr = typeof f.ADDRESS === "object" ? [f.ADDRESS.city, f.ADDRESS.state, f.ADDRESS.zip].filter(Boolean).join(", ") : f.ADDRESS || "";
      rows.push({ t: f.TITLE || "", c: f.COUNTRY || "", cc: m.location?.country_code || "", i: f.INDUSTRY || "", s: f.SIC || "", co: f.COMPANY || "", a: addr });
    }
    if (!d.members.length || rows.length >= d.total_items) break;
  }
  out[slug] = rows;
  const pc = (k) => Math.round(100 * rows.filter((r) => r[k]).length / rows.length);
  console.log(slug.padEnd(28), rows.length, `title ${pc("t")}% country ${pc("c")}% industry ${pc("i")}% company ${pc("co")}% address ${pc("a")}%`);
}
fs.writeFileSync(path.join(HERE, "audience-raw.json"), JSON.stringify(out));
