import { mc } from "../lib/newsletter.js";
const d = await mc(`/reports?count=60&type=regular&sort_field=send_time&sort_dir=DESC`);
const rows = (d.reports || []).filter((r) => r.send_time > "2026-09-24T07:00" && r.send_time < "2026-09-24T09:00");
for (const r of rows) {
  const o = r.opens || {}, c = r.clicks || {}, b = r.bounces || {};
  console.log(`${r.campaign_title.slice(0, 40)}
  emails_sent ${r.emails_sent} | bounces hard ${b.hard_bounces} soft ${b.soft_bounces} syntax ${b.syntax_errors} | unsub ${r.unsubscribed} | abuse ${r.abuse_reports}
  opens: unique ${o.unique_opens} total ${o.opens_total} rate ${(100 * (o.open_rate || 0)).toFixed(2)}% proxy_excluded ${o.proxy_excluded_unique_opens ?? "n/a"} / ${o.proxy_excluded_open_rate !== undefined ? (100 * o.proxy_excluded_open_rate).toFixed(2) + "%" : "n/a"} last ${o.last_open || "-"}
  clicks: unique_subs ${c.unique_subscriber_clicks} unique ${c.unique_clicks} total ${c.clicks_total} rate ${(100 * (c.click_rate || 0)).toFixed(2)}% last ${c.last_click || "-"}`);
}
