import { prisma } from "@/lib/prisma";
import { imageForPost } from "@/lib/linkedin";
import { composeLinkedInImage, thumbnail } from "@/lib/linkedin-image";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The exact card that will be posted, so the queue shows the real thing rather
// than a mock-up of it.
//
// ?w= asks for a scaled copy. The queue lists a dozen posts, and composing a
// full 1200 wide card per row means a dozen serverless invocations each
// re-downloading a two thousand pixel photograph: slow enough that thumbnails
// were arriving broken. Small widths are cached and cheap to encode.
export async function GET(request, { params }) {
  const { id } = await params;
  const width = Number(new URL(request.url).searchParams.get("w")) || 0;

  const post = await prisma.linkedInPost.findUnique({ where: { id } });
  if (!post) return new Response("Not found", { status: 404 });

  const { url } = await imageForPost(post);
  const { buffer } = await composeLinkedInImage(url);
  const out = width ? await thumbnail(buffer, width) : buffer;

  return new Response(new Uint8Array(out), {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(out.length),
      // The card is a pure function of the picture and the logo, so it is worth
      // holding onto. Private: it is only ever served to the one logged-in user.
      "cache-control": "private, max-age=86400",
    },
  });
}
