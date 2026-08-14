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

// ONE raw client. Every exported handle is built from it independently.
//
// The first version of this chained extensions — forSite() extended the
// already-guarded `prisma`. That does not work: with chained query extensions
// the guard ran BEFORE the scope injection, so it never saw the marker the
// injection was about to set and threw on every scoped query. Both forSite()
// and fleetRead() were dead on arrival, which only showed up on the first real
// page load against a database.
//
// Building each handle from `base` separately means no ordering to reason
// about: a handle either has the guard or has the injection, never both.
const base = globalForPrisma.prismaBase || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = base;
}

/**
 * The default handle. Safe for fleet-wide models (Site, User, AgentJob,
 * GlobalSetting, OutreachOptOut) and refuses everything tenanted, so a
 * forgotten scope is a loud error at the call site rather than a silent read
 * across every title.
 */
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANTED.has(model)) return query(args);
        throw new Error(
          `${model}.${operation}() was called without a site scope. ` +
            `Use forSite(siteId).${model[0].toLowerCase() + model.slice(1)}.${operation}() instead — ` +
            `an unscoped query on a tenanted model would read or write across every title.`
        );
      },
    },
  },
});

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

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANTED.has(model)) return query(args);

          const next = { ...(args || {}) };

          if (FILTERED.has(operation)) {
            next.where = { ...(next.where || {}), siteId };
            return query(next);
          }

          if (CREATES.has(operation)) {
            if (Array.isArray(next.data)) {
              next.data = next.data.map((d) => ({ ...d, siteId }));
            } else {
              next.data = { ...(next.data || {}), siteId };
            }
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
                return query(next);
              }
              throw new Error(
                `${model}.${operation}() targeted a row belonging to another site, or one that does not exist`
              );
            }

            if (operation === "upsert") next.create = { ...(next.create || {}), siteId };
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
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (TENANTED.has(model)) {
            if (!FILTERED.has(operation) || operation === "updateMany" || operation === "deleteMany") {
              throw new Error(
                `fleetRead() is read-only — ${model}.${operation}() must go through forSite()`
              );
            }
          }
          return query(args);
        },
      },
    },
  });
}

/**
 * Turn a unique `where` into something findFirst can filter on.
 *
 * Composite primary keys arrive wrapped — `{ siteId_key: { siteId, key } }` —
 * and that wrapper is only valid on findUnique. Passing it to findFirst throws,
 * which would have made every ownership check on Agent, EngineSetting and
 * SiteCredential fail closed and look like "row belongs to another site".
 */
function flattenWhere(where) {
  const out = {};
  for (const [k, v] of Object.entries(where || {})) {
    const isCompound =
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      !(v instanceof Date) &&
      k.includes("_") &&
      Object.keys(v).length > 0 &&
      Object.keys(v).every((inner) => k.split("_").includes(inner));

    if (isCompound) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

/** Does the row this unique `where` points at belong to us? */
async function confirmOwnership(model, args, siteId) {
  const delegate = base[model[0].toLowerCase() + model.slice(1)];
  if (!delegate) return false;
  const found = await delegate.findFirst({
    where: { ...flattenWhere(args.where), siteId },
    select: { siteId: true },
  });
  return Boolean(found);
}
