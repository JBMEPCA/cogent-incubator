import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.site.findUnique({ where: { slug: "golf-resort-magazine" }, select: { name: true, audience: true, sections: true, editorialStandardMd: true } });
console.log("AUDIENCE:", (s.audience || "").slice(0, 400));
console.log("\nSECTIONS:", JSON.stringify(s.sections).slice(0, 300));
console.log("\nSTANDARD:", (s.editorialStandardMd || "").slice(0, 700));
await p.$disconnect();
