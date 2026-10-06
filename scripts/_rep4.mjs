import { mc } from "../lib/newsletter.js";
const d = await mc(`/reports?count=20&type=regular&sort_field=send_time&sort_dir=DESC`);
for (const t of ["Dental Business News Weekly", "Smart SME Weekly"]) {
  const r = (d.reports || []).find((x) => x.campaign_title?.startsWith(t) && x.send_time > "2026-10-01");
  if (!r) { console.log(t, "not found"); continue; }
  console.log(t, JSON.stringify({ sent: r.emails_sent, bounces: r.bounces, opens: r.opens, clicks: r.clicks, status: r.delivery_status }, null, 1).slice(0, 900));
}
