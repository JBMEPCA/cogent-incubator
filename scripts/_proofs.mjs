// Dry-run today's Monday briefing for every title and save the real HTML.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { runBriefing } from "../lib/briefing.js";
import { siteCredentials } from "../lib/site.js";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/proofs";
fs.mkdirSync(SP, { recursive: true });
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const out = [];
for (const site of sites) {
  try {
    const { creds } = await siteCredentials(site.id);
    const r = await runBriefing(site, { creds, dryRun: true });
    if (r.skipped) { console.log(`${site.slug.padEnd(27)} SKIPPED: ${r.skipped}`); out.push({ slug: site.slug, skipped: r.skipped }); continue; }
    fs.writeFileSync(`${SP}/${site.slug}.html`, r.html);
    console.log(`${site.slug.padEnd(27)} ok  "${r.subject}"  lead: ${String(r.featured?.title||"").replace(/<[^>]+>/g,"").slice(0,46)}${r.healthWarning ? `  [${r.healthWarning.slice(0,40)}]` : ""}`);
    out.push({ slug: site.slug, name: site.name, subject: r.subject, previewText: r.previewText, fromName: r.fromName, featured: r.featured, mostRead: r.mostRead, healthWarning: r.healthWarning, bytes: r.html.length });
  } catch (e) {
    console.log(`${site.slug.padEnd(27)} FAILED: ${e.message.slice(0,110)}`);
    out.push({ slug: site.slug, error: e.message });
  }
}
fs.writeFileSync(`${SP}/index.json`, JSON.stringify(out, null, 1));
await p.$disconnect();
