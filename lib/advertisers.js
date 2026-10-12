import { fleetRead } from "./prisma";

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
