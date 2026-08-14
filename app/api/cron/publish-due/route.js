import { prisma } from "@/lib/prisma";
import { isWordPressConfigured, publishToWordPress, uploadMedia, resolveCategory } from "@/lib/wordpress";
import { stripEmDashes } from "@/lib/drafting";
import { verifyImage } from "@/lib/qa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Publishes articles whose scheduled slot has arrived. QA must have passed and
// the image must survive one last visual check — and if it does not, the
// article waits for a new picture rather than going out without one.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isWordPressConfigured()) return Response.json({ skipped: "WordPress not configured" });

  const due = await prisma.article.findMany({
    where: {
      status: { in: ["review", "approved"] },
      qaPassed: true,
      scheduledFor: { lte: new Date() },
      body: { not: null },
    },
    orderBy: { scheduledFor: "asc" },
    take: 2,
  });
  if (!due.length) return Response.json({ published: 0 });

  const results = [];
  for (const article of due) {
    try {
      let featuredMediaId;
      if (article.imageUrl) {
        const check = await verifyImage({
          imageUrl: article.imageUrl,
          title: article.title,
          keyphrase: article.keyphrase,
        });
        if (check.ok) {
          const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
          const media = await uploadMedia({
            imageUrl: article.imageUrl,
            alt: check.altText || article.imageAlt,
            filename: slug,
          });
          featuredMediaId = media.id;
        } else {
          // A failed re-check must not cost the article its picture.
          //
          // This is the SECOND vision call on an image the picture gate already
          // approved when it was chosen, and the gate is not deterministic. It
          // used to fall straight through to publishing with no featured image
          // at all: four live posts ended up bare that way, including one on
          // the front page showing a placeholder tile. An article with no
          // picture is a worse outcome than either of the ones this check is
          // deciding between.
          //
          // So the image is dropped from the ARTICLE rather than from the post,
          // and publishing is deferred. The Designer takes anything in review or
          // approved with no imageUrl, so it sources a fresh one and this
          // publishes on the next tick with a picture that has passed twice.
          await prisma.article.update({
            where: { id: article.id },
            data: { imageUrl: null, imageAlt: null, imageCredit: null, imageSource: null },
          });
          results.push({
            id: article.id,
            title: article.title.slice(0, 60),
            deferred: `image failed the re-check (${check.reason || "no reason given"}); sent back to the Designer`,
          });
          continue;
        }
      }
      let body = stripEmDashes(article.body);
      if (article.imageCredit) {
        body += `\n<p><em style="font-size:0.85em">${article.imageCredit}</em></p>`;
      }
      const post = await publishToWordPress({
        title: stripEmDashes(article.title),
        body,
        status: "publish",
        featuredMediaId,
        categoryId: await resolveCategory(article.category),
        keyphrase: article.keyphrase,
        metaDesc: article.metaDesc,
      });
      await prisma.article.update({
        where: { id: article.id },
        data: { status: "published", publishedAt: new Date(), wpPostId: post.id },
      });
      results.push({ title: article.title, url: post.link });
    } catch (e) {
      results.push({ title: article.title, error: e.message });
    }
  }
  return Response.json({ published: results.filter((r) => r.url).length, results });
}
