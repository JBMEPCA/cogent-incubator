import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=60&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
let now = 0, then = 0;
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const list = await mc(`/lists/${aid}?fields=stats.member_count,stats.cleaned_count,stats.unsubscribe_count`);
  const members = list.stats.member_count;
  const thu = reports.find((x) => x.list_id === aid && x.send_time > "2026-10-01T00:00" && x.send_time < "2026-10-02T00:00");
  const sent = thu?.emails_sent ?? 0;
  now += members; then += sent;
  const diff = members - sent;
  console.log(`${s.slug.padEnd(28)} now ${String(members).padStart(5)}  Thu ${String(sent).padStart(5)}  ${diff >= 0 ? "+" : ""}${diff}`);
}
console.log(`FLEET now ${now}, Thursday ${then}, ${now - then >= 0 ? "+" : ""}${now - then}`);
await p.$disconnect();
