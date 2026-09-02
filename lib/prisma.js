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
  "KeywordTarget",
  "NewsletterProspect",
  "Agent",
  "AgentRun",
  "AgentMessage",
  "EngineSetting",
  "SiteCredential",
  "SiteProvisioningStep",
  "ReferringDomain",
  "AudienceSnapshot",
  "TargetAchievement",
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

/**
 * Models whose unique key is (siteId, something), and what Prisma calls it.
 *
 * These were global tables with a single-column key before the multi-tenant
 * split, and every call site wrote the natural thing — `where: { key }`. That
 * is no longer a unique input, so Prisma rejects it outright, and it did so in
 * ten places across five files: the agent ladder, the LinkedIn OAuth token
 * store, the outreach cursor and three SEO settings writes. Each one was a
 * runtime crash sitting behind whichever agent happened to reach it first.
 *
 * Fixing ten call sites by hand leaves the eleventh for next time. The scope
 * layer already exists to stop callers having to remember the tenancy rules, so
 * the completion belongs here: name the natural key and this fills in the rest.
 */
const COMPOSITE_KEYS = {
  Agent: { compound: "siteId_key", field: "key" },
  EngineSetting: { compound: "siteId_key", field: "key" },
  SiteCredential: { compound: "siteId_kind", field: "kind" },
  ReferringDomain: { compound: "siteId_domain", field: "domain" },
};

/**
 * Turn `where: { key: "x" }` into `where: { siteId_key: { siteId, key: "x" } }`.
 *
 * Left alone when the caller already named the compound key, or addressed the
 * row by its own id, or passed something this cannot safely complete — in which
 * case Prisma's own error is the right one to surface.
 */
function completeCompositeWhere(model, where, siteId) {
  const spec = COMPOSITE_KEYS[model];
  if (!spec || !where) return where;
  if (where[spec.compound] !== undefined) return where;
  if (where.id !== undefined) return where;
  const value = where[spec.field];
  if (value === undefined || (value && typeof value === "object")) return where;

  const { [spec.field]: _taken, siteId: _scope, ...rest } = where;
  return { ...rest, [spec.compound]: { siteId, [spec.field]: value } };
}

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
  // The commonest way to arrive here with no siteId is a server action wired to
  // a button as formAction={action} instead of formAction={action.bind(null,
  // siteRef)}. Next then calls the action with (formData) alone, so the `site`
  // parameter holds a FormData and site.id is undefined. Say so: the bare
  // "requires a siteId" sent someone hunting through credentials and Gmail for
  // an hour when every button on the outreach page was failing this way.
  if (!siteId) {
    throw new Error(
      "forSite() requires a siteId. If this came from a server action, the action " +
        "was probably passed to action=/formAction= unbound — it needs " +
        ".bind(null, siteRef) so `site` is not the FormData."
    );
  }

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
            // Complete a bare natural key into the compound one Prisma wants,
            // before anything else looks at `where`.
            next.where = completeCompositeWhere(model, next.where, siteId);

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
