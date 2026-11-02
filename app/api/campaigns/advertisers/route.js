import { prisma } from "@/lib/prisma";

// Type-ahead for the "Book a campaign" form: the advertiser list runs to
// thousands of brands, too many to send down as a dropdown.

export const dynamic = "force-dynamic";

export async function GET(req) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json([]);
  const rows = await prisma.advertiser.findMany({
    where: {
      OR: [{ company: { contains: q, mode: "insensitive" } }, { domain: { contains: q.toLowerCase() } }],
    },
    select: { id: true, company: true, domain: true },
    orderBy: { company: "asc" },
    take: 12,
  });
  return Response.json(rows);
}
