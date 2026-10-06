/** One-off recon: what can we reach on Smart SME's WordPress? */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { isWordPressConfigured, categoryCounts } from "../lib/wordpress.js";

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({
  select: {
    id: true, slug: true, name: true, domain: true, sections: true,
    bylineMode: true, authorName: true, authorEmail: true,
    editorialStandardMd: true, houseStyleMd: true,
  },
});
const site = sites.find((s) => /smart/i.test(s.slug));
console.log(`site: ${site.name} (${site.slug}) ${site.domain || ""}`);
console.log(`byline: mode=${site.bylineMode} author=${site.authorName} <${site.authorEmail}>`);
console.log(`sections: ${JSON.stringify(site.sections)}`);
console.log(`\n--- house style ---\n${(site.houseStyleMd || "(none)").slice(0, 2500)}`);
console.log(`\n--- editorial standard ---\n${(site.editorialStandardMd || "(none)").slice(0, 2500)}`);
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
console.log("cred kinds:", Object.keys(creds).join(", "));
const wp = creds.wordpress;
console.log("wp configured:", isWordPressConfigured(wp), wp?.baseUrl || wp?.url || "");
try {
  const cats = await categoryCounts(wp);
  console.log("\ncategories:");
  console.log(JSON.stringify(cats, null, 2).slice(0, 2000));
} catch (e) {
  console.log("categories failed:", e.message.slice(0, 200));
}
await prisma.$disconnect();
