// Snapshot everything a Monday proof needs for one title: site row, recent posts,
// last week's GA4 most-read (resolved to posts), and last Thursday's lead.
import fs from "node:fs"; import os from "node:os"; import { execFileSync } from "node:child_process";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const [slug, outDir] = process.argv.slice(2);
const site = await prisma.site.findUnique({ where: { slug } });
const { creds } = await siteCredentials(site.id);
const key = process.env.MAILCHIMP_API_KEY.trim().replace(/^["']|["']$/g, "");
const mc = async (p) => (await fetch(`https://${key.split("-").pop()}.api.mailchimp.com/3.0${p}`, { headers: { Authorization: "Basic " + Buffer.from(`x:${key}`).toString("base64") } })).json();

let ga = [];
const pid = creds.google_analytics?.ga4PropertyId;
if (pid) {
  const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
  const res = await googlePost(token, `https://analyticsdata.googleapis.com/v1beta/properties/${String(pid).trim()}:runReport`, {
    dateRanges: [{ startDate: "2026-09-07", endDate: "2026-09-13" }], dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 80,
  });
  ga = (res.rows || []).map((r) => ({ path: r.dimensionValues[0].value, views: Number(r.metricValues[0].value) }));
}

let thursday = null;
const aud = creds.mailchimp?.audienceId;
if (aud) {
  const c = await mc(`/campaigns?list_id=${aud}&status=sent&count=1&sort_field=send_time&sort_dir=DESC&fields=campaigns.id,campaigns.send_time,campaigns.settings.subject_line,campaigns.settings.from_name`);
  const camp = c.campaigns?.[0];
  if (camp) {
    const html = (await mc(`/campaigns/${camp.id}/content?fields=html`)).html;
    const host = site.domain.replace(/^www\./, "");
    const links = [...new Set([...html.matchAll(new RegExp(`href="(https://(?:www\.)?${host.replace(/\./g, "\.")}/[^"?]+)`, "g"))].map((m) => m[1]))];
    thursday = { sent: camp.send_time, subject: camp.settings.subject_line, fromName: camp.settings.from_name, links };
  }
  const members = await mc(`/lists/${aud}?fields=stats.member_count`);
  thursday = { ...(thursday || {}), members: members.stats?.member_count };
}

const sftp = creds.sftp;
const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const slugs = ga.map((r) => r.path.replace(/^\/|\/$/g, "")).filter((s) => s && !s.includes("/"));
const php = `<?php
function mm_row($p) { $cats = get_the_category($p->ID); $tid = get_post_thumbnail_id($p->ID);
  return array('id'=>$p->ID,'date'=>$p->post_date,'slug'=>$p->post_name,'title'=>get_the_title($p),'link'=>get_permalink($p),
    'category'=>$cats ? html_entity_decode($cats[0]->name) : 'News','excerpt'=>wp_strip_all_tags(get_the_excerpt($p)),
    'tags'=>wp_get_post_tags($p->ID, array('fields'=>'slugs')),
    'imageLead'=>$tid ? wp_get_attachment_image_url($tid,'large') : '','imageSquare'=>$tid ? wp_get_attachment_image_url($tid,'thumbnail') : ''); }
$recent = array(); foreach (get_posts(array('numberposts'=>40,'post_status'=>'publish','date_query'=>array(array('after'=>'2026-09-05')))) as $p) $recent[] = mm_row($p);
$lookup = array(); foreach (json_decode(base64_decode('${Buffer.from(JSON.stringify(slugs)).toString("base64")}')) as $s) { $p = get_page_by_path($s, OBJECT, 'post'); if ($p && $p->post_status === 'publish') $lookup[] = mm_row($p); }
echo wp_json_encode(array('recent'=>$recent,'lookup'=>$lookup));`;
const base = ["-i", sftp.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];
const out = execFileSync("ssh", [...base, `cd ${docroot} && echo ${Buffer.from(php).toString("base64")} | base64 -d > /tmp/_mg.php && wp eval-file /tmp/_mg.php 2>/dev/null; rm -f /tmp/_mg.php`], { encoding: "utf8", maxBuffer: 30e6, timeout: 180000 });
const wp = JSON.parse(out.slice(out.indexOf("{")));
const snap = { site: { slug, name: site.name, domain: site.domain, authorName: site.authorName, newsletterEnabled: site.newsletterEnabled }, ga, thursday, docroot, ...wp };
fs.writeFileSync(`${outDir}/${slug}-snap.json`, JSON.stringify(snap, null, 1));

console.log(`\n=== ${site.name} (${site.domain}) newsletter=${site.newsletterEnabled} members=${thursday?.members} from="${thursday?.fromName}"`);
console.log("Thursday:", thursday?.sent, "|", thursday?.subject);
const bySlug = new Map(wp.lookup.map((p) => [p.slug, p]));
console.log("GA4 most read (articles):");
ga.filter((r) => bySlug.has(r.path.replace(/^\/|\/$/g, ""))).slice(0, 8).forEach((r) => { const p = bySlug.get(r.path.replace(/^\/|\/$/g, "")); console.log(`  ${String(r.views).padStart(4)}  ${p.id} ${p.date.slice(0,10)} ${p.tags.join(",")} ${p.title.slice(0, 80)}`); });
console.log("GA4 total views:", ga.reduce((a, r) => a + r.views, 0));
console.log("Recent:");
wp.recent.forEach((p) => console.log(`  ${p.id} ${p.date.slice(0, 16)} [${p.category}] ${p.tags.join(",")} ${thursday?.links?.includes(p.link) ? "(THU)" : ""} ${p.imageLead ? "" : "NOIMG"} ${p.title.slice(0, 95)}`));
await prisma.$disconnect();
