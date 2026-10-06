// Throwaway: read back what gmail-hub-setup.mjs and gmail-hub-label.mjs did.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const HUB = "jb@smartsme.co.uk";
const READ = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.settings.basic"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const get = async (token, path) =>
  fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true } } },
});
await prisma.$disconnect();
const titles = creds.map((c) => ({ name: c.site.name, ...decryptJson(c.payloadEnc) })).filter((t) => t.fromEmail);

const hub = await getGoogleAccessToken(READ, HUB);
const labels = (await get(hub, "/labels")).labels || [];
console.log(`HUB ${HUB}`);
for (const l of labels.filter((x) => x.type === "user").sort((a, b) => a.name.localeCompare(b.name))) {
  const d = await get(hub, `/labels/${l.id}`);
  console.log(`  ${d.name.padEnd(20)} threads=${d.threadsTotal} messages=${d.messagesTotal}`);
}
const filters = (await get(hub, "/settings/filters")).filter || [];
console.log(`  filters: ${filters.length}`);
const sendAs = (await get(hub, "/settings/sendAs")).sendAs || [];
for (const s of sendAs) console.log(`  send-as ${s.sendAsEmail} ${s.isPrimary ? "(primary)" : s.verificationStatus}`);

for (const t of titles) {
  if (t.fromEmail === HUB) continue;
  const tok = await getGoogleAccessToken(READ, t.fromEmail);
  const auto = await get(tok, "/settings/autoForwarding");
  const addrs = (await get(tok, "/settings/forwardingAddresses")).forwardingAddresses || [];
  const a = addrs.find((x) => x.forwardingEmail === HUB);
  console.log(
    `${t.fromEmail.padEnd(34)} forwarding=${auto.enabled ? `${auto.emailAddress} (${auto.disposition})` : "OFF"} address=${a?.verificationStatus || "missing"}`
  );
}
