// Ahrefs Domain Rating for every fleet title and CIM's established titles,
// kept in one GlobalSetting row with the date each figure was taken.
//
// Refreshed once a day by /api/cron/domain-rating through Ahrefs' free
// endpoint, /v3/public/domain-rating-free. It costs nothing but needs an APIv3
// key from a free Ahrefs account, in AHREFS_API_KEY. Without one the cron
// leaves the stored figures alone, so the panel keeps showing the last
// figures and their dates rather than going blank. Ahrefs' licence asks for
// the attribution "Domain Rating by Ahrefs" wherever the figures appear.
import { prisma } from "./prisma";
import { LEGACY_TITLES } from "./pulse";

const KEY = "domain_ratings";

export async function readDomainRatings() {
  const row = await prisma.globalSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  let stored = {};
  try {
    stored = JSON.parse(row?.value || "{}");
  } catch {
    stored = {};
  }
  return stored.ratings || {};
}

/** Ratings keyed by fleet slug and by legacy title name, for the panel. */
export async function domainRatingsForPanel() {
  const ratings = await readDomainRatings();
  const sites = await prisma.site.findMany({ select: { slug: true, domain: true } });
  const bySlug = {};
  for (const s of sites) if (s.domain && ratings[s.domain]) bySlug[s.slug] = ratings[s.domain];
  const byName = {};
  for (const t of LEGACY_TITLES) if (ratings[t.domain]) byName[t.name] = ratings[t.domain];
  return { bySlug, byName };
}

export async function saveDomainRatings(updates) {
  const ratings = { ...(await readDomainRatings()), ...updates };
  const value = JSON.stringify({ ratings });
  await prisma.globalSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return ratings;
}

export async function refreshDomainRatings() {
  const token = (process.env.AHREFS_API_KEY || "").trim();
  if (!token) return { skipped: "AHREFS_API_KEY is not set; stored ratings left as they are" };

  const sites = await prisma.site.findMany({
    where: { status: { in: ["live", "cold_start"] } },
    select: { domain: true },
  });
  const domains = [...new Set([...sites.map((s) => s.domain), ...LEGACY_TITLES.map((t) => t.domain)].filter(Boolean))];
  const at = new Date().toISOString().slice(0, 10);
  const updates = {};
  const errors = [];
  for (const d of domains) {
    try {
      const res = await fetch(
        `https://api.ahrefs.com/v3/public/domain-rating-free?target=${encodeURIComponent(d)}&output=json`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const dr = Number(json?.domain_rating?.domain_rating);
      if (!Number.isFinite(dr)) throw new Error("no domain_rating in response");
      updates[d] = { dr, at, source: "ahrefs-api" };
    } catch (e) {
      errors.push(`${d}: ${e.message}`);
    }
  }
  if (Object.keys(updates).length) await saveDomainRatings(updates);
  return { updated: Object.keys(updates).length, errors };
}
