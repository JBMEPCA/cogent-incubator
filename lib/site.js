import { prisma, forSite } from "./prisma.js";
import { decryptJson, encryptJson, redact, isCryptoConfigured } from "./crypto.js";

// The site context every library and page reads instead of process.env.
//
// Smart SME asked `process.env.WP_URL` at the point of use, which worked
// because there was exactly one answer. Here the answer depends on which title
// is being rendered, so it is resolved once per request and passed down.

/** The credential kinds a title can hold, and what each one gates. */
export const CREDENTIAL_KINDS = {
  wordpress: {
    label: "WordPress",
    fields: ["url", "username", "appPassword"],
    // Without it nothing can publish, so a title cannot leave setup without it.
    required: true,
    // The integration account is deliberately an EDITOR, not an administrator:
    // it can publish posts and pages over REST but gets rest_forbidden on
    // /wp/v2/settings. Site settings stay a human job in wp-admin. Do not widen.
    note: "Application password from an editor-role account, not an administrator.",
  },
  google_analytics: {
    label: "Search Console & GA4",
    fields: ["gscSiteUrl", "ga4PropertyId"],
    required: true,
    note: "Domain properties use the sc-domain: form. Grant the fleet service account access in both consoles.",
  },
  mailchimp: {
    label: "Newsletter",
    fields: ["audienceId", "fromEmail"],
    required: false,
    note: "Can lag behind launch — the newsletter is off until the sending domain is authenticated.",
  },
  // NO linkedin ENTRY, deliberately. A LinkedIn connection is an OAuth grant,
  // not a set of fields somebody types: the token is minted by the callback and
  // rotates. Offering it here was worse than offering nothing, because the
  // posting cron gated on this row while the OAuth callback wrote somewhere
  // else entirely, so every title read as "not connected" for ever. The
  // connection lives in EngineSetting under "linkedin:auth" and the LinkedIn
  // page is where it is bound, shown and disconnected.
  // Theme files are the one thing the engine cannot reach over REST: the
  // integration account is deliberately an editor, and installing a theme needs
  // an administrator. Without this every CSS tweak is a manual zip upload, which
  // is survivable at one title and absurd at twenty-five.
  //
  // Key-based only, on purpose. There is no password field here and there
  // should never be one: the private key lives on the machine doing the deploy
  // and only the public half is ever pasted into the host's control panel.
  sftp: {
    label: "Theme deploy (SFTP)",
    fields: ["host", "port", "username", "themePath", "privateKeyPath"],
    required: false,
    note: "SSH key based. Paste the public key into the host's SSH Keys Manager; only the private key PATH is stored here, never a key or a password.",
  },
  outreach: {
    label: "Outreach email",
    fields: ["fromEmail", "fromName", "replyTo", "postalAddress"],
    required: false,
    // UK B2B outreach needs a real identifiable sender and a postal address in
    // the footer; the send path refuses without one.
    note: "MX must point at Google before launch, or reply detection is blind — see docs/game-plan.md §6.3.",
  },
};

const SELECT_PUBLIC = {
  id: true, slug: true, name: true, strapline: true, domain: true, status: true,
  timezone: true, launchedAt: true,
  markPrimary: true, markAccent: true, accentHex: true, accent2Hex: true,
  markUrl: true, logoUrl: true, faviconUrl: true,
  bylineMode: true, authorName: true, authorEmail: true, sections: true,
  sectionTarget: true, wordFloorGuide: true, wordFloorNews: true,
  engineEnabled: true, officeHoursStart: true, officeHoursEnd: true,
  dailySpendCapUsd: true, articlesPerDayTarget: true,
  newsletterEnabled: true, linkedInEnabled: true, outreachEnabled: true,
  createdAt: true, updatedAt: true,
};

