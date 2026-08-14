import { PrismaClient } from "@prisma/client";

// Avoid exhausting connections from hot-reloading in dev by reusing one client.
const globalForPrisma = globalThis;

/**
 * Models that belong to exactly one title.
 *
 * Twelve tables with a siteId and roughly two hundred query sites is a
 * cross-tenant leak waiting to happen, and "remember to add the filter" is not
 * a control. So the filter is enforced here instead: the bare client REFUSES to
 * touch these models, and all real work goes through forSite(), which injects
 * the scope automatically.
 *
 * The failure mode this prevents is not hypothetical — it is one forgotten
 * `where` returning another title's articles, or worse, an updateMany that
 * rewrites them.
 */
const TENANTED = new Set([
  "Todo",
  "Lead",
  "PrBrand",
  "FeedItem",
  "Article",
  "SeoSuggestion",
  "LinkedInPost",
  "OutreachEmail",
  "AdvertiserProspect",
  "LaunchItem",
  "ResearchTopic",
  "NewsletterProspect",
  "Agent",
  "AgentRun",
  "AgentMessage",
  "EngineSetting",
  "SiteCredential",
  "SiteProvisioningStep",
]);

// Deliberately NOT tenanted, despite carrying a siteId: AgentJob is the fleet
// work queue, and the dispatcher's whole job is to look across every title at
// once to decide who runs next. Scoping it would defeat the fairness logic.
// Site, User, GlobalSetting and OutreachOptOut are fleet-wide by nature.

// Operations whose `where` is a filter, so siteId can simply be added to it.
const FILTERED = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

// Operations addressed by a unique key, where siteId cannot be added to `where`
// without breaking the lookup. These are checked for ownership instead.
const BY_UNIQUE = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

const CREATES = new Set(["create", "createMany", "createManyAndReturn"]);

function baseClient() {
  const client = new PrismaClient();

  // The guard. Anything tenanted that arrives here without having gone through
  // forSite() is a bug, and it fails loudly at the call site rather than
  // quietly returning the whole fleet's rows.
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANTED.has(model)) return query(args);
          if (args && args.__siteScoped) {
            delete args.__siteScoped;
            return query(args);
          }
          throw new Error(
            `${model}.${operation}() was called without a site scope. ` +
              `Use forSite(siteId).${model[0].toLowerCase() + model.slice(1)}.${operation}() instead — ` +
              `an unscoped query on a tenanted model would read or write across every title.`
          );
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma || baseClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * A Prisma client bound to one title.
 *
 *   const db = forSite(site.id);
 *   await db.article.findMany({ where: { status: "review" } });
 *
 * siteId is injected into filters, stamped onto creates, and verified on
 * unique-key operations. Callers write ordinary Prisma and cannot forget the
 * scope, which is the point — the previous design relied on every author
 * remembering, and that only has to fail once.
 *
 * Cheap to call: this returns a proxy over the shared client, not a new
 * connection, so building one per request is the intended usage.
 */
export function forSite(siteId) {
  if (!siteId) throw new Error("forSite() requires a siteId");

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANTED.has(model)) return query(args);

          const next = { ...(args || {}) };

          if (FILTERED.has(operation)) {
            next.where = { ...(next.where || {}), siteId };
            next.__siteScoped = true;
            return query(next);
          }

          if (CREATES.has(operation)) {
            if (Array.isArray(next.data)) {
              next.data = next.data.map((d) => ({ ...d, siteId }));
            } else {
              next.data = { ...(next.data || {}), siteId };
            }
            next.__siteScoped = true;
            return query(next);
          }

          if (BY_UNIQUE.has(operation)) {
            // A unique lookup cannot carry siteId in `where` unless siteId is
            // part of the unique itself, so ownership is confirmed separately.
            // One extra round trip on a comparatively rare operation, in
            // exchange for update()/delete() being unable to reach across
            // titles at all.
            const owned = await confirmOwnership(model, next, siteId);

            if (!owned) {
              if (operation === "findUnique") return null;
              if (operation === "findUniqueOrThrow") {
                throw new Error(`${model} not found in this site`);
              }
              if (operation === "upsert") {
                // Nothing of ours to update, so this is a create. Stamp the
                // site on both branches and let Prisma decide.
                next.create = { ...(next.create || {}), siteId };
                next.__siteScoped = true;
                return query(next);
              }
              throw new Error(
                `${model}.${operation}() targeted a row belonging to another site, or one that does not exist`
              );
            }

            if (operation === "upsert") next.create = { ...(next.create || {}), siteId };
            next.__siteScoped = true;
            return query(next);
          }

          // Anything not covered above (raw-ish or newly added operations) is
          // refused rather than waved through, so a future Prisma release
          // cannot quietly open a hole here.
          throw new Error(
            `${model}.${operation}() is not supported through forSite(). ` +
              `Add it to lib/prisma.js deliberately rather than bypassing the scope.`
          );
        },
      },
    },
  });
}

/**
 * Read across every title, on purpose.
 *
 * The fleet overview genuinely needs "published this week, grouped by siteId"
 * as one query rather than thirty. That is a legitimate need and looping would
 * be worse, so rather than weaken the guard there is one loudly-named way
 * through it — `fleetRead()` reads at the call site as exactly what it is, and
 * anything using it to serve a single title's page is visibly wrong in review.
 *
 * Reads only. Writes still have to name their site.
 */
export function fleetRead() {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (TENANTED.has(model)) {
            if (!FILTERED.has(operation) || operation === "updateMany" || operation === "deleteMany") {
              throw new Error(
                `fleetRead() is read-only — ${model}.${operation}() must go through forSite()`
              );
            }
            const next = { ...(args || {}), __siteScoped: true };
            return query(next);
          }
          return query(args);
        },
      },
    },
  });
}

/** Does the row this unique `where` points at belong to us? */
async function confirmOwnership(model, args, siteId) {
  const delegate = prisma[model[0].toLowerCase() + model.slice(1)];
  if (!delegate) return false;
  const found = await delegate.findFirst({
    where: { ...(args.where || {}), siteId },
    select: { siteId: true },
    __siteScoped: true,
  });
  return Boolean(found);
}
