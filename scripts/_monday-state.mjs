/**
 * Read-only: what each title's Monday briefing would do, and how many people
 * are on each list. Touches nothing.
 */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc, sendingDomainReady, isNewsletterConfigured } from "../lib/newsletter.js";
import { BRIEFING_TITLES } from "../lib/briefing-template.js";
import { wordmarkFor } from "../lib/brand/wordmarks.js";

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
const out = [];

for (const site of sites) {
  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const creds = Object.fromEntries(rows.map((r) => [r.kind, (() => { try { return decryptJson(r.payloadEnc); } catch { return null; } })()]));
  const m = creds.mailchimp;

  let members = null, unsub = null, cleaned = null, listName = null, mcErr = null;
  if (m?.audienceId) {
    try {
      const l = await mc(`/lists/${m.audienceId}?fields=name,stats.member_count,stats.unsubscribe_count,stats.cleaned_count`);
      listName = l.name; members = l.stats?.member_count ?? 0;
      unsub = l.stats?.unsubscribe_count ?? 0; cleaned = l.stats?.cleaned_count ?? 0;
    } catch (e) { mcErr = e.message.slice(0, 90); }
  }
  let domain = null;
  if (m?.fromEmail) { try { const d = await sendingDomainReady(m.fromEmail); domain = d.ok ? "ok" : d.why.slice(0, 70); } catch (e) { domain = "check failed"; } }

  out.push({
    slug: site.slug, name: site.name, status: site.status,
    engine: site.engineEnabled, nl: site.newsletterEnabled,
    design: Boolean(BRIEFING_TITLES[site.slug]),
    mark: Boolean(wordmarkFor(site.slug)),
    audienceId: m?.audienceId || null, from: m?.fromEmail || null,
    configured: isNewsletterConfigured(m), listName, members, unsub, cleaned, mcErr, domain,
  });
}

console.log(JSON.stringify(out, null, 1));
console.log(`\nNEWSLETTER_ENABLED=${process.env.NEWSLETTER_ENABLED ?? "(unset -> on)"}  APP_URL=${process.env.APP_URL}`);
await prisma.$disconnect();
