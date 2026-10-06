// Recon: what has press@ already sent to SLB PR about the LFW releases?
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { outreachSender, inboundMatching } from "../lib/gmail.js";

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
console.log("press sender:", JSON.stringify(sender));

for (const q of ["in:sent to:slbpr.co.uk", "from:slbpr.co.uk"]) {
  const msgs = await inboundMatching(creds.outreach, q, 10);
  console.log(`\n=== ${q} -> ${msgs.length} ===`);
  for (const m of msgs) {
    console.log(`  ${m.date || m.internalDate || "?"} | from ${m.from || "?"} | to ${m.to || "?"}`);
    console.log(`  subj: ${m.subject}`);
    console.log(`  id=${m.id} threadId=${m.threadId} messageId=${m.messageId || "-"}`);
    console.log(`  ${String(m.text || m.snippet || "").replace(/\s+/g, " ").slice(0, 400)}\n`);
  }
}
await prisma.$disconnect();
