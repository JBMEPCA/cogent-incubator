import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=60&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const r = reports.find((x) => x.list_id === aid && x.send_time && new Date(x.send_time) > new Date("2026-09-24T00:00:00Z"));
  if (!r) continue;
  const clicks = r.clicks || {};
  console.log(
    `${s.slug.padEnd(28)} ${uk(r.send_time)} sent ${String(r.emails_sent).padStart(5)} | opens ${(100 * (r.opens?.open_rate || 0)).toFixed(1)}% (${r.opens?.unique_opens}) | clicks ${(100 * (clicks.click_rate || 0)).toFixed(2)}% (${clicks.unique_subscriber_clicks}) | hard ${r.bounces?.hard_bounces} soft ${r.bounces?.soft_bounces} | unsub ${r.unsubscribed} | abuse ${r.abuse_reports}`
  );
}
await p.$disconnect();
