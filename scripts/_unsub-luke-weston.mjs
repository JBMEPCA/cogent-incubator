// One-off, 22 Oct 2026: Luke Weston (luke@westonwalkies.com) asked to stop being
// emailed after the Smart SME weekly. Unsubscribe from every Mailchimp audience,
// suppress the prospect row on every title, and opt the domain out of outreach.
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { mc } from "../lib/newsletter.js";
const EMAIL = "luke@westonwalkies.com", DOMAIN = "westonwalkies.com";
const hash = crypto.createHash("md5").update(EMAIL.toLowerCase()).digest("hex");
const lists = (await mc(`/lists?count=100&fields=lists.id,lists.name`)).lists;
for (const l of lists) {
  const m = await mc(`/lists/${l.id}/members/${hash}?fields=status`).catch(() => null);
  if (!m?.status) continue;
  if (m.status !== "unsubscribed") await mc(`/lists/${l.id}/members/${hash}`, { method: "PATCH", body: JSON.stringify({ status: "unsubscribed" }) });
  const after = await mc(`/lists/${l.id}/members/${hash}?fields=status`);
  console.log(`mailchimp ${l.name}: ${m.status} -> ${after.status}`);
}
const p = new PrismaClient();
const s = await p.newsletterProspect.updateMany({ where: { OR: [{ email: EMAIL }, { domain: DOMAIN }] }, data: { suppressed: true, suppressReason: "Asked to stop all contact, 22 Oct 2026" } });
console.log("prospect rows suppressed:", s.count);
await p.outreachOptOut.upsert({ where: { domain: DOMAIN }, update: {}, create: { domain: DOMAIN, brandName: "Weston Walkies", sourceSite: "smart-sme", note: "Luke Weston asked to stop all contact after the Smart SME weekly, 22 Oct 2026" } });
console.log("outreach opt-out: westonwalkies.com");
await p.$disconnect();
