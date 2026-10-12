import { fleetRead } from "./prisma";
import { brandType } from "./advertiser-groups";

// Reads for the advertiser list. Writes live in advertiser-actions.js.

export const OUTCOMES = [
  { value: "sent", label: "Sent", chip: "chip-general" },
  { value: "replied", label: "Replied", chip: "chip-content" },
  { value: "handed_over", label: "With sales", chip: "chip-brand" },
  { value: "declined", label: "Not interested", chip: "chip-general" },
  { value: "bounced", label: "Bounced", chip: "chip-monetise" },
];

export const outcomeInfo = (v) => OUTCOMES.find((o) => o.value === v) || OUTCOMES[0];

// How long an advertiser is left alone after an offer, fleet-wide. The send
// path will enforce it; the list uses it to show who is resting.
export const OFFER_REST_DAYS = 42;

// A backlink email that went out this recently, with no outcome yet, still
// counts as a conversation in progress.
const OUTREACH_OPEN_DAYS = 21;

// Interview statuses where the person is mid-conversation with an editor.
const INTERVIEW_OPEN = new Set(["pending", "asked", "agreed", "questioned", "answered", "drafted"]);

const latest = (...ds) => ds.filter(Boolean).reduce((a, d) => (!a || d > a ? d : a), null);

/**
 * Editorial contact with each domain, across every title: the date we last
 * wrote to them about a backlink or an interview, and whether that
 * conversation is still open.
 *
 * This is what keeps a sales pitch from landing in the same week as "we'd love
 * to interview your MD". Matched on the contact's email domain, plus the
 * interview's own companyDomain. Returns Map(domain → { lastAt, open, what }).
 */
export async function editorialByDomain(domains) {
  const out = new Map();
  const list = [...new Set(domains.filter(Boolean))];
  if (!list.length) return out;
  const db = fleetRead();
  const ends = list.map((d) => ({ endsWith: `@${d}` }));

  const [outreach, interviews] = await Promise.all([
    db.outreachEmail.findMany({
      where: { OR: ends.map((e) => ({ contactEmail: e })) },
      select: { contactEmail: true, status: true, sentAt: true, followUpSentAt: true, createdAt: true },
    }),
    db.interviewTarget.findMany({
      where: { OR: [{ companyDomain: { in: list } }, ...ends.map((e) => ({ email: e }))] },
      select: {
        email: true, companyDomain: true, status: true, publishedAt: true, notifiedAt: true,
        askedAt: true, agreedAt: true, questionsSentAt: true, answeredAt: true, createdAt: true,
      },
    }),
  ]);

  const note = (domain, at, open, what) => {
    if (!domain || !list.includes(domain)) return;
    const cur = out.get(domain) || { lastAt: null, open: false, what: null };
    if (at && (!cur.lastAt || at > cur.lastAt)) {
      cur.lastAt = at;
      cur.what = what;
    }
    if (open) {
      cur.open = true;
      cur.what = what;
    }
    out.set(domain, cur);
  };

  const cutoff = Date.now() - OUTREACH_OPEN_DAYS * 864e5;
  for (const o of outreach) {
    const domain = o.contactEmail?.split("@")[1]?.toLowerCase();
    const at = latest(o.sentAt, o.followUpSentAt);
    const open =
      o.status === "pending" ||
      o.status === "approved" ||
      o.status === "replied" ||
      (o.status === "sent" && at && at.getTime() > cutoff);
    note(domain, at, open, "Backlink");
  }
  for (const t of interviews) {
    const domain = t.companyDomain?.toLowerCase() || t.email?.split("@")[1]?.toLowerCase();
    const at = latest(t.askedAt, t.agreedAt, t.questionsSentAt, t.answeredAt, t.notifiedAt);
    const open = INTERVIEW_OPEN.has(t.status) || (t.status === "published" && !t.notifiedAt);
    note(domain, at, open, "Interview");
  }
  return out;
}

