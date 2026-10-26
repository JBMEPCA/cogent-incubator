// Where did Kerry Phillips's correction land, and in which mailbox?
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const prisma = new PrismaClient();
const cred = await prisma.siteCredential.findFirst({
  where: { kind: "outreach", site: { slug: "senior-lifestyle-business" } },
  select: { payloadEnc: true },
});
await prisma.$disconnect();
const out = decryptJson(cred.payloadEnc);

const token = await getGoogleAccessToken(SCOPES, out.fromEmail);
const api = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || t.slice(0, 160)}`);
  return j;
};
const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";

console.log(`mailbox ${out.fromEmail}\n`);
const list = await api(`/messages?q=${encodeURIComponent("from:kerry@theehlersgroup.com OR ehlersgroup in:anywhere newer_than:7d")}&maxResults=10`);
for (const { id } of list.messages || []) {
  const m = await api(`/messages/${id}?format=metadata`);
  console.log(`id        ${id}`);
  console.log(`threadId  ${m.threadId}`);
  console.log(`from      ${hdr(m, "from")}`);
  console.log(`to        ${hdr(m, "to")}`);
  console.log(`deliv     ${hdr(m, "delivered-to")}`);
  console.log(`subject   ${hdr(m, "subject")}`);
  console.log(`date      ${hdr(m, "date")}`);
  console.log(`msgid     ${hdr(m, "message-id")}`);
  console.log(`labels    ${(m.labelIds || []).join(", ")}`);
  console.log("");
}
if (!(list.messages || []).length) console.log("nothing found in this mailbox");
