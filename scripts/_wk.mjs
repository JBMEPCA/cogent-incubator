import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=40&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
let sent = 0, human = 0, opens = 0;
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const r = reports.find((x) => x.list_id === aid && x.send_time > "2026-10-05T00:00");
  if (!r) { console.log(`${s.slug.padEnd(28)} no send`); continue; }
  const o = r.opens || {}, c = r.clicks || {};
  sent += r.emails_sent; human += c.subscriber_clicks_human ?? 0; opens += o.proxy_excluded_unique_opens ?? 0;
  console.log(
    `${s.slug.padEnd(28)} ${String(r.emails_sent).padStart(5)} | opens ${(100 * (o.proxy_excluded_open_rate || 0)).toFixed(1)}% (${o.proxy_excluded_unique_opens}) | human clicks ${String(c.subscriber_clicks_human ?? 0).padStart(3)} = ${(100 * (c.click_rate_human || 0)).toFixed(2)}% | recorded ${c.unique_subscriber_clicks} | unsub ${r.unsubscribed} abuse ${r.abuse_reports}`
  );
}
console.log(`\nFLEET sent ${sent}, opens ${opens}, human clicks ${human}`);
await p.$disconnect();
