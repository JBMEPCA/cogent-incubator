import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { lastIssueHealth, healthOverride } from "../lib/newsletter.js";
const p = new PrismaClient();
for (const slug of ["dental-business-news", "smart-farming-news", "fleet-magazine"]) {
  const site = await p.site.findUnique({ where: { slug } });
  const rows = await p.siteCredential.findMany({ where: { siteId: site.id, kind: "mailchimp" } });
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const health = await lastIssueHealth(aid);
  const override = health.ok ? null : await healthOverride(site);
  const willSend = health.ok || Boolean(override);
  console.log(
    `${slug.padEnd(28)} gate ${health.ok ? "pass" : "BLOCK (" + health.reasons.join(", ") + ")"} | override ${override ? "until " + override.toLocaleString("en-GB", { timeZone: "Europe/London" }) : "none"} => ${willSend ? "SENDS" : "SKIPS"}`
  );
}
await p.$disconnect();
