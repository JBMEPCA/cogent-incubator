import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
const p = new PrismaClient();
const creds = await p.siteCredential.findMany({ where: { kind: "outreach" }, select: { payloadEnc: true, site: { select: { slug: true } } } });
await p.$disconnect();
for (const c of creds) {
  const u = decryptJson(c.payloadEnc).fromEmail; if (!u) continue;
  const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], u);
  const h = { Authorization: `Bearer ${tok}` };
  const q = "label:topics-press newer_than:3d -from:me";
  const l = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`, { headers: h })).json();
  const ids = l.messages || [];
  const subs = [];
  for (const { id } of ids.slice(0, 4)) {
    const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, { headers: h })).json();
    subs.push(m.payload.headers.map((x) => x.value).join(" | ").slice(0, 110));
  }
  console.log(c.site.slug, ids.length, "\n   " + subs.join("\n   "));
}
