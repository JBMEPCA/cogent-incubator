// Read-only: is there a "you're live" draft sitting in Senior Lifestyle
// Business's press mailbox for the Tunstall / ILOS release, and what does it
// say? Written because press_link_ask has never been set, so linkAskMode()
// returns "draft" and every reply since the desk went live has been parked.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const prisma = new PrismaClient();
const cred = await prisma.siteCredential.findFirst({
  where: { kind: "outreach", site: { slug: "senior-lifestyle-business" } },
  select: { payloadEnc: true, site: { select: { name: true } } },
});
await prisma.$disconnect();
const out = decryptJson(cred.payloadEnc);
console.log(`${cred.site.name}: outreach sender ${out.fromEmail}`);

const token = await getGoogleAccessToken(SCOPES, out.fromEmail);
const api = async (p) => {
  const res = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const t = await res.text();
  const j = t ? JSON.parse(t) : {};
  if (!res.ok) throw new Error(`${res.status} ${j?.error?.message || t.slice(0, 200)}`);
  return j;
};
const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";

function bodyOf(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const p of part.parts || []) {
    const got = bodyOf(p);
    if (got) return got;
  }
  return "";
}

const drafts = await api("/drafts?maxResults=25");
console.log(`\ndrafts in the mailbox: ${(drafts.drafts || []).length}`);
for (const d of drafts.drafts || []) {
  const full = await api(`/drafts/${d.id}?format=full`);
  const m = full.message;
  console.log("\n--------------------------------------------");
  console.log(`draft id   ${d.id}`);
  console.log(`to         ${hdr(m, "to")}`);
  console.log(`from       ${hdr(m, "from")}`);
  console.log(`subject    ${hdr(m, "subject")}`);
  console.log(`date       ${hdr(m, "date")}`);
  console.log(`threadId   ${m.threadId}`);
  console.log("----- body -----");
  console.log(bodyOf(m.payload).trim().slice(0, 1400));
}