/** Every title, for the rail and the fleet overview. Cheap — no credentials. */
export function listSites() {
  return prisma.site.findMany({
    where: { status: { not: "archived" } },
    select: SELECT_PUBLIC,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

/** One title by slug, without credentials. Returns null if there isn't one. */
export function getSite(slug) {
  return prisma.site.findUnique({ where: { slug }, select: SELECT_PUBLIC });
}

/**
 * A title plus its decrypted credentials and a scoped db handle.
 *
 * Server-side only. Never hand the result of this to a client component — see
 * toClientSite() for the shape that is safe to serialise into a page.
 */
export async function getSiteContext(slug) {
  const site = await prisma.site.findUnique({
    where: { slug },
    select: { ...SELECT_PUBLIC, editorialStandardMd: true, houseStyleMd: true },
  });
  if (!site) return null;

  const { creds, health } = await siteCredentials(site.id);
  return { site, creds, health, db: forSite(site.id), sections: normaliseSections(site.sections) };
}

/**
 * One title's decrypted credentials, by id.
 *
 * Split out of getSiteContext because the agents and the cron jobs are handed a
 * site ROW, not a context, and rewriting eleven agent signatures to carry
 * credentials down would touch far more code than fetching them at the two or
 * three places that actually need a password. Server-side only.
 */
export async function siteCredentials(siteId) {
  const rows = await forSite(siteId).siteCredential.findMany({});

  const creds = {};
  const health = {};
  for (const row of rows) {
    health[row.kind] = { healthy: row.healthy, lastError: row.lastError, checkedAt: row.checkedAt };
    try {
      creds[row.kind] = decryptJson(row.payloadEnc);
    } catch (err) {
      // A credential that will not decrypt is a real incident — usually a
      // rotated or truncated CREDENTIAL_KEY. Surface it rather than silently
      // behaving as though the integration was never configured, which would
      // look identical from the outside and send someone hunting in the wrong
      // place.
      creds[row.kind] = null;
      health[row.kind] = { healthy: false, lastError: `undecryptable: ${err.message}`, checkedAt: null };
    }
  }

  return { creds, health };
}

/** Record what a liveness probe found, so a dead credential shows as a red dot. */
export async function recordCredentialHealth(siteId, kind, { healthy, error = null }) {
  return forSite(siteId).siteCredential.updateMany({
    where: { kind },
    data: { healthy, lastError: healthy ? null : String(error || "").slice(0, 500), checkedAt: new Date() },
  });
}

/** Strip anything a browser has no business holding. */
export function toClientSite(site) {
  if (!site) return null;
  const { editorialStandardMd, houseStyleMd, ...rest } = site;
  return rest;
}

/** What the settings page may show: which fields are set, never their values. */
export async function credentialSummary(siteId) {
  const rows = await forSite(siteId).siteCredential.findMany({});
  const byKind = {};
  for (const row of rows) {
    let fields = {};
    try {
      fields = redact(decryptJson(row.payloadEnc));
    } catch {
      fields = { error: "undecryptable" };
    }
    byKind[row.kind] = {
      configured: true,
      healthy: row.healthy,
      lastError: row.lastError,
      checkedAt: row.checkedAt,
      fields,
    };
  }
  for (const kind of Object.keys(CREDENTIAL_KINDS)) {
    if (!byKind[kind]) byKind[kind] = { configured: false, healthy: null, fields: {} };
  }
  return byKind;
}

/** Write or replace one credential. Values are encrypted before they land. */
export async function saveCredential(siteId, kind, payload) {
  if (!CREDENTIAL_KINDS[kind]) throw new Error(`Unknown credential kind: ${kind}`);
  if (!isCryptoConfigured()) {
    throw new Error("CREDENTIAL_KEY is not set — refusing to store a credential in plaintext");
  }
  const payloadEnc = encryptJson(payload);
  return forSite(siteId).siteCredential.upsert({
    where: { siteId_kind: { siteId, kind } },
    create: { kind, payloadEnc },
    update: { payloadEnc, healthy: null, lastError: null, checkedAt: null },
  });
}

/**
 * Sections as [{ name, target, commissionable }].
 *
 * Replaces the hardcoded SECTIONS array and MANUFACTURED map. Two sections are
 * typically not commissionable: News is dated by definition, so writing it to
 * hit a quota means inventing events, and a Case Study needs a real, publicly
 * reported company situation. Both still count toward the tally so the picture
 * is honest — they just cannot generate a "write three more" instruction.
 */
export function normaliseSections(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((s) => s && s.name)
    .map((s) => ({
      name: String(s.name),
      target: Number.isFinite(s.target) ? s.target : 6,
      commissionable: s.commissionable !== false,
    }));
}

/** Is this a real section for this title? Guards against invented categories. */
export function isValidSection(site, name) {
  return normaliseSections(site.sections).some((s) => s.name === name);
}

/**
 * Cold start: a new domain has no Search Console history for weeks, and the
 * Researcher's best input (queries sitting at position 7.5-30) does not exist
 * until the site ranks — which needs content, which needs the agents to run.
 * Read strictly, that is circular, so the requirement is that GSC is CONNECTED,
 * not that it returns data. In cold start the engine leans on the sources that
 * work from day one and switches itself off once real data arrives.
 */
export function isColdStart(site) {
  return site.status === "cold_start";
}

/** Can this title's agents run at all right now? */
export function engineCanRun(site) {
  if (!site.engineEnabled) return { ok: false, why: "Engine switched off for this title" };
  if (site.status === "setup") return { ok: false, why: "Still being provisioned" };
  if (site.status === "paused") return { ok: false, why: "Title paused" };
  if (site.status === "archived") return { ok: false, why: "Title archived" };
  return { ok: true };
}

/** UK-wall-clock office hours, per title, surviving the BST/GMT switch untouched. */
export function withinOfficeHours(site, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: site.timezone || "Europe/London",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  return hour >= site.officeHoursStart && hour < site.officeHoursEnd;
}
