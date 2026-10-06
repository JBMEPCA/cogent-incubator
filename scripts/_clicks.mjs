import { mc } from "../lib/newsletter.js";
const d = await mc(`/reports?count=60&type=regular&sort_field=send_time&sort_dir=DESC`);
for (const t of ["Golf Resort Magazine Weekly - Thursday, 24", "Barbering Business Weekly - Thursday, 24"]) {
  const r = (d.reports || []).find((x) => x.campaign_title?.startsWith(t));
  const cd = await mc(`/reports/${r.id}/click-details?count=60`);
  const links = (cd.urls_clicked || []).map((u) => ({ clicks: u.total_clicks, uniq: u.unique_clicks, url: u.url.replace(/^https?:\/\//, "").slice(0, 58) }));
  console.log(`\n## ${t}  links ${links.length}`);
  for (const l of links.slice(0, 12)) console.log(`   ${String(l.clicks).padStart(4)} total ${String(l.uniq).padStart(4)} uniq  ${l.url}`);
  const sum = links.reduce((n, l) => n + l.uniq, 0);
  console.log(`   unique clicks summed over links: ${sum}`);
}
