// Backlink discovery that does not depend on having emailed anyone.
//
// The Backlink Manager can only ever confirm links from the brands it wrote to,
// because the only thing it knows how to check is those brands' own sites. That
// is a small fraction of the links a title actually earns: directories,
// aggregators, forum posts, someone's roundup — none of them are in the
// outreach table and none of them will ever be.
//
// This closes that gap with the credential we already hold. A referral session
// in GA4 means a real person clicked a real link on a real page, which is proof
// of a backlink even though GA4 has never heard the word.
//
// What it cannot do is see a link nobody has clicked. That is the honest limit
// of this approach and the reason a proper backlink index is still worth buying
// later — but it costs nothing, needs no new account, and a link that sends no
// traffic at all is the least valuable kind.
import { forSite } from "./prisma";
import { fetchReferrers } from "./analytics";
import { siteHost } from "./voice";

const REFERRAL_WINDOW_DAYS = 28;

/**
 * Read GA4's referral sources and record them against the title.
 *
 * Returns the domains that had never been seen before, which is the whole point
 * of writing them down: GA4 serves a rolling window, so "new" is a question
 * only a stored history can answer.
 */
export async function recordReferrers(site, ga, days = REFERRAL_WINDOW_DAYS) {
  const db = forSite(site.id);

  let report;
  try {
    report = await fetchReferrers(ga, days);
  } catch (e) {
    return { available: false, why: e.message, found: [], newly: [] };
  }
  if (!report.available) {
    return { available: false, why: "no GA4 property set for this title", found: [], newly: [] };
  }

  // Our own domain shows up as a referral whenever a session breaks across a
  // redirect, and a title linking to itself is not a backlink.
  const self = siteHost(site);
  const rows = report.rows.filter((r) => r.domain !== self && !r.domain.endsWith(`.${self}`));

  const known = await db.referringDomain.findMany({
    where: { domain: { in: rows.map((r) => r.domain) } },
    select: { domain: true, ignored: true },
  });
  const seen = new Map(known.map((k) => [k.domain, k]));
  const now = new Date();
  const newly = [];

  for (const row of rows) {
    const existing = seen.get(row.domain);
    if (!existing) newly.push(row);
    await db.referringDomain.upsert({
      where: { domain: row.domain },
      create: {
        domain: row.domain,
        landingPage: row.landingPage,
        sessions: row.sessions,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      // firstSeenAt is never touched on update. It is the one field here that
      // answers "when did we get this link", and an upsert that refreshed it
      // would quietly reset every domain's discovery date on every sweep.
      update: { landingPage: row.landingPage, sessions: row.sessions, lastSeenAt: now },
    });
  }

  // Domains already marked as noise stay out of the report, but are still
  // upserted above so their session counts remain current if JB un-ignores one.
  return {
    available: true,
    days,
    found: rows.filter((r) => !seen.get(r.domain)?.ignored),
    newly: newly.filter((r) => !seen.get(r.domain)?.ignored),
  };
}

/** Everything we have ever seen link to this title, newest find first. */
export async function listReferrers(siteId, { includeIgnored = false } = {}) {
  const db = forSite(siteId);
  return db.referringDomain.findMany({
    where: includeIgnored ? {} : { ignored: false },
    orderBy: [{ firstSeenAt: "desc" }, { sessions: "desc" }],
  });
}

/** How many distinct sites had linked us as at the end of each given day. */
export async function referrersSeenByDay(siteId) {
  const db = forSite(siteId);
  const rows = await db.referringDomain.findMany({
    where: { ignored: false },
    select: { firstSeenAt: true },
    orderBy: { firstSeenAt: "asc" },
  });
  // Cumulative: a link found in July is still a link in August.
  return (day) => rows.filter((r) => r.firstSeenAt <= day).length;
}
