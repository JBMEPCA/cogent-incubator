import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { lastIssueHealth, lastIssueSentAt } from "../lib/newsletter.js";
const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const rows = await prisma.siteCredential.findMany({ where: { siteId: s.id } });
  const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
  const aid = creds.mailchimp?.audienceId;
  if (!aid) { console.log(`${s.slug}: no audience`); continue; }
  const h = await lastIssueHealth(aid);
  let sent = null;
  try { sent = await lastIssueSentAt(aid, { kind: "weekly" }); } catch (e) { sent = "err:" + e.message; }
  console.log(`${s.slug.padEnd(28)} ok=${h.ok} ${h.first ? "FIRST SEND" : `bounce=${(h.bounceRate*100).toFixed(2)}% complaint=${(h.complaintRate*100).toFixed(3)}% opens=${((h.opens||0)*100).toFixed(1)}% sent=${h.emailsSent} "${h.campaign}"`} ${h.reasons?.length ? "BLOCKED: " + h.reasons.join(", ") : ""} lastWeekly=${sent}`);
}
await prisma.$disconnect();
