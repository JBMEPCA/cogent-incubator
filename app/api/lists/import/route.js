import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { importChunk } from "@/lib/prospect-import";

export const dynamic = "force-dynamic";

// A 500-row chunk is five Claude calls run side by side plus a DNS pass, which
// lands well inside a minute. 300s is headroom for a slow API day, not a plan.
export const maxDuration = 300;

const MAX_ROWS = 1000;

/**
 * One chunk of a CSV upload from the Newsletter lists page. The browser parses
 * the file and sends the Apollo columns only, a chunk at a time, so nothing
 * here ever holds a whole export and no request nears Vercel's 4.5MB body cap.
 */
export async function POST(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!(await canEdit())) return Response.json({ error: "read-only account" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { slug, rows, upload } = body ?? {};
  if (!slug || !Array.isArray(rows) || !upload?.id) {
    return Response.json({ error: "needs slug, rows and upload.id" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return Response.json({ error: `at most ${MAX_ROWS} rows per chunk` }, { status: 400 });
  }

  const site = await prisma.site.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, strapline: true, audience: true, markets: true, status: true },
  });
  if (!site || site.status === "archived") {
    return Response.json({ error: `no title with slug "${slug}"` }, { status: 404 });
  }

  try {
    const out = await importChunk(site, rows, {
      id: String(upload.id).slice(0, 40),
      file: String(upload.file ?? "").slice(0, 120),
      by: session.user?.name ?? "unknown",
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
