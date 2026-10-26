import { mc } from "../lib/newsletter.js";
const lists = await mc(`/lists?count=50&fields=lists.id,lists.name,lists.stats.member_count`);
const name = Object.fromEntries(lists.lists.map((l) => [l.id, `${l.name} (${l.stats.member_count} members)`]));
const r = await mc(`/reports?count=200&type=regular&since_send_time=2026-10-01T00:00:00Z&fields=reports.list_id,reports.campaign_title,reports.send_time,reports.emails_sent,reports.opens.unique_opens,reports.clicks.clicks_total,reports.clicks.unique_subscriber_clicks`);
const by = {};
for (const x of r.reports || []) {
  const k = name[x.list_id] || x.list_id;
  const b = (by[k] ||= { issues: 0, sent: 0, opens: 0, clicks: 0, clickers: 0 });
  b.issues++; b.sent += x.emails_sent; b.opens += x.opens?.unique_opens || 0; b.clicks += x.clicks?.clicks_total || 0; b.clickers += x.clicks?.unique_subscriber_clicks || 0;
}
for (const [k, b] of Object.entries(by).sort((a, b) => b[1].clicks - a[1].clicks)) console.log(k.slice(0, 50).padEnd(52), `issues ${b.issues} sent ${b.sent} uniqueOpens ${b.opens} clicks ${b.clicks} clickers ${b.clickers}`);
