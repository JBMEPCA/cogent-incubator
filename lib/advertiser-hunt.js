import { prisma } from "./prisma";
import { huntBestContact } from "./contact-hunt";
import { TIER_A } from "./advertisers";

// Finding a contact for each advertiser from its own website: the free half of
// contact finding (Apollo, for named people, comes later).
//
// What it finds is the inbox a brand publishes, ranked marketing@ first, then
// partnerships, press and comms, then hello@/info@ (see huntBestContact). That
// is a company address, which UK PECR allows cold B2B email to, and a real
// one, because it was printed on the brand's own site. Nothing is verified
// here; MillionVerifier stays a separate step before anything is sent.
//
// The sweep walks the list in id order, tier A first, and keeps its place in
// GlobalSetting so every brand is tried once rather than the same slow sites
// being retried every tick. A brand with nothing usable gets a dated line in
// its notes, which is both the record for people and how the page counts
// what has been checked.

const KEY = "advertiser_contact_hunt";
const CHECKED = "Website checked";
const HUNT_CAP_MS = 25000;

const ukDay = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

const withCap = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms))]);

/**
 * Hunt one brand and record the outcome. Returns { email } when a contact was
 * added, { skipped } when there was nothing to do, or { none } with a reason.
 */
export async function huntAdvertiser(advertiser) {
  const { id, domain } = advertiser;
  const optedOut = await prisma.outreachOptOut.findUnique({ where: { domain } });
  if (optedOut) return { skipped: "opted out" };

  const result = await withCap(huntBestContact(domain).catch(() => null), HUNT_CAP_MS);
  if (result?.timedOut) return note(id, "site too slow to read");
  if (!result?.email) return note(id, "no usable address published");

  // One email belongs to one brand across the fleet; a group's shared inbox
  // already filed under a sister brand is not added twice.
  const clash = await prisma.advertiserContact.findUnique({ where: { email: result.email } });
  if (clash) return note(id, `only ${result.email}, already listed under another brand`);

  await prisma.advertiserContact.create({
    data: {
      advertiserId: id,
      email: result.email,
      jobTitle: inboxLabel(result.email),
      source: "website",
    },
  });
  return { email: result.email, page: result.page };
}

const ROLE_INBOXES = new Set([
  "marketing", "partnerships", "partners", "advertising", "brand", "digital", "press", "media", "pr",
  "comms", "communications", "hello", "info", "enquiries", "enquiry", "contact", "office", "team", "mail",
]);

/** "marketing@brand.co.uk" → "Marketing inbox (from website)", so the row says what it is. */
function inboxLabel(email) {
  const local = email.split("@")[0].split("+")[0].toLowerCase();
  if (ROLE_INBOXES.has(local)) return `${local.charAt(0).toUpperCase()}${local.slice(1)} inbox (from website)`;
  return "Named address (from website)";
}

async function note(id, why) {
  const a = await prisma.advertiser.findUnique({ where: { id }, select: { notes: true } });
  const line = `${CHECKED} ${ukDay()}: ${why}.`;
  await prisma.advertiser.update({
    where: { id },
    data: { notes: a?.notes ? `${a.notes}\n${line}` : line },
  });
  return { none: why };
}

async function readCursor() {
  const row = await prisma.globalSetting.findUnique({ where: { key: KEY } });
  try {
    return { phase: "A", afterId: "", checked: 0, found: 0, ...(row ? JSON.parse(row.value) : {}) };
  } catch {
    return { phase: "A", afterId: "", checked: 0, found: 0 };
  }
}

const writeCursor = (c) =>
  prisma.globalSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(c) },
    update: { value: JSON.stringify(c) },
  });

const phaseWhere = (phase) => (phase === "A" ? TIER_A : { OR: [{ notes: null }, { NOT: TIER_A }] });

/**
 * One sweep: as many brands as fit in `budgetMs`, `concurrency` at a time.
 * Brands that already have a contact, or were checked before, are passed over.
 */
export async function runAdvertiserHunt({ budgetMs = 80000, concurrency = 25 } = {}) {
  const started = Date.now();
  const cursor = await readCursor();
  const totals = { checked: 0, found: 0, phase: cursor.phase };
  if (cursor.phase === "done") return { ...totals, done: true };

  const queue = await prisma.advertiser.findMany({
    where: {
      AND: [
        phaseWhere(cursor.phase),
        { contacts: { none: {} } },
        { OR: [{ notes: null }, { NOT: { notes: { contains: CHECKED } } }] },
        ...(cursor.afterId ? [{ id: { gt: cursor.afterId } }] : []),
      ],
    },
    orderBy: { id: "asc" },
    take: 800,
    select: { id: true, domain: true },
  });

  if (!queue.length) {
    // This phase is finished: move on to the rest of the list, or stop.
    await writeCursor({ ...cursor, phase: cursor.phase === "A" ? "rest" : "done", afterId: "" });
    return { ...totals, phaseFinished: cursor.phase };
  }

  let next = 0;
  let lastStarted = -1;
  const worker = async () => {
    // Stop taking new brands once a full hunt might not fit in what is left.
    while (next < queue.length && Date.now() - started < budgetMs - HUNT_CAP_MS) {
      const i = next++;
      lastStarted = Math.max(lastStarted, i);
      const r = await huntAdvertiser(queue[i]).catch(() => ({ none: "error" }));
      totals.checked++;
      if (r.email) totals.found++;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  await writeCursor({
    ...cursor,
    afterId: lastStarted >= 0 ? queue[lastStarted].id : cursor.afterId,
    checked: cursor.checked + totals.checked,
    found: cursor.found + totals.found,
    updatedAt: new Date().toISOString(),
  });
  return { ...totals, seconds: Math.round((Date.now() - started) / 1000) };
}

/** Progress for the page: how far the website sweep has got. */
export async function huntProgress() {
  const cursor = await readCursor();
  const [withContact, fromWebsite, checkedNone, total] = await Promise.all([
    prisma.advertiser.count({ where: { contacts: { some: {} } } }),
    prisma.advertiserContact.count({ where: { source: "website" } }),
    prisma.advertiser.count({ where: { contacts: { none: {} }, notes: { contains: CHECKED } } }),
    prisma.advertiser.count(),
  ]);
  return { ...cursor, withContact, fromWebsite, checkedNone, total, remaining: total - withContact - checkedNone };
}
