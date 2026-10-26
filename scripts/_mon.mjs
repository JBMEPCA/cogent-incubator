// Monday briefing readiness, all ten.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { lastIssueHealth, healthOverride } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true, name:true, newsletterEnabled:true }, orderBy: { createdAt: "asc" } });
const since = new Date(Date.now() - 7*864e5);
console.log("title".padEnd(27) + "switch  audience   gate                         stories  => ");
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) { console.log(`${s.slug.padEnd(27)} no mailchimp credential`); continue; }
  const cfg = decryptJson(rows[0].payloadEnc);
  const health = await lastIssueHealth(cfg.audienceId).catch(e => ({ ok:false, reasons:["lookup failed: "+e.message] }));
  const override = health.ok ? null : await healthOverride(s).catch(()=>null);
  const n = await p.article.count({ where: { siteId: s.id, status: "published", publishedAt: { gte: since } } });
  const pin = await p.engineSetting.findFirst({ where: { siteId: s.id, key: "briefing_pin" } }).catch(()=>null);
  const send = s.newsletterEnabled && (health.ok || Boolean(override));
  console.log(
    s.slug.padEnd(27) +
    (s.newsletterEnabled ? "on   " : "OFF  ").padEnd(8) +
    String(cfg.audienceId||"?").slice(0,9).padEnd(11) +
    (health.ok ? "pass" : "BLOCK " + health.reasons.join("; ")).slice(0,28).padEnd(30) +
    String(n).padStart(5) + "    " + (send ? "SENDS" : "SKIPS") + (pin ? "  pin set" : "")
  );
}
await p.$disconnect();
