import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "linkedin" } });
  const c = rows.length ? decryptJson(rows[0].payloadEnc) : null;
  const es = await p.engineSetting.findMany({ where: { siteId: s.id, key: { contains: "social" } }, select: { key: true, value: true } });
  console.log(`${s.slug.padEnd(28)} cred=${c ? Object.keys(c).join(",") : "none"} ${c?.pageUrl || c?.vanityName || c?.organizationUrn || ""} | ${es.map((e) => e.key + "=" + e.value).join(" ")}`);
}
await p.$disconnect();
