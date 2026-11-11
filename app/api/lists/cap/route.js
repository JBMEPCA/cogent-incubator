import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { setListCap } from "@/lib/prospects";

export const dynamic = "force-dynamic";

/**
 * Set or clear one title's list cap from the Cap cell on /lists.
 * Body: { slug, cap } where cap is a whole number, or null/"" to remove it.
 */
export async function POST(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!(await canEdit())) return Response.json({ error: "read-only account" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const slug = body?.slug;
  const raw = body?.cap;
  if (!slug) return Response.json({ error: "needs slug" }, { status: 400 });
  const clearing = raw === null || raw === "";
  if (!clearing && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
    return Response.json({ error: `"${raw}" is not a cap` }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!site || site.status === "archived") {
    return Response.json({ error: `no title with slug "${slug}"` }, { status: 404 });
  }

  const cap = await setListCap(site.id, clearing ? null : raw);
  return Response.json({ slug, cap });
}
