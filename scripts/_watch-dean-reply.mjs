/**
 * One-off: watch the Smart SME mailbox for Dean Butt's reply.
 *
 * Snapshots the message ids already in the thread, then polls every 5 minutes
 * and prints one line per NEW message from him. Exits on the first hit.
 * Also prints an ERROR line on repeated API failure, so silence means "still
 * waiting" and never "quietly broken".
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_watch-dean-reply.mjs
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const FROM = "dean@appleandbears.com";
const READ = ["https://www.googleapis.com/auth/gmail.readonly"];
const POLL_MS = 300000;

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

async function idsFromHim() {
  const token = await getGoogleAccessToken(READ, sender.email);
  const q = encodeURIComponent(`from:${FROM}`);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return { token, ids: (body.messages || []).map((m) => m.id) };
}

async function snippetOf(token, id) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const m = await res.json();
  const h = Object.fromEntries((m?.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  return `${h.subject || "(no subject)"} :: ${(m.snippet || "").slice(0, 240)}`;
}

const seen = new Set((await idsFromHim()).ids);
console.log(`watching ${sender.email} for a reply from ${FROM} (${seen.size} existing messages ignored)`);

let fails = 0;
for (;;) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  try {
    const { token, ids } = await idsFromHim();
    fails = 0;
    const fresh = ids.filter((id) => !seen.has(id));
    if (fresh.length) {
      for (const id of fresh) console.log(`REPLY from Dean Butt: ${await snippetOf(token, id)}`);
      process.exit(0);
    }
  } catch (e) {
    if (++fails >= 3) {
      console.log(`ERROR: Gmail poll failing repeatedly (${e.message.slice(0, 100)}) - watch is not reliable`);
      process.exit(1);
    }
  }
}
