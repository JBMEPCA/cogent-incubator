/**
 * Group-wide figures for the Cogent Multimedia overview pack: every live
 * Mailchimp audience, its size, and its email performance pooled over sends in
 * the last 90 days. Writes group-stats.json next to this file.
 *
 * Run: node scripts/advertiser-pack/pull-group-stats.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.loadEnvFile(".env");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const key = process.env.MAILCHIMP_API_KEY.trim().replace(/^["']|["']$/g, "");
const mc = async (p) => {
  const r = await fetch(`https://${key.split("-").pop()}.api.mailchimp.com/3.0${p}`, { headers: { Authorization: "Basic " + Buffer.from(`x:${key}`).toString("base64") } });
  if (!r.ok) throw new Error(`Mailchimp ${r.status}`);
  return r.json();
};
const since = new Date(Date.now() - 90 * 864e5).toISOString();
const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString();
const lists = (await mc(`/lists?count=200&fields=lists.id,lists.name,lists.stats.member_count`)).lists;
const reports = [];
for (let o = 0; ; o += 1000) {
  const d = await mc(`/reports?count=1000&offset=${o}&type=regular&since_send_time=${encodeURIComponent(yearAgo)}&fields=reports.list_id,reports.emails_sent,reports.send_time,reports.opens.unique_opens,reports.clicks.unique_subscriber_clicks,reports.bounces,total_items`);
  reports.push(...d.reports);
  if (!d.reports.length || reports.length >= d.total_items) break;
}
const out = {};
for (const l of lists) {
  const yr = reports.filter((r) => r.list_id === l.id && r.emails_sent > 0);
  const q = yr.filter((r) => r.send_time >= since);
  const del = q.reduce((n, r) => n + r.emails_sent - (r.bounces?.hard_bounces ?? 0) - (r.bounces?.soft_bounces ?? 0), 0);
  const op = q.reduce((n, r) => n + (r.opens?.unique_opens ?? 0), 0);
  const cl = q.reduce((n, r) => n + (r.clicks?.unique_subscriber_clicks ?? 0), 0);
  out[l.name] = { subscribers: l.stats.member_count, sendsYear: yr.length, emailsYear: yr.reduce((n, r) => n + r.emails_sent, 0), sends90: q.length, delivered90: del, opens90: op, clicks90: cl, openRate: del ? op / del : null, clickRate: del ? cl / del : null };
  console.log(l.name.padEnd(28), JSON.stringify(out[l.name]));
}
fs.writeFileSync(path.join(HERE, "group-stats.json"), JSON.stringify({ pulledAt: new Date().toISOString(), lists: out }, null, 2));
