import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
for (const slug of ["barbering-business","senior-lifestyle-business","gym-business-news","nursery-daily","airport-business-magazine","fleet-magazine"]) {
  const s = await p.site.findUnique({ where: { slug } });
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const l = await mc(`/lists/${aid}?fields=stats.member_count`);
  console.log(slug.padEnd(28), l.stats.member_count);
}
await p.$disconnect();
