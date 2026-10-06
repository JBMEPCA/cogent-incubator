// Dumps every social post that went out, for the review spreadsheet (28 Sep 2026).
import "./_env.mjs";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const li = await p.linkedInPost.findMany({ where: { status: "posted" }, include: { site: { select: { name: true, slug: true } } }, orderBy: { postedAt: "asc" } });
const arts = await p.article.findMany({ where: { id: { in: li.map(x => x.articleId).filter(Boolean) } }, select: { id: true, title: true, body: true, imageUrl: true } });
const ig = await p.agentRun.findMany({ where: { summary: { startsWith: "Sent to Instagram" } }, include: { site: { select: { name: true, slug: true } } }, orderBy: { startedAt: "asc" } });
const cache = JSON.parse((await p.globalSetting.findUnique({ where: { key: "linkedin:orgUrnCache" } }))?.value || "{}");
const igArts = await p.article.findMany({ where: { siteId: ig[0]?.siteId, wpPostId: { not: null } }, select: { title: true, wpPostId: true, imageUrl: true } });
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const out = li.map((x) => {
  const a = arts.find((y) => y.id === x.articleId);
  const hosts = [...new Set([...(a?.body || "").matchAll(/href=["']([^"']+)["']/gi)].map((m) => host(m[1])).filter(Boolean))];
  const tags = hosts.map((h) => cache[h] || cache["www." + h]).filter((c) => c?.urn && c.at <= new Date(x.postedAt).getTime() + 60000).map((c) => c.name).slice(0, 3);
  return { site: x.site.name, slug: x.site.slug, postedAt: x.postedAt, text: x.text, link: x.sourceUrl, headline: a?.title, image: x.imageUrl || a?.imageUrl, tags, bridge: (x.linkedinUrn || "").startsWith("make:") };
});
const igOut = ig.map((r) => {
  const t = r.summary.replace(/^Sent to Instagram: "|"$/g, "");
  const a = igArts.find((y) => y.title.startsWith(t.slice(0, 50)));
  return { site: r.site.name, postedAt: r.startedAt, headline: a?.title || t, image: a?.imageUrl, wpPostId: a?.wpPostId };
});
fs.writeFileSync(process.argv[2], JSON.stringify({ li: out, ig: igOut }, null, 1));
console.log(out.length, igOut.length, out.filter((o) => o.tags.length).length, igOut.map((i) => i.wpPostId));
await p.$disconnect();
