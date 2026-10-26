/**
 * The audience and results figures for every title's advertiser pack, read
 * live: list size and email performance from Mailchimp, visits from GA4.
 *
 * Email rates are pooled across every sent regular campaign to the title's
 * audience (sum of unique opens over sum delivered), not an average of
 * per-issue rates, so one tiny send cannot skew them.
 *
 * Writes pack-stats.json next to this file, which build-advertiser-packs.mjs reads.
 *
 * Run: node scripts/advertiser-pack/pull-pack-stats.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../../lib/crypto.js";

process.loadEnvFile?.(".env");
// lib/newsletter.js drags in the agent runtime, so the one call it offers is inlined.
async function mc(p) {
  const key = process.env.MAILCHIMP_API_KEY.trim().replace(/^["']|["']$/g, "");
  const res = await fetch(`https://${key.split("-").pop()}.api.mailchimp.com/3.0${p}`, {
    headers: { Authorization: "Basic " + Buffer.from(`x:${key}`).toString("base64") },
  });
  if (!res.ok) throw new Error(`Mailchimp ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}
import { getGoogleAccessToken, googlePost } from "../../lib/google.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const p = new PrismaClient();

// The last 30 complete days.
const end = new Date(Date.now() - 864e5);
const start = new Date(end.getTime() - 29 * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);

const ga = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });

const reports = [];
for (let offset = 0; ; offset += 500) {
  const d = await mc(
    `/reports?count=500&offset=${offset}&type=regular&fields=reports.list_id,reports.emails_sent,reports.send_time,reports.opens,reports.clicks,reports.unsubscribed,reports.bounces,total_items`
  );
  reports.push(...(d.reports ?? []));
  if (reports.length >= (d.total_items ?? 0) || !(d.reports ?? []).length) break;
}

const out = {};
for (const s of sites) {
  const row = { name: s.name, domain: s.domain, launchedAt: s.launchedAt, audience: s.audience };
  const cred = async (kind) => {
    const r = await p.siteCredential.findFirst({ where: { siteId: s.id, kind } });
    return r ? decryptJson(r.payloadEnc) : null;
  };

  const m = await cred("mailchimp");
  if (m?.audienceId) {
    const l = await mc(`/lists/${m.audienceId}?fields=name,stats.member_count`);
    row.subscribers = l.stats.member_count;
    try {
      const loc = await mc(`/lists/${m.audienceId}/locations`);
      const gb = (loc.locations ?? []).find((x) => x.country === "United Kingdom" || x.cc === "GB");
      row.ukPercent = gb?.percent ?? null;
    } catch { row.ukPercent = null; }

    const mine = reports.filter((r) => r.list_id === m.audienceId && r.emails_sent > 0);
    const sum = (f) => mine.reduce((n, r) => n + (f(r) || 0), 0);
    const sent = sum((r) => r.emails_sent);
    const bounced = sum((r) => (r.bounces?.hard_bounces ?? 0) + (r.bounces?.soft_bounces ?? 0));
    const delivered = sent - bounced;
    const opens = sum((r) => r.opens?.unique_opens);
    const clicks = sum((r) => r.clicks?.unique_subscriber_clicks);
    const unsubs = sum((r) => r.unsubscribed);
    row.email = {
      sends: mine.length,
      delivered,
      avgDelivered: mine.length ? Math.round(delivered / mine.length) : null,
      openRate: delivered ? opens / delivered : null,
      clickRate: delivered ? clicks / delivered : null,
      clickToOpen: opens ? clicks / opens : null,
      unsubRate: delivered ? unsubs / delivered : null,
    };
  }

  const g = await cred("google_analytics");
  if (g?.ga4PropertyId) {
    try {
      const r = await googlePost(ga, `https://analyticsdata.googleapis.com/v1beta/properties/${String(g.ga4PropertyId).trim()}:runReport`, {
        dateRanges: [{ startDate: iso(start), endDate: iso(end) }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
      });
      const v = r.rows?.[0]?.metricValues ?? [];
      row.web = { from: iso(start), to: iso(end), visits: Number(v[0]?.value ?? 0), users: Number(v[1]?.value ?? 0), views: Number(v[2]?.value ?? 0) };
    } catch (e) { row.web = { error: String(e.message).slice(0, 80) }; }
  }
  out[s.slug] = row;
  console.log(s.slug.padEnd(28), JSON.stringify({ subs: row.subscribers, uk: row.ukPercent, ...row.email, ...row.web }));
}

fs.writeFileSync(path.join(HERE, "pack-stats.json"), JSON.stringify({ pulledAt: new Date().toISOString(), sites: out }, null, 2));
await p.$disconnect();
