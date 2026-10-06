import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.globalSetting.findMany({ select: { key: true, value: true } });
for (const r of rows) console.log(r.key, "=", /token|key|secret/i.test(r.key) ? `(${String(r.value).length} chars)` : String(r.value).slice(0, 80));
await p.$disconnect();
