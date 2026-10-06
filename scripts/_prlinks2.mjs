import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { fetchCandidates } from "../lib/newsletter.js";
const p = new PrismaClient();
const want = {
  "barbering-business": ["NHBF"],
  "smart-farming-news": ["beef exports"],
  "golf-resort-magazine": ["Aphrodite", "Apes Hill"],
  "airport-business-magazine": ["Boldyn"],
};
for (const [slug, frags] of Object.entries(want)) {
  const site = await p.site.findUnique({ where: { slug } });
  const rows = await p.siteCredential.findMany({ where: { siteId: site.id, kind: "wordpress" } });
  const cands = await fetchCandidates(decryptJson(rows[0].payloadEnc), 40, site);
  for (const f of frags) {
    const hit = cands.find((c) => c.title.toLowerCase().includes(f.toLowerCase()));
    console.log(`${slug.padEnd(26)} ${hit ? hit.link : "NOT FOUND: " + f}`);
    if (hit) console.log(`   ${hit.title}`);
  }
}
await p.$disconnect();
