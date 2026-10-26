// Which mailbox does each title's engine actually read, and is press@ an alias on it?
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
const ADMIN = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({ where: { kind: "outreach" }, select: { payloadEnc: true, site: { select: { slug: true } } } });
await prisma.$disconnect();
const titles = creds.map(c => ({ slug: c.site.slug, ...decryptJson(c.payloadEnc) })).filter(t => t.fromEmail);
let token;
try { token = await getGoogleAccessToken(["https://www.googleapis.com/auth/admin.directory.user.alias.readonly","https://www.googleapis.com/auth/admin.directory.user.readonly"], ADMIN); }
catch (e) { console.log("no directory token:", e.message); process.exit(0); }
for (const t of titles.sort((a,b)=>a.slug.localeCompare(b.slug))) {
  const r = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(t.fromEmail)}/aliases`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(()=>({}));
  const aliases = (j.aliases||[]).map(a=>a.alias);
  const press = aliases.filter(a => a.startsWith("press@"));
  console.log(`${t.slug.padEnd(28)} reads ${String(t.fromEmail).padEnd(34)} press alias: ${press.length ? press.join(", ") : "NONE"}${r.ok ? "" : "  (" + r.status + " " + (j?.error?.message||"") + ")"}`);
}
