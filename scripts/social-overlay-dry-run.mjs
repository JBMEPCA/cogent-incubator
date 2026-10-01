// Draws the interview social overlays for every published interview on every
// title, without posting anything, and writes them to a folder to look at.
//
//   node --env-file=.env scripts/social-overlay-dry-run.mjs [outDir] [--site=slug] [--post=id]
//
// Reads WordPress and the database; writes nothing to either. Each picture is
// drawn in both formats (LinkedIn and Instagram) and a report.json says, per
// picture, how many faces were found and why it was or was not tagged.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { loadInterview, drawInterview } from "../lib/social-overlay/index.js";

const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith("--")) || "social-overlay-dry-run");
const onlySite = args.find((a) => a.startsWith("--site="))?.slice(7);
const onlyPost = args.find((a) => a.startsWith("--post="))?.slice(7);
fs.mkdirSync(out, { recursive: true });

const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
const report = [];
for (const site of sites) {
  if (onlySite && site.slug !== onlySite) continue;
  const { creds } = await siteCredentials(site.id);
  const wp = creds.wordpress;
  if (!wp?.url) continue;

  // The interviews are the posts whose title carries the franchise eyebrow.
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const res = await fetch(`${wp.url.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=100&search=franchise-eyebrow&_fields=id,title`, {
    headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
  });
  const posts = (await res.json().catch(() => [])) || [];
  const ids = (Array.isArray(posts) ? posts : []).filter((p) => /franchise-eyebrow/.test(p.title?.rendered || "")).map((p) => p.id);

  for (const id of ids) {
    if (onlyPost && String(id) !== onlyPost) continue;
    const row = { site: site.slug, wpPostId: id };
    try {
      const interview = await loadInterview(site, wp, id);
      row.headline = interview.headline;
      for (const format of ["linkedin", "instagram"]) {
        const t = Date.now();
        const drawn = await drawInterview(site, interview, format);
        const file = `${site.slug}-${id}-${format}.jpg`;
        fs.writeFileSync(path.join(out, file), drawn.buffer);
        row[format] = { file, ms: Date.now() - t, size: `${drawn.width}x${drawn.height}`, kb: Math.round(drawn.buffer.length / 1024), ...drawn.report };
      }
      const said = (r) => (r.tagged.length ? `tagged ${r.tagged.join(", ")}` : "no tags");
      console.log(`${site.slug} ${id}: LinkedIn ${said(row.linkedin)}; Instagram ${said(row.instagram)} (${row.linkedin.reason})`);
    } catch (e) {
      row.error = e.message;
      console.log(`${site.slug} ${id}: FAILED ${e.message} (would post the plain photo)`);
    }
    report.push(row);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
console.log(`\n${report.length} interviews, ${report.filter((r) => r.error).length} failed. Written to ${out}`);
await prisma.$disconnect();
