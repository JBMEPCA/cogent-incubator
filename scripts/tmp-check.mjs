import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { isGmailConfigured } from "../lib/gmail.js";
const p = new PrismaClient();
for (const slug of ["barbering-business", "airport-business-magazine", "fleet-magazine", "smart-sme"]) {
  const site = await p.site.findUnique({ where: { slug } });
  const { creds, health } = await siteCredentials(site.id);
  const o = creds?.outreach || {};
  console.log(`${slug.padEnd(28)} gmail:${String(isGmailConfigured(o)).padEnd(6)} from:${(o.fromName||"?")} <${o.fromEmail||"none"}>  health:${health?.outreach?.healthy}`);
}
await p.$disconnect();
