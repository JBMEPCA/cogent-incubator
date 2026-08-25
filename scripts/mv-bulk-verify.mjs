/**
 * Bulk-verify the head of each ranked prospect list with MillionVerifier.
 *
 * Same play as Smart SME's first tranche: one file upload per title instead of
 * the 200-a-day API drip, so launch day gets ~1,000 verified-good contacts per
 * title in one pass. The daily drip takes over from tranche 2.
 *
 * Reads ranked-<slug>.csv (from rank-prospects.mjs), takes the top SLICE live
 * rows that aren't already pre-verified, refuses to start without enough
 * credits for all of them, and writes mv-report-<slug>.csv next to the input.
 *
 * Run: node scripts/mv-bulk-verify.mjs [slice]
 */

import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("assets/mailchimpdata");
const SLICE = Number(process.argv[2]) || 1400;
const SLUGS = ["fleet-magazine", "golf-resort-magazine", "airport-business-magazine"];
const BULK = "https://bulkapi.millionverifier.com/bulkapi/v2";

const key = (process.env.MILLIONVERIFIER_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
if (!key) { console.error("MILLIONVERIFIER_API_KEY is not set"); process.exit(1); }

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const asObjects = (rows) => {
  const h = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((c, i) => [c, (r[i] ?? "").trim()])));
};

// ---- how much work is there, and can we afford it ----

const jobs = [];
for (const slug of SLUGS) {
  const ranked = asObjects(parseCSV(fs.readFileSync(path.join(DIR, `ranked-${slug}.csv`), "utf8")));
  const emails = ranked
    .filter((r) => r.suppressed !== "1" && !r.preVerified)
    .slice(0, SLICE)
    .map((r) => r.email);
  jobs.push({ slug, emails });
}
const need = jobs.reduce((n, j) => n + j.emails.length, 0);

const cRes = await fetch(`https://api.millionverifier.com/api/v3/credits?api=${key}`);
const credits = (await cRes.json()).credits;
console.log(`credits available: ${credits}, needed: ${need}`);
if (!Number.isFinite(credits)) { console.error("could not read credits"); process.exit(1); }
if (credits < need) {
  console.error(`not enough credits (${credits} < ${need}) — refusing to start a partial verify`);
  process.exit(1);
}

// ---- upload one file per title ----

for (const job of jobs) {
  const body = new FormData();
  body.append("key", key);
  body.append("file_contents", new Blob([job.emails.join("\n")], { type: "text/plain" }), `${job.slug}-tranche1.txt`);
  const res = await fetch(`${BULK}/upload?key=${key}`, { method: "POST", body });
  const d = await res.json().catch(async () => ({ raw: await res.text?.() }));
  if (!res.ok || !d.file_id) {
    console.error(`${job.slug}: upload failed:`, JSON.stringify(d).slice(0, 400));
    process.exit(1);
  }
  job.fileId = d.file_id;
  console.log(`${job.slug}: uploaded ${job.emails.length} emails, file_id=${job.fileId}`);
}

// ---- poll until finished, then download ----

const started = Date.now();
while (jobs.some((j) => !j.done)) {
  if (Date.now() - started > 45 * 60 * 1000) { console.error("timed out after 45 minutes"); process.exit(1); }
  await new Promise((r) => setTimeout(r, 15000));
  for (const job of jobs) {
    if (job.done) continue;
    const res = await fetch(`${BULK}/fileinfo?key=${key}&file_id=${job.fileId}`);
    const d = await res.json().catch(() => ({}));
    if (String(d.status).toLowerCase() === "finished") {
      const dl = await fetch(`${BULK}/download?key=${key}&file_id=${job.fileId}&filter=all`);
      if (!dl.ok) { console.error(`${job.slug}: download failed http ${dl.status}`); process.exit(1); }
      const out = path.join(DIR, `mv-report-${job.slug}.csv`);
      fs.writeFileSync(out, await dl.text());
      job.done = true;
      console.log(`${job.slug}: finished — report at ${out}`);
    } else {
      console.log(`${job.slug}: ${d.status ?? "?"} ${d.percent ?? ""}%`);
    }
  }
}

// ---- summarize ----

for (const job of jobs) {
  const rep = asObjects(parseCSV(fs.readFileSync(path.join(DIR, `mv-report-${job.slug}.csv`), "utf8")));
  const counts = {};
  const qCol = Object.keys(rep[0] ?? {}).find((k) => /quality/i.test(k)) ?? "quality";
  for (const r of rep) counts[r[qCol] || "?"] = (counts[r[qCol] || "?"] ?? 0) + 1;
  console.log(`${job.slug}: ${JSON.stringify(counts)}`);
}
