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
import { fleetRead } from "./prisma";
import { isNotABacklink, fleetHosts } from "./backlink-noise";

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
  // The same goes for our other titles, and for sources that are not links at
  // all (social posts, search, pasted links): those are recorded, so their
  // traffic stays visible, but as ignored from the start.
  const self = siteHost(site);
  const own = await fleetHosts(fleetRead());
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
        ignored: isNotABacklink(row.domain, own),
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
    found: rows.filter((r) => !seen.get(r.domain)?.ignored && !isNotABacklink(r.domain, own)),
    newly: newly.filter((r) => !seen.get(r.domain)?.ignored && !isNotABacklink(r.domain, own)),
  };
}

/** Everything we have ever seen link to this title, newest find first. */
export async function listReferrers(siteId, { includeIgnored = false } = {}) {
  const db = forSite(siteId);
  const [rows, own] = await Promise.all([
    db.referringDomain.findMany({
      where: includeIgnored ? {} : { ignored: false },
      orderBy: [{ firstSeenAt: "desc" }, { sessions: "desc" }],
    }),
    fleetHosts(fleetRead()),
  ]);
  // Rows recorded before the noise list existed are still marked live in the
  // table; leave them out here rather than rewriting history.
  return includeIgnored ? rows : rows.filter((r) => r.source === "manual" || !isNotABacklink(r.domain, own));
}

/** How many distinct sites had linked us as at the end of each given day. */
export async function referrersSeenByDay(siteId) {
  const db = forSite(siteId);
  const [all, own] = await Promise.all([
    db.referringDomain.findMany({
      where: { ignored: false },
      select: { firstSeenAt: true, domain: true, source: true },
      orderBy: { firstSeenAt: "asc" },
    }),
    fleetHosts(fleetRead()),
  ]);
  const rows = all.filter((r) => r.source === "manual" || !isNotABacklink(r.domain, own));
  // Cumulative: a link found in July is still a link in August.
  return (day) => rows.filter((r) => r.firstSeenAt <= day).length;
}
