// Every backlink we know about, as { siteId, host, at }: the first time each
// linking domain was won, per title.
//
// Three sources, counted once each by domain: outreach links confirmed on the
// brand's site or from their reply, interview subjects who linked back, and
// sites GA4 saw sending us readers. A brand we emailed that then sends us
// traffic is one referring domain, not two. Used by the per-title authority
// chart (lib/metrics.js) and the home page backlinks ring
// (lib/monthly-targets.js), so the two always agree. The press desk's wins
// arrive as referrers with source "reply" (lib/link-replies.js).

import { fleetRead } from "./prisma";
import { isNotABacklink, fleetHosts } from "./backlink-noise";

const hostOf = (url) => {
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

/** `db` is forSite(id) for one title or fleetRead() for all; `siteIds` narrows. */
export async function backlinkEvents(db, siteIds) {
  const scope = siteIds ? { siteId: { in: siteIds } } : {};
  const [outreach, interviews, referrers, own] = await Promise.all([
    db.outreachEmail.findMany({
      where: { ...scope, linkedAt: { not: null } },
      select: { siteId: true, linkedAt: true, linkUrl: true, brand: { select: { website: true } } },
    }),
    db.interviewTarget.findMany({
      where: { ...scope, linkedAt: { not: null } },
      select: { siteId: true, linkedAt: true, linkUrl: true, companyDomain: true },
    }),
    db.referringDomain.findMany({
      where: { ...scope, ignored: false },
      select: { siteId: true, firstSeenAt: true, domain: true, source: true },
    }),
    fleetHosts(fleetRead()),
  ]);

  // A row whose link is on one of our own titles is the sweep finding us on
  // our own site, not a win: Tróia Golf and Cybix on 29 Oct 2026.
  const notOurs = (e) => !own.includes(e.host);

  const all = [
    ...outreach.map((r) => ({ siteId: r.siteId, at: r.linkedAt, host: hostOf(r.linkUrl || r.brand?.website || "") })).filter(notOurs),
    ...interviews.map((r) => ({ siteId: r.siteId, at: r.linkedAt, host: hostOf(r.linkUrl || r.companyDomain || "") })).filter(notOurs),
    // Social posts, search engines, pasted links and our own titles are not
    // backlinks (lib/backlink-noise.js); a domain typed in by hand always counts.
    ...referrers
      .filter((r) => r.source === "manual" || !isNotABacklink(r.domain, own))
      .map((r) => ({ siteId: r.siteId, at: r.firstSeenAt, host: String(r.domain).toLowerCase() })),
  ].filter((e) => e.host && e.at);

  // Earliest per title and domain.
  const first = new Map();
  for (const e of all) {
    const k = `${e.siteId} ${e.host}`;
    const prev = first.get(k);
    if (!prev || e.at < prev.at) first.set(k, e);
  }
  return [...first.values()].sort((a, b) => a.at - b.at);
}
