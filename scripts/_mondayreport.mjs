import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=80&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
let sent = 0, delivered = 0;
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const r = reports.find((x) => x.list_id === aid && x.send_time > "2026-10-01T00:00");
  if (!r) { console.log(`${s.slug.padEnd(28)} NO SEND TODAY`); continue; }
  const o = r.opens || {}, c = r.clicks || {}, b = r.bounces || {};
  const del = r.emails_sent - (b.hard_bounces || 0) - (b.soft_bounces || 0);
  sent += r.emails_sent; delivered += del;
  console.log(
    `${s.slug.padEnd(28)} ${uk(r.send_time)} del ${String(del).padStart(5)} | opens ${(100 * (o.proxy_excluded_open_rate || 0)).toFixed(1)}% (raw ${(100 * (o.open_rate || 0)).toFixed(1)}%) | clickers ${c.unique_subscriber_clicks} of which links ${c.unique_clicks} | hard ${b.hard_bounces} soft ${b.soft_bounces} | unsub ${r.unsubscribed} abuse ${r.abuse_reports}`
  );
}
console.log(`\nsent ${sent}, delivered ${delivered}`);
await p.$disconnect();
