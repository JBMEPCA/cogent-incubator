import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const sites = await p.site.findMany({ select: { id: true, slug: true } });
const posts = await p.linkedInPost.findMany({
  where: { postedAt: { gte: new Date(Date.now() - 3 * 864e5) } },
  select: { siteId: true, postedAt: true, linkedinUrn: true },
  orderBy: { postedAt: "desc" }, take: 18,
});
for (const x of posts) console.log(`${uk(x.postedAt)} ${sites.find((s) => s.id === x.siteId)?.slug.padEnd(26)} ${x.linkedinUrn}`);
await p.$disconnect();
