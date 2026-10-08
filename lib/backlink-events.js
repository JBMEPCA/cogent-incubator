// Every backlink we know about, as { siteId, host, at }: the first time each
// linking domain was won, per title.
//
// Three sources, counted once each by domain: outreach links confirmed on the
// brand's site or from their reply, interview subjects who linked back, and
// sites GA4 saw sending us readers. A brand we emailed that then sends us
// traffic is one referring domain, not two. Used by the per-title authority
// chart (lib/metrics.js) and the home page backlinks ring
// (lib/monthly-targets.js), so the two always agree.

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
  const [outreach, interviews, referrers] = await Promise.all([
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
      select: { siteId: true, firstSeenAt: true, domain: true },
    }),
  ]);

  const all = [
    ...outreach.map((r) => ({ siteId: r.siteId, at: r.linkedAt, host: hostOf(r.linkUrl || r.brand?.website || "") })),
    ...interviews.map((r) => ({ siteId: r.siteId, at: r.linkedAt, host: hostOf(r.linkUrl || r.companyDomain || "") })),
    ...referrers.map((r) => ({ siteId: r.siteId, at: r.firstSeenAt, host: String(r.domain).toLowerCase() })),
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
