import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const prisma = new PrismaClient();
const s = await prisma.site.findFirst({ where: { slug: "barbering-business" } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: s.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const aid = creds.mailchimp.audienceId;
const list = await mc(`/lists/${aid}`);
console.log("LIST", JSON.stringify(list.stats, null, 1).slice(0, 900));
const camps = await mc(`/campaigns?count=40&list_id=${aid}&sort_field=send_time&sort_dir=DESC&fields=campaigns.id,campaigns.settings.title,campaigns.send_time,campaigns.emails_sent,campaigns.status,campaigns.recipients.list_id`);
for (const c of camps.campaigns || []) {
  if (c.recipients?.list_id !== aid) continue;
  console.log(c.send_time, String(c.emails_sent).padStart(5), c.status, c.settings.title);
}
await prisma.$disconnect();
