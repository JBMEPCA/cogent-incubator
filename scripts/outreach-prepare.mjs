/**
 * Write the two briefing files a sourcing run needs: every title with its
 * audience and series name, and every company any title has already written to.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/outreach-prepare.mjs --out=<dir>
 */
import fs from "node:fs";
const { prisma, forSite } = await import("../lib/prisma.js");
const OUT = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1] || process.env.OUT;
if (!OUT) throw new Error("--out=<dir> is required");
fs.mkdirSync(OUT, { recursive: true });
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true, domain: true, audience: true, strapline: true } });
const fr = await prisma.$queryRawUnsafe(`SELECT "siteId", value FROM "EngineSetting" WHERE key='interview_franchise'`);
const used = [];
for (const s of sites) for (const r of await forSite(s.id).interviewTarget.findMany()) used.push(`${s.slug}: ${r.company} (${r.companyDomain || "no domain"}) [${r.status}]`);
fs.writeFileSync(`${OUT}/already-contacted.txt`, used.sort().join("\n"));
const out = sites.map((s) => ({ slug: s.slug, name: s.name, domain: s.domain, franchise: fr.find((f) => f.siteId === s.id)?.value, audience: s.audience, strapline: s.strapline }));
fs.writeFileSync(`${OUT}/titles.json`, JSON.stringify(out, null, 2));
console.log(out.map((o) => `${o.slug} | ${o.name} | ${o.franchise}`).join("\n"), "\nexcluded companies:", used.length);
await prisma.$disconnect();
