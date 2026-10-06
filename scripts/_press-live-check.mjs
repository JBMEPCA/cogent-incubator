// Has the live press desk run? Counts state labels per title mailbox.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
const p = new PrismaClient();
const creds = await p.siteCredential.findMany({ where: { kind: "outreach" }, select: { payloadEnc: true, site: { select: { slug: true } } } });
const runs = await p.$queryRawUnsafe(`select count(*)::int n, max("startedAt") last from "AgentRun" where trigger='press' and "startedAt" > now() - interval '30 minutes'`);
await p.$disconnect();
let total = 0;
const rows = [];
for (const c of creds) {
  const u = decryptJson(c.payloadEnc).fromEmail; if (!u) continue;
  const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], u);
  const h = { Authorization: `Bearer ${tok}` };
  const labels = (await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", { headers: h })).json()).labels || [];
  const counts = [];
  for (const name of ["Press/Skipped", "Press/Published", "Press/Needs review", "Press/Scheduled"]) {
    const l = labels.find((x) => x.name === name); if (!l) continue;
    const d = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${l.id}`, { headers: h })).json();
    if (d.messagesTotal) { counts.push(`${name.split("/")[1]} ${d.messagesTotal}`); total += d.messagesTotal; }
  }
  rows.push(`${c.site.slug}: ${counts.join(", ") || "-"}`);
}
console.log(`press runs in last 30 min: ${runs[0].n} (last ${runs[0].last})`);
console.log(rows.join("\n"));
console.log(`LABELLED_TOTAL=${total}`);
