import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const aid = creds.mailchimp.audienceId;
const { reports } = await mc(`/reports?count=200&sort_field=send_time&sort_dir=DESC`);
const mine = reports.filter((x) => x.list_id === aid && x.emails_sent);
for (const r of mine.slice(0, 5)) {
  console.log(`${r.send_time.slice(0,10)}  sent ${String(r.emails_sent).padStart(5)}  hard ${String(r.bounces?.hard_bounces ?? 0).padStart(4)}  soft ${String(r.bounces?.soft_bounces ?? 0).padStart(4)}  abuse ${String(r.abuse_reports ?? 0).padStart(3)}  unsub ${String(r.unsubscribed ?? 0).padStart(3)}  open ${( (r.opens?.open_rate ?? 0)*100).toFixed(1)}%  | ${r.campaign_title}`);
  console.log(`      complaint rate ${(((r.abuse_reports ?? 0) / r.emails_sent) * 100).toFixed(4)}%   hard-bounce rate ${((((r.bounces?.hard_bounces ?? 0)) / r.emails_sent) * 100).toFixed(2)}%`);
}
await prisma.$disconnect();
