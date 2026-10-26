import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true, domain:true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "sftp" } });
  const cfg = rows.length ? decryptJson(rows[0].payloadEnc) : null;
  console.log(`${s.slug.padEnd(27)} url=${String(s.domain||"-").padEnd(38)} sftp=${cfg ? Object.keys(cfg).join(",") : "NONE"}`);
  if (cfg && s.slug === "smart-sme") console.log("   themePath:", cfg.themePath, "| port:", cfg.port, "| key:", cfg.privateKeyPath);
}
await p.$disconnect();
