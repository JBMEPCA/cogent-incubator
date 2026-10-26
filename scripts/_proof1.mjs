import { PrismaClient } from "@prisma/client";
import { runBriefing } from "../lib/briefing.js";
import { siteCredentials } from "../lib/site.js";
const p = new PrismaClient();
const site = await p.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
try { const r = await runBriefing(site, { creds, dryRun: true }); console.log(JSON.stringify({ ...r, html: r.html ? r.html.length + " bytes" : null }, null, 1).slice(0, 1200)); }
catch (e) { console.log(e.stack); }
await p.$disconnect();
