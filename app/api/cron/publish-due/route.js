import { forEachSite, cronGuard } from "@/lib/cron";
import { isWordPressConfigured, publishToWordPress, uploadMedia, resolveCategory, authorForSite } from "@/lib/wordpress";
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
    // Ten candidates, two publishes. This was take: 2, and the two oldest due
    // items are not always publishable: on 23 August both were imageless, the
    // bare-post guard deferred them every tick, and two finished, imaged
    // articles sat starved behind them all day - Smart SME held everything it
    // needed to publish and published nothing. A deferral must not spend a
    // publish slot.
    take: 10,
  });
  if (!due.length) return { published: 0 };

  // Once per tick, not once per article: this is an HTTP round trip to
  // /wp/v2/users and the answer cannot change between two posts in the same
  // batch. null means "attribute to the account holding the application
  // password", which is exactly what happened before bylineMode was honoured.
  const authorId = await authorForSite(wp, site);

  const PUBLISH_CAP = 2;
  let publishedCount = 0;
  const results = [];
  for (const article of due) {
    if (publishedCount >= PUBLISH_CAP) break;
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

      // No picture, no post.
      //
      // Every branch below is guarded on `article.imageUrl`, so an article that
      // simply never got one fell straight past all of them and published bare.
      // Twelve did before anyone counted: seven on Smart SME, three on Fleet,
      // two on Golf. The header comment on this file has always said an article
      // waits for a picture rather than going out without one; that was true of
      // a picture the re-check rejected and untrue of one that was never
      // sourced, and nothing was watching the second case.
      //
      // Deferred, not dropped. The Designer takes anything in review or
      // approved with no imageUrl, and it now gives up after four goes and asks
      // the Director for art direction, so nothing can queue here for ever
      // without saying so on the board.
      if (!article.imageUrl) {
        results.push({
          id: article.id,
          title: article.title.slice(0, 60),
          deferred: "no header image yet, so it would publish bare. Waiting for the Designer.",
        });
        continue;
      }

      let featuredMediaId;
      // Declared out here because the result is reported after publishing, not
      // only used inside the branch that produces it.
      let check;

      // An image ALREADY in our own media library is attached as-is: no fetch,
      // no re-upload, no second visual check.
      //
      // The host blocks datacentre traffic, so an image served from our own
      // WordPress answers a laptop and 403s from Vercel. Anything put in the
      // library by hand — a commissioned graphic, an original illustration —
      // therefore failed the gate on "image fetch 403" and was deferred for
      // ever, while sitting in the library the whole time. Re-uploading it would
      // also have duplicated it on every attempt.
      //
      // Skipping the check is safe precisely because it is ours: an image in the
      // library was put there deliberately by a human or by the Designer after
      // passing the gate at selection. The check exists to catch a bad automated
      // pick from a stock library, not to second-guess the media library.
      const ownHost = (() => {
        try {
          return new URL(article.imageUrl || "").host === new URL(wp.url).host;
        } catch {
          return false;
        }
      })();
      if (article.imageUrl && ownHost) {
        const { findMediaByUrl, setMediaAlt } = await import("@/lib/wordpress");
        featuredMediaId = (await findMediaByUrl(wp, article.imageUrl)) ?? undefined;
        if (featuredMediaId) {
          // uploadMedia is where alt text normally gets written, and this branch
          // skips it. The first article through here published with an empty
          // alt attribute on its header image, which is an accessibility fault
          // and throws away the one image field search engines actually read.
          if (article.imageAlt) await setMediaAlt(wp, featuredMediaId, article.imageAlt);
          check = { ok: true, reason: "already in the media library" };
        }
      }

      if (article.imageUrl && !featuredMediaId) {
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
        authorId,
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
      publishedCount++;
    } catch (e) {
      results.push({ title: article.title, error: e.message });
    }
  }
  return { published: results.filter((r) => r.url).length, results };
  });

  return Response.json(out);
}
