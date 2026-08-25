/**
 * What still stands between a title and a sendable weekly issue.
 *
 * Every one of these is a gate that returns "skipped" rather than failing, so a
 * title that is not ready looks identical to one that had a quiet week. This
 * says which gate, per title, in one place.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/newsletter-readiness.mjs [slug...]
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { fetchCandidates, sendingDomainReady, mc } from "../lib/newsletter.js";
import { wordmarkFor } from "../lib/brand/wordmarks.js";

const prisma = new PrismaClient();
const slugs = process.argv.slice(2);
const sites = slugs.length
  ? await prisma.site.findMany({ where: { slug: { in: slugs } } })
  : await prisma.site.findMany({ orderBy: { createdAt: "asc" } });

const tick = (ok) => (ok ? "OK  " : "NO  ");

for (const site of sites) {
  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
  const mcCred = creds.mailchimp;

  const lines = [];
  lines.push(`${tick(Boolean(mcCred?.audienceId))}mailchimp credential`);

  let members = null;
  if (mcCred?.audienceId) {
    try {
      const list = await mc(`/lists/${mcCred.audienceId}?fields=name,stats.member_count`);
      members = list.stats?.member_count ?? 0;
      lines.push(`${tick(members > 0)}audience has subscribers (${members})`);
    } catch { lines.push("NO  audience unreadable"); }
  }

  if (mcCred?.fromEmail) {
    const d = await sendingDomainReady(mcCred.fromEmail);
    lines.push(`${tick(d.ok)}sending domain${d.ok ? "" : `: ${d.why}`}`);
  } else lines.push("NO  no from address");

  let candidates = 0;
  try {
    candidates = (await fetchCandidates(creds.wordpress, 40, site)).length;
  } catch { /* counted as 0 */ }
  lines.push(`${tick(candidates >= 10)}articles with images (${candidates}/10 needed)`);
  lines.push(`${tick(Boolean(wordmarkFor(site.slug)))}own wordmark`);
  lines.push(`${tick(site.newsletterEnabled)}newsletter switched on`);

  const blockers = lines.filter((l) => l.startsWith("NO"));
  console.log(`\n=== ${site.name} — ${blockers.length ? `${blockers.length} blocker(s)` : "READY"} ===`);
  lines.forEach((l) => console.log(`  ${l}`));
}
await prisma.$disconnect();
