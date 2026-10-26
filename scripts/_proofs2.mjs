// Render today's briefing for every title on the DEPLOYED app (WP REST is
// blocked from this machine), and save the HTML.
import fs from "node:fs";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/proofs";
fs.mkdirSync(SP, { recursive: true });
const BASE = "https://cogent-incubator.vercel.app", SECRET = process.env.CRON_SECRET;
const res = await fetch(`${BASE}/api/cron/briefing?dry=1`, { headers: { Authorization: `Bearer ${SECRET}` } });
const text = await res.text();
if (!res.ok) { console.log(`${res.status}: ${text.slice(0,300)}`); process.exit(1); }
const data = JSON.parse(text);
const rows = Array.isArray(data) ? data : data.results || Object.entries(data).map(([slug, v]) => ({ slug, ...v }));
const out = [];
for (const r of rows) {
  const slug = r.slug || r.site || "?";
  const v = r.result || r;
  if (v.html) { fs.writeFileSync(`${SP}/${slug}.html`, v.html); }
  console.log(`${String(slug).padEnd(27)} ${v.html ? "RENDERED" : (v.skipped ? "skipped: " + v.skipped : v.error ? "ERROR: " + String(v.error).slice(0,70) : JSON.stringify(v).slice(0,70))}  ${v.subject ? `"${v.subject}"` : ""}`);
  out.push({ slug, subject: v.subject, previewText: v.previewText, fromName: v.fromName, featured: v.featured, mostRead: v.mostRead, healthWarning: v.healthWarning, skipped: v.skipped, error: v.error });
}
fs.writeFileSync(`${SP}/index.json`, JSON.stringify(out, null, 1));
