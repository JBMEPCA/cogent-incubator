import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const j = await mc(`/verified-domains?count=200`);
const doms = new Map((j.domains||[]).map(d => [String(d.domain).toLowerCase(), d]));
console.log(`${(j.domains||[]).length} domains on the account\n`);
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
console.log("title".padEnd(27) + "sends as".padEnd(40) + "that domain authenticated with Mailchimp?");
for (const s of sites) {
  const cr = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!cr.length) continue;
  const from = decryptJson(cr[0].payloadEnc).fromEmail || "?";
  const d = String(from.split("@")[1]||"").toLowerCase();
  const rec = doms.get(d);
  console.log(s.slug.padEnd(27) + from.padEnd(40) + (rec ? `verified=${rec.verified} authenticated=${rec.authenticated}` : "NOT on the account at all"));
}
await p.$disconnect();
