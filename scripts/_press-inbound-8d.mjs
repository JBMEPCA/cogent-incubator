// Read-only: what actually arrived at each title's press@ in the last 8 days, per its own mailbox.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
const p = new PrismaClient();
const creds = await p.siteCredential.findMany({ where: { kind: "outreach" }, select: { payloadEnc: true, site: { select: { slug: true } } } });
await p.$disconnect();
for (const c of creds) {
  const u = decryptJson(c.payloadEnc).fromEmail; if (!u) continue;
  const press = `press@${u.split("@")[1]}`;
  const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], u);
  const h = { Authorization: `Bearer ${tok}` };
  const count = async (q) => ((await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=200`, { headers: h })).json()).messages || []).length;
  const toPress = await count(`to:${press} newer_than:8d -from:me`);
  const labelled = await count(`label:topics-press newer_than:8d -from:me deliveredto:${u}`);
  console.log(`${c.site.slug.padEnd(28)} to:${press.padEnd(34)} ${String(toPress).padStart(3)}   Topics/Press ${labelled}`);
}
