import { PrismaClient } from "@prisma/client";
import { setHealthOverride, healthOverride, lastIssueHealth } from "../lib/newsletter.js";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "barbering-business" } });
// Through Friday, so it covers today's Monday briefing and Thursday's weekly.
const until = new Date("2026-10-16T23:00:00Z");
await setHealthOverride(s, until);
const now = await healthOverride(s);
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const h = await lastIssueHealth(cfg.audienceId);
console.log(`override set until ${now?.toLocaleString("en-GB",{timeZone:"Europe/London"})}`);
console.log(`gate ${h.ok ? "pass" : "block (" + h.reasons.join("; ") + ")"} => ${h.ok || now ? "SENDS" : "SKIPS"}`);
await p.$disconnect();
