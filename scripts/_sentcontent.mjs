// The HTML Mailchimp actually sent, not a rebuild of it.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const since = process.argv[2] || "2026-10-08T00:00";
const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const reports = (await mc(`/reports?count=20&type=regular&sort_field=send_time&sort_dir=DESC`)).reports || [];
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "mailchimp" } });
  if (!rows.length) continue;
  const aid = decryptJson(rows[0].payloadEnc).audienceId;
  const r = reports.find((x) => x.list_id === aid && x.send_time > since);
  if (!r) { console.log(`${s.slug.padEnd(28)} no send yet`); continue; }
  const c = await mc(`/campaigns/${r.id}/content?fields=html`);
  fs.writeFileSync(`${SP}/sent-${s.slug}.html`, c.html || "");
  console.log(`${s.slug.padEnd(28)} ${(c.html || "").length} bytes | ${r.subject_line.slice(0, 60)}`);
}
await p.$disconnect();
