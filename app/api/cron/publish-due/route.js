import { forEachSite, cronGuard } from "@/lib/cron";
import { isWordPressConfigured, publishToWordPress, uploadMedia, resolveCategory } from "@/lib/wordpress";
import { stripEmDashes } from "@/lib/drafting";
import { verifyImage } from "@/lib/qa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Publishes articles whose scheduled slot has arrived. QA must have passed and
// the image must survive one last visual check — and if it does not, the
// article waits for a new picture rather than going out without one.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  // Once per enabled title, each with its own WordPress and its own scoped
  // client. A title with no WordPress connection is skipped rather than
  // failing the whole tick for everyone else.
  const out = await forEachSite(async ({ site, db, creds }) => {
  const wp = creds.wordpress;
  if (!isWordPressConfigured(wp)) return { skipped: "WordPress not configured" };

  const due = await db.article.findMany({
    where: {
      status: { in: ["review", "approved"] },
      qaPassed: true,
      scheduledFor: { lte: new Date() },
      body: { not: null },
    },
    orderBy: { scheduledFor: "asc" },
    take: 2,
  });
  if (!due.length) return { published: 0 };

  const results = [];
  for (const article of due) {
    try {
      // No category means WordPress files it under whatever the default is, and
      // seven live articles went out that way — off every section of the front
      // page and out of the quota's sight, because sectionGaps counts by
      // category. Held rather than defaulted: guessing a section for a finished
      // article is how Marketing pieces end up in Operations, and the fix is one
      // dropdown in the pipeline view.
      if (!article.category) {
        results.push({
          id: article.id,
          title: article.title.slice(0, 60),
          deferred: "no category set, so it would publish as Uncategorised. Set one on /content.",
        });
        continue;
      }

      let featuredMediaId;
      if (article.imageUrl) {
        // `site` matters: without it titleBrief() renders empty, so the picture
        // editor judges the image with no idea which publication it is for, and
        // the fetch goes out under a generic bot name rather than the title's.
        //
        // A THROWN error is not a verdict. verifyImage returns {ok:false} when
        // it has looked and disapproved; it throws when it could not look at
        // all — an API outage, an exhausted credit balance, a network fault.
        // Those used to be identical from here: both stopped the article, so a
        // billing problem silently halted publishing across the whole fleet
        // while the queue filled up behind it.
        //
        // This image already passed the same gate once, at selection time, in
        // lib/images.js. So when the gate cannot run, fall back to that earlier
        // pass rather than blocking indefinitely. Nothing reaches a page
        // without having been looked at; it just is not looked at twice.
        let check;
        try {
          check = await verifyImage({
            site,
            imageUrl: article.imageUrl,
            title: article.title,
            keyphrase: article.keyphrase,
          });
        } catch (e) {
          check = {
            ok: true,
            unchecked: true,
            reason: `re-check could not run (${e.message?.slice(0, 120)}); relying on the Designer's original pass`,
          };
        }
        if (check.ok) {
          const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
          const media = await uploadMedia(wp, {
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
          await db.article.update({
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
      const post = await publishToWordPress(wp, {
        title: stripEmDashes(article.title),
        body,
        status: "publish",
        featuredMediaId,
        categoryId: await resolveCategory(wp, article.category),
        keyphrase: article.keyphrase,
        metaDesc: article.metaDesc,
      });
      await db.article.update({
        where: { id: article.id },
        data: { status: "published", publishedAt: new Date(), wpPostId: post.id },
      });
      // Surfaced, not swallowed: if the second look was skipped, the run says so.
      results.push({
        title: article.title,
        url: post.link,
        ...(check?.unchecked ? { note: check.reason } : {}),
      });
    } catch (e) {
      results.push({ title: article.title, error: e.message });
    }
  }
  return { published: results.filter((r) => r.url).length, results };
  });

  return Response.json(out);
}
