// Clear Dental to send through the bounce block. JB, 26 October.
// The cause was one employer, mydentistcareers.co.uk, and all 73 of its
// addresses are now cleaned with none left on the list, so the breach that
// closed the gate cannot repeat. Through Friday, covering today and Thursday.
import { PrismaClient } from "@prisma/client";
import { setHealthOverride, healthOverride, lastIssueHealth } from "../lib/newsletter.js";
import { decryptJson } from "../lib/crypto.js";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "dental-business-news" } });
await setHealthOverride(s, new Date("2026-10-31T00:00:00Z"));
const until = await healthOverride(s);
const cfg = decryptJson((await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } }))[0].payloadEnc);
const h = await lastIssueHealth(cfg.audienceId);
console.log(`override until ${until?.toLocaleString("en-GB",{timeZone:"Europe/London"})}`);
console.log(`gate ${h.ok ? "pass" : "block (" + h.reasons.join("; ") + ")"}  =>  ${h.ok || until ? "SENDS" : "SKIPS"}`);
await p.$disconnect();
