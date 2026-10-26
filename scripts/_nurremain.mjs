import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const WATCH = { "dental-business-news": ["mydentistcareers.co.uk","bupadentalcare.co.uk","oasis-healthcare.com"], "gym-business-news": ["lafitness.com","crunch.com","anytimefitness.com","mountainsidefitness.com"] };
for (const [slug, domains] of Object.entries(WATCH)) {
  const s = await p.site.findUnique({ where: { slug } });
  const aid = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc).audienceId;
  let all = [], off = 0, total = 1;
  while (off < total && off < 4000) {
    const j = await mc(`/lists/${aid}/members?count=1000&offset=${off}&fields=members.email_address,members.status,total_items`);
    total = j.total_items||0; const got = j.members||[]; all.push(...got); off += 1000; if (!got.length) break;
  }
  const subbed = all.filter(m => m.status === "subscribed");
  console.log(`\n=== ${slug}: ${subbed.length} still subscribed of ${all.length} on the list ===`);
  let left = 0;
  for (const d of domains) {
    const n = subbed.filter(m => m.email_address.toLowerCase().endsWith("@"+d)).length;
    const cleaned = all.filter(m => m.status === "cleaned" && m.email_address.toLowerCase().endsWith("@"+d)).length;
    left += n;
    console.log(`  ${d.padEnd(30)} ${String(n).padStart(3)} still live, ${String(cleaned).padStart(3)} already cleaned`);
  }
  console.log(`  => worst case next issue from these domains alone: ${(left/Math.max(subbed.length,1)*100).toFixed(2)}%`);
}
await p.$disconnect();
