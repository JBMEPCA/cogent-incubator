// Turning a title's stored domain into a link, and nothing else.
//
// These two lived in lib/voice.js, which is where the agents' prompt builders
// are. That was fine while only server code needed them, but voice.js imports
// site.js, and site.js imports Prisma — so a client component that wanted a
// title's homepage URL would drag the database client into the browser bundle.
//
// So they live here, in a module that imports nothing, and voice.js re-exports
// them for the eight server modules that already import them from there.

/** The site's own domain, bare. Falls back to nothing rather than to a guess. */
export function siteHost(site) {
  return String(site?.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "") || null;
}

/**
 * The site's public homepage, or null when it has no domain yet.
 *
 * Null is the useful answer for a title still in `setup`: the interface can
 * then show the slug as plain text rather than offering a link to https://
 * that goes nowhere.
 */
export function siteUrl(site) {
  const host = siteHost(site);
  return host ? `https://${host}` : null;
}

/**
 * The URL to actually offer as a link, or null if there is nothing there yet.
 *
 * A title in `setup` has usually had its domain typed in before the site behind
 * it exists — Barbering Business had barberingbusiness.co.uk on the row days
 * before the domain resolved. Offering that as a link is worse than offering
 * nothing: it looks like the website is up and reads as a broken app when it
 * turns out not to be. Every other status means the site is serving.
 */
export function visitUrl(site) {
  if (!site || site.status === "setup") return null;
  return siteUrl(site);
}