/** Map(domain → optedOutAt) for the given domains, from the global opt-out list. */
export async function optOutsFor(domains, db = fleetRead()) {
  const list = [...new Set(domains.filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await db.outreachOptOut.findMany({ where: { domain: { in: list } } });
  return new Map(rows.map((r) => [r.domain, r.optedOutAt]));
}

// ---------------------------------------------------------------- browsing

// Research notes start "Tier A (...)" when there is evidence the brand already
// pays to reach that audience (exhibitor, sponsor, paid listing).
export const TIER_A = { notes: { contains: "Tier A" } };
const NOT_TIER_A = { OR: [{ notes: null }, { NOT: TIER_A }] };

/** A brand counts for a title when tagged with it, or tagged "all titles". */
export const titleScope = (siteId) => ({ OR: [{ siteIds: { has: siteId } }, { siteIds: { isEmpty: true } }] });

/**
 * The list's filters as Prisma conditions, shared by the page and the CSV
 * export so the export is always exactly what is on screen.
 *
 * Brand types are derived from the free-text category (see
 * advertiser-groups.js), so filtering by one means listing the categories that
 * fold into it. Returns { and, typeCounts, total }: `and` is the full filter,
 * `typeCounts` counts each brand type under every other filter, so the chips
 * show what clicking them would give.
 */
export async function advertiserFilter(db, { siteId, q, show, tierA, type, restSince }) {
  const and = [];
  if (siteId) and.push(titleScope(siteId));
  if (q) {
    and.push({
      OR: [
        { company: { contains: q, mode: "insensitive" } },
        { domain: { contains: q.toLowerCase() } },
        { category: { contains: q, mode: "insensitive" } },
        { contacts: { some: { email: { contains: q.toLowerCase() } } } },
      ],
    });
  }
  if (show === "contacts") and.push({ contacts: { some: {} } });
  if (show === "nocontacts") and.push({ contacts: { none: {} } });
  if (show === "offered") and.push({ offers: { some: {} } });
  // "Ready" is finished by the page, because the opt-out and editorial checks
  // are not in this table; the query narrows to what it can.
  if (show === "ready") and.push({ contacts: { some: {} } }, { offers: { none: { sentAt: { gte: restSince } } } });
  if (tierA) and.push(TIER_A);

  const cats = await db.advertiser.groupBy({ by: ["category"], where: { AND: and }, _count: { _all: true } });
  const typeCounts = {};
  let total = 0;
  for (const c of cats) {
    const k = brandType(c.category).key;
    typeCounts[k] = (typeCounts[k] || 0) + c._count._all;
    total += c._count._all;
  }
  if (type) {
    const inType = cats.filter((c) => brandType(c.category).key === type);
    const named = inType.map((c) => c.category).filter((c) => c != null);
    const hasNull = inType.some((c) => c.category == null);
    and.push({ OR: [{ category: { in: named } }, ...(hasNull ? [{ category: null }] : [])] });
    total = typeCounts[type] || 0;
  }
  return { and, typeCounts, total };
}

/**
 * One page of brands, tier A first: the brands already paying to reach this
 * audience are who to contact first, so they lead every view.
 */
export async function advertiserPage(db, and, { skip, take, include }) {
  const whereA = { AND: [...and, TIER_A] };
  const whereRest = { AND: [...and, NOT_TIER_A] };
  const countA = await db.advertiser.count({ where: whereA });
  const order = [{ company: "asc" }];
  let rowsA = [];
  let rowsRest = [];
  if (skip < countA) {
    rowsA = await db.advertiser.findMany({ where: whereA, orderBy: order, skip, take, include });
    const left = take - rowsA.length;
    if (left > 0) rowsRest = await db.advertiser.findMany({ where: whereRest, orderBy: order, skip: 0, take: left, include });
  } else {
    rowsRest = await db.advertiser.findMany({ where: whereRest, orderBy: order, skip: skip - countA, take, include });
  }
  return { rows: [...rowsA, ...rowsRest], countA };
}
