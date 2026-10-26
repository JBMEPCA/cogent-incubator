import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { slug: true, name: true, domain: true }, orderBy: { createdAt: "asc" } });
for (const s of sites) console.log(`${s.slug}\t${s.name}\t${s.domain}`);
await p.$disconnect();
