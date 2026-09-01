// The interview franchise: "SME Leaders: Joe Bloggs" and its equivalents.
//
// A person-led article promotes itself. The subject shares it, their employer
// links to it from their own news page, and the backlink arrives without
// anyone asking for one. That is the whole reason this exists, and it is why
// `notifiedAt` matters as much as `publishedAt` further down.
//
// The exchange is two steps, not one. A short pre-ask ("may I send you some
// questions?") converts far better than questions up front: it reads personal,
// it is two lines rather than twenty, and a yes is a commitment that roughly
// doubles the odds of the answers actually coming back.

import { sendGmail, isGmailConfigured } from "./gmail";
// House rule, already enforced on every article: no em dashes, anywhere. They
// are the clearest tell that a machine wrote the sentence, which is a bad look
// for a franchise whose whole promise is that a person did.
import { stripEmDashes } from "./drafting";

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

// How much to trust an address, worst to best. Provenance decides how the mail
// is written, not just whether to send it: a generic inbox needs a line asking
// whoever opens it to pass it on, and a published personal address does not.
export const EMAIL_SOURCES = {
  verified: "personal mailbox, confirmed live",
  published: "printed in a press release",
  site: "on the company's own website",
  pattern: "inferred from the domain",
  generic: "the company's general inbox",
  hunted: "found on the company's own site by the contact hunter",
};

// Every plausible personal address for a person at a domain, most likely
// first. These are CANDIDATES, not addresses to send to: resolveAddress()
// puts each one through a live mailbox probe and discards all but a
// confirmed hit. Nothing here is ever mailed unverified.
export function addressCandidates(personName, domain) {
  if (!domain) return [];
  const clean = String(domain).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return namePairs(personName).flatMap(({ first, last }) => [
    `${first}@${clean}`,
    `${first}.${last}@${clean}`,
    `${first[0]}${last}@${clean}`,
    `${first[0]}.${last}@${clean}`,
    `${first}${last}@${clean}`,
  ]);
}

// The name has to be cleaned the way greetingName() cleans it, and for the
// same reason. A plain split on whitespace makes "Dr Mark Owen Williams" ask
// for dr@, "Wade Lyn CBE" ask for wade.cbe@, and "Ross Evans and Ashley
// Weight" ask for ross.weight@, who does not exist. All three were in the
// first batch's candidate list, so the probe spent its credits on addresses
// that could never have existed and fell through to the generic inbox looking
// like it had genuinely tried.
//
// A jointly founded business gets candidates for both founders, first named
// first. "Oli and Emily Arnold" leaves the first half no surname of its own,
// so it borrows the one at the end.
function namePairs(personName) {
  const cleaned = String(personName || "").replace(POST_NOMINALS, "").replace(/\s+/g, " ").trim();
  const people = cleaned.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
  const surnames = people.map(surnameOf);
  const tail = surnames.filter(Boolean).pop() || "";
  return people
    .map((p, i) => ({ first: letters(firstNameOf(p)), last: letters(surnames[i] || tail) }))
    .filter((p) => p.first && p.last);
}

const letters = (s) => String(s || "").toLowerCase().replace(/[^a-z-]/g, "");

function surnameOf(name) {
  const words = String(name).trim().split(/\s+/).filter((w) => !HONORIFICS.has(w.toLowerCase().replace(/\./g, "")));
  return words.length >= 2 ? words[words.length - 1] : "";
}

const splitTried = (t) => String(t || "").split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Pick the address to write to.
 *
 * Order of preference:
 *   1. a personal address a human published next to the person's name
 *   2. a personal mailbox `verify` confirms exists, IF a verifier is passed
 *   3. an address a human published (press inbox, then site, then generic)
 *   4. whatever `hunt` reads off the company's own website
 *   5. nothing. A guess is never sent to, at any step.
 *
 * **Neither `verify` nor `hunt` is on by default, and since 1 Sep 2026 the
 * callers pass only `hunt`.** JB's call: stop paying MillionVerifier for the
 * interview pipeline and write to the inbox a company publishes. The evidence
 * behind it is that both of the first two replies came through a shared inbox
 * while the fourteen personal mailboxes produced nothing, and that the shared
 * inbox demonstrably forwards, since Bionema's `info@` passed our mail to
 * Dr Ansari inside the hour and he answered from his own address.
 *
 * The `verify` branch is kept rather than deleted because it is the only way
 * to reach a named person directly and the argument may go the other way once
 * there is more than two replies to judge on. What it must never do is guess:
 * most small business domains are catch-all, so an invented address is
 * accepted, no bounce arrives, and the mail lands in an unread pile. Bouncing
 * proves an address is dead; NOT bouncing proves nothing, which is how the
 * original cascade reported eleven successes having reached nobody.
 */
export async function resolveAddress(target, { verify, hunt } = {}) {
  const tried = new Set(splitTried(target.triedEmails));
  const fresh = (a) => a && !tried.has(a.toLowerCase());

  // A published PERSONAL address outranks everything: a human put it on a
  // website next to the person's name, which is better evidence than a probe.
  if (fresh(target.publishedEmail) && !isGenericAddress(target.publishedEmail)) {
    return { email: target.publishedEmail, source: "published" };
  }

  // Track whether the probe ever actually answered. "No personal mailbox
  // exists" and "the verifier could not tell us" are completely different
  // outcomes that this function used to report identically, by quietly
  // returning the shared inbox. On 1 Sep 2026 the MillionVerifier credits ran
  // out one person into a 31 person run and the remaining thirty all fell back
  // without a word, burning their one chase on an inbox we already knew did
  // not work. Callers need to be able to stop.
  let probed = false;

  if (verify) {
    for (const addr of addressCandidates(target.personName, target.companyDomain)) {
      if (!fresh(addr)) continue;
      // Retry with a pause, because a single dropped call is not evidence of
      // anything. Without this a transient blip at the verifier silently
      // demotes a send from a personal mailbox to a shared inbox, which is the
      // exact failure this function exists to prevent, and it leaves no trace
      // saying so. Measured on batch two: run back to back over twenty people
      // the verifier dropped two or three calls a pass, and it was a different
      // two or three each time, so an immediate retry is not enough. The wait
      // is what fixes it, which points at rate limiting rather than an outage.
      const r = await verifyWithRetry(verify, addr);
      if (!r) continue; // verifier down or out of credits: fall to published
      probed = true;
      if (r.result === "ok") return { email: addr, source: "verified" };
      // invalid, catch_all and unknown all mean "do not send here". catch_all
      // is not a maybe: it is the exact case the probe cannot answer.
    }
  }

  // Asked to probe, had candidates to probe, and never got a single answer:
  // say so rather than passing a fallback off as a decision.
  const blind = Boolean(verify) && !probed && addressCandidates(target.personName, target.companyDomain).some(fresh);

  for (const [addr, source] of [
    [target.publishedEmail, "published"],
    [target.siteEmail, "site"],
    [target.genericEmail, "generic"],
  ]) {
    if (fresh(addr)) return { email: addr, source, verifierBlind: blind };
  }

  // Last resort, and since 1 Sep 2026 the usual one: read the company's own
  // site. Ranked below every hand-checked address above, because a human who
  // put an address in the seed data looked at the page and the hunter only
  // pattern matched it. Costs nothing, which is the point now that the
  // verifier is out of the picture.
  if (hunt && target.companyDomain) {
    let found;
    try {
      found = await hunt(target.companyDomain);
    } catch {
      found = null; // a site that will not load is not a verdict either
    }
    if (fresh(found?.email)) return { email: found.email, source: "hunted", verifierBlind: blind };
  }

  return blind ? { email: null, source: null, verifierBlind: true } : null;
}

/**
 * Three goes at one address, backing off, then give up and say so by returning
 * null rather than by returning a wrong answer.
 *
 * "unknown" is retried alongside a thrown error, because it is the verifier
 * saying it could not reach a conclusion, not saying the mailbox is bad. Under
 * a burst it hands back "unknown" for addresses it calls "ok" when asked
 * calmly, and treating that as a no is what quietly demoted two people to a
 * shared inbox on the 26 Aug send. "invalid" and "catch_all" are real answers
 * and are never retried.
 */
async function verifyWithRetry(verify, addr, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await verify(addr);
      if (r?.result !== "unknown") return r;
    } catch {
      // fall through to the wait
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

const GENERIC_LOCAL = new Set([
  "info", "hello", "hi", "contact", "enquiries", "enquiry", "sales", "press",
  "pr", "media", "admin", "office", "team", "support", "mail",
]);

export function isGenericAddress(email) {
  return GENERIC_LOCAL.has(String(email || "").split("@")[0].toLowerCase());
}

/** Synchronous fallback, kept for callers with no verifier to hand. */
export function nextAddress(target) {
  const tried = new Set(splitTried(target.triedEmails));
  for (const [addr, source] of [
    [target.publishedEmail, "published"],
    [target.siteEmail, "site"],
    [target.genericEmail, "generic"],
  ]) {
    if (addr && !tried.has(addr.toLowerCase())) return { email: addr, source };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

// What to put after "Hi".
//
// Naively taking the first word addresses "Dr Mark Owen Williams" as "Hi Dr,"
// and greets only Ross out of "Ross Evans and Ashley Weight". Both went out in
// a dry run before anyone noticed, which is why this is a function with its own
// rules rather than a split on whitespace.
const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "professor", "sir", "dame", "lord", "lady", "rev"]);
const POST_NOMINALS = /\b(obe|mbe|cbe|kbe|dbe|bem|qc|kc|frs|phd|ply)\b/gi;

export function greetingName(personName) {
  const cleaned = String(personName || "").replace(POST_NOMINALS, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "there";

  // A jointly founded business gets both names, or the unnamed half reads the
  // mail and sees they were an afterthought.
  const pair = cleaned.split(/\s+and\s+/i);
  if (pair.length === 2) {
    const names = pair.map((p) => firstNameOf(p)).filter(Boolean);
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
  }
  return firstNameOf(cleaned) || "there";
}

function firstNameOf(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  const first = words.find((w) => !HONORIFICS.has(w.toLowerCase().replace(/\./g, "")));
  return first || "";
}

/**
 * Step one. Two short paragraphs, a specific reason, and one question.
 *
 * **This is the copy that failed.** 31 of these went out on 26 Aug 2026 and
 * produced no replies, no declines and not one out-of-office. Do not reach for
 * it for a new batch. Use buildFollowUp() with `firstContact: true`, which is
 * the same approach carrying the three things this one is missing: a subject
 * naming the company, the word free in the opening lines, and the questions
 * themselves so that answering is the action rather than a thing to agree to
 * first. That version drew two replies inside 75 minutes.
 *
 * Kept because it is what 31 people actually received, and sendPreAsk() still
 * references it when reconstructing what was said to whom.
 */
export function buildPreAsk({ personName, company, newsHook, franchise, titleName, siteUrl, senderName, viaGeneric }) {
  const first = greetingName(personName);
  const lines = [
    `Hi ${first},`,
    "",
    `I'm ${senderName}, publisher of ${titleName}. We run a feature called ${franchise}, where we profile the people building Britain's best small businesses, and I'd like the next one to be you. ${newsHook}`,
    "",
    "It's all done by email: seven short questions, answered in your own words whenever suits you, and we publish a full profile with your photo.",
    "",
    "Are you happy for me to send the questions over?",
    "",
    "Best,",
    senderName,
    `Publisher, ${titleName}`,
    siteUrl || "",
  ];

  // Addressed to a shared inbox, so say so plainly at the top rather than
  // hoping whoever opens it works out that it is not for them.
  if (viaGeneric) {
    lines.splice(0, 1, `Hello,`, "", `Could this reach ${personName}? It is about featuring them in our magazine.`, "", `Hi ${first},`);
  }
  return stripEmDashes(lines.filter((l) => l !== null).join("\n"));
}

/** Step two, sent only after a yes. */
export function buildQuestionsEmail({ personName, questions, franchise, titleName, senderName }) {
  const first = greetingName(personName);
  const qs = (Array.isArray(questions) ? questions : String(questions || "").split("\n"))
    .map((q) => String(q).replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return stripEmDashes(
    [
      `Hi ${first},`,
      "",
      "Brilliant, thank you. Here are the questions. Answer them in as much or as little detail as you like, and there is no deadline.",
      "",
      ...qs.map((q, i) => `${i + 1}. ${q}`),
      "",
      "One last thing: please attach a high-res headshot you are happy for us to use. We will send you the live link as soon as it is published.",
      "",
      "Best,",
      senderName,
      `Publisher, ${titleName}`,
    ].join("\n")
  );
}

/**
 * The chase, and the correction.
 *
 * Thirty one pre-asks went out on 26 Aug and produced nothing: no replies, no
 * declines, not one out-of-office. Backlink outreach from the same mailbox in
 * the same week was answered by five companies, so the domain reaches people
 * and gets read. What was different was the mail. Every pre-ask carried the
 * same subject, "Featuring you in Smart SME", which is the exact shape of the
 * paid-feature pitch every managing director already deletes twice a week, and
 * nothing anywhere in it said the feature was free.
 *
 * So this fixes three things at once:
 *   - the subject names their company and says what is inside
 *   - the price is stated in the first two lines, because the reader's default
 *     assumption is that an invoice arrives at step two
 *   - the questions come with it, so replying IS the action rather than a
 *     thing they have to agree to first and then wait for
 *
 * Deliberately NOT sent as a reply on the original thread. Threading reads
 * more human, but it would inherit "Re: Featuring you in Smart SME" and put
 * the new framing behind the one subject line already proven to get nothing.
 *
 * firstContact is for the batch one people whose pre-ask went to a shared
 * inbox because of the name-splitting bug, and who now have a personal mailbox
 * that has never been written to. Apologising to them for an email they never
 * received would just be confusing.
 */
export function buildFollowUp({ personName, newsHook, questions, titleName, siteUrl, senderName, viaGeneric, firstContact }) {
  const first = greetingName(personName);
  const qs = (Array.isArray(questions) ? questions : String(questions || "").split("\n"))
    .map((q) => String(q).replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const opening = firstContact
    ? `I'm ${senderName}, publisher of ${titleName}, a UK small business title. Before you read any further: this is free, there is nothing to buy, and there is no advertising attached to it.`
    : `I wrote to you last week about featuring you in ${titleName}. I suspect it read like an advert, so let me be plain about it: this is free, there is nothing to buy, and there is no advertising attached to it.`;

  const lines = [
    `Hi ${first},`,
    "",
    opening,
    "",
    newsHook,
    "",
    "So rather than ask your permission first, here are the questions. Answer as many as you like, in your own words, whenever suits you. If you would rather not, just say so and I will not chase you again.",
    "",
    ...qs.map((q, i) => `${i + 1}. ${q}`),
    "",
    "If you have a high resolution headshot you are happy for us to use, send it with your answers. I will send you the live link the day it publishes.",
    "",
    "Best,",
    senderName,
    `Publisher, ${titleName}`,
    siteUrl || "",
  ];

  // The gatekeeper on a shared inbox is the one deciding whether to forward
  // it, so they need the price too, not just the name.
  if (viaGeneric) {
    lines.splice(0, 1, "Hello,", "", `Could this reach ${personName}? It is an invitation to be profiled in our magazine, at no cost.`, "", `Hi ${first},`);
  }
  return stripEmDashes(lines.filter((l) => l !== null).join("\n"));
}

/** Names the company and says what is inside, instead of flattering them. */
export function followUpSubject(company) {
  return stripEmDashes(`Seven questions for ${company}`);
}

/**
 * Everything above the quoted original.
 *
 * Worth doing properly rather than eyeballing it, because what follows the cut
 * is our own email coming back, questions and all. Pet Remedy's answers came
 * back from Outlook with the original bolted underneath and no ">" anywhere,
 * so a naive split left 1,477 characters of our own copy in replyBody, where
 * the drafting step would have read the questions as part of the answers.
 *
 * Take the EARLIEST marker, not the first one that matches: a reply can carry
 * more than one style at once when it has been forwarded on the way.
 */
export function stripQuotedReply(text) {
  const s = String(text || "").replace(/\r\n/g, "\n");
  const markers = [
    /\n_{10,}\s*\n/,                          // Outlook's horizontal rule
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\nOn .{0,160}\bwrote:\s*\n/,             // Gmail and Apple Mail
    /\nFrom: .+\n\s*Sent: /,                  // Outlook header block
    /\nFrom: .+\n\s*Date: /,
    /\n>{1,}\s/,                              // plain text quoting
  ];
  let cut = s.length;
  for (const m of markers) {
    const at = s.search(m);
    if (at !== -1 && at < cut) cut = at;
  }
  return s.slice(0, cut).trim();
}

const htmlise = (text) =>
  text
    .split("\n\n")
    .map(
      (p) =>
        `<p style="margin:0 0 1em 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111;">${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("");

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Send one pre-ask. Records the address tried whether or not it lands, so the
 *  cascade can never offer the same dead address twice. */
export async function sendPreAsk(db, target, { outreach, titleName, franchise, siteUrl, senderName, verify, hunt }) {
  const pick = await resolveAddress(target, { verify, hunt });
  // A blind probe is not a verdict. Holding the row leaves it re-runnable;
  // marking it exhausted would record "nobody to write to" as a fact when all
  // we actually know is that the verifier never answered.
  if (pick?.verifierBlind) {
    await db.interviewTarget.update({
      where: { id: target.id },
      data: { error: "Verifier gave no answer, so the address was never checked. Held." },
    });
    return { sent: false, reason: "verifier-blind" };
  }
  if (!pick?.email) {
    await db.interviewTarget.update({
      where: { id: target.id },
      data: { status: "exhausted", error: "No verified mailbox and no published address." },
    });
    return { sent: false, reason: "exhausted" };
  }

  const body = buildPreAsk({
    personName: target.personName,
    company: target.company,
    newsHook: target.newsHook,
    franchise,
    titleName,
    siteUrl,
    senderName,
    viaGeneric: pick.source === "generic" || pick.source === "hunted" || isGenericAddress(pick.email),
  });
  const subject = stripEmDashes(`Featuring you in ${titleName}`);

  const tried = [...splitTried(target.triedEmails), pick.email].join("\n");

  try {
    await sendGmail({ outreach, to: pick.email, toName: target.personName, subject, text: body, html: htmlise(body) });
  } catch (e) {
    await db.interviewTarget.update({
      where: { id: target.id },
      data: { status: "failed", error: String(e.message).slice(0, 400), triedEmails: tried, attempts: { increment: 1 } },
    });
    return { sent: false, reason: "send-failed", error: e.message };
  }

  await db.interviewTarget.update({
    where: { id: target.id },
    data: {
      status: "asked",
      email: pick.email,
      emailSource: pick.source,
      triedEmails: tried,
      askSubject: subject,
      askBody: body,
      askedAt: new Date(),
      error: null,
      attempts: { increment: 1 },
    },
  });
  return { sent: true, email: pick.email, source: pick.source };
}

/**
 * One chase per person, ever, guarded by followUpSentAt.
 *
 * It re-resolves the address first, because the eleven people in batch one
 * were written to at a shared inbox only because addressCandidates() was
 * splitting their names wrongly. Where that now turns up a personal mailbox
 * nobody has ever written to, the mail goes there and goes as a first
 * approach, since from that person's side it is one.
 */
export async function sendFollowUp(db, target, { outreach, titleName, siteUrl, senderName, verify, hunt }) {
  if (target.followUpSentAt) return { sent: false, reason: "already-chased" };

  // Only go looking for a better address if the first one was a shared inbox.
  // resolveAddress() skips anything already in triedEmails, so on someone who
  // was reached personally it happily returns a SECOND personal address at the
  // same domain (mitchell@ after mitchell.barnes@), and we would mail one human
  // twice while telling them it was a first approach. The address of record is
  // not a reliable test on its own, because batch one recorded a generic inbox
  // as "published": ask what the address actually is instead.
  const fresh = isGenericAddress(target.email) ? await resolveAddress(target, { verify, hunt }) : null;

  // The whole point of chasing someone who only ever got the shared inbox is
  // to reach them personally this time. If the verifier could not answer, the
  // chase is worth nothing and there is exactly one of them per person, so
  // stop rather than spend it on the inbox that already failed.
  if (fresh?.verifierBlind) return { sent: false, reason: "verifier-blind" };

  const isPersonal = fresh && (fresh.source === "verified" || fresh.source === "published");
  const to = isPersonal ? fresh.email : target.email;
  if (!to) return { sent: false, reason: "no-address" };

  const viaGeneric = isGenericAddress(to);
  const body = buildFollowUp({
    personName: target.personName,
    newsHook: target.newsHook,
    questions: target.questions,
    titleName,
    siteUrl,
    senderName,
    viaGeneric,
    firstContact: isPersonal,
  });
  const subject = followUpSubject(target.company);

  try {
    await sendGmail({ outreach, to, toName: target.personName, subject, text: body, html: htmlise(body) });
  } catch (e) {
    await db.interviewTarget.update({
      where: { id: target.id },
      data: { error: String(e.message).slice(0, 400), attempts: { increment: 1 } },
    });
    return { sent: false, reason: "send-failed", error: e.message };
  }

  await db.interviewTarget.update({
    where: { id: target.id },
    data: {
      followUpSentAt: new Date(),
      // Only move the address of record when we actually reached somewhere
      // better. A chase to the same inbox changes nothing about provenance.
      ...(isPersonal
        ? {
            email: to,
            emailSource: fresh.source,
            triedEmails: [...splitTried(target.triedEmails), to].join("\n"),
          }
        : {}),
      error: null,
      attempts: { increment: 1 },
    },
  });
  return { sent: true, email: to, source: isPersonal ? fresh.source : target.emailSource, firstContact: isPersonal };
}

// A yes answered inside a minute reads as a robot, so the questions wait.
// Randomised rather than a flat hour for the same reason: an interval that is
// always identical is itself a pattern.
export function questionDelayMinutes() {
  return 45 + Math.floor(Math.random() * 46); // 45-90
}

/** Business hours in UK local time. A yes at 11pm gets its questions at 9am. */
export function nextSendableTime(from = new Date()) {
  const uk = new Date(from.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const h = uk.getHours();
  const day = uk.getDay();
  const at = new Date(from);
  if (day === 0 || day === 6) {
    at.setDate(at.getDate() + (day === 0 ? 1 : 2));
    at.setHours(9, 0, 0, 0);
    return at;
  }
  if (h < 8) { at.setHours(9, 0, 0, 0); return at; }
  if (h >= 18) { at.setDate(at.getDate() + 1); at.setHours(9, 0, 0, 0); return at; }
  return at;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export const STATUS_LABEL = {
  pending: "Ready to send",
  asked: "Asked",
  agreed: "Said yes",
  questioned: "Questions sent",
  answered: "Answers in",
  drafted: "Drafted",
  published: "Published",
  declined: "Declined",
  exhausted: "No address found",
  bounced: "Bounced",
  failed: "Held back",
};

// Counted apart from replies on purpose. "Exhausted" is not a no: nobody ever
// saw the email, and rolling it into declines would flatter the reply rate
// with people who were never actually asked.
export async function interviewStats(db, siteId) {
  const rows = await db.interviewTarget.groupBy({
    by: ["status"],
    where: siteId ? { siteId } : undefined,
    _count: { _all: true },
  });
  const by = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  const n = (k) => by[k] || 0;
  const asked = n("asked") + n("agreed") + n("questioned") + n("answered") + n("drafted") + n("published") + n("declined") + n("bounced");
  const agreed = n("agreed") + n("questioned") + n("answered") + n("drafted") + n("published");
  return {
    total: Object.values(by).reduce((a, b) => a + b, 0),
    pending: n("pending"),
    asked,
    agreed,
    answered: n("answered") + n("drafted") + n("published"),
    published: n("published"),
    declined: n("declined"),
    unreachable: n("exhausted") + n("bounced"),
    replyRate: asked ? Math.round(((agreed + n("declined")) / asked) * 100) : null,
    winRate: asked ? Math.round((n("published") / asked) * 100) : null,
  };
}

export function interviewSetupHint(creds) {
  if (!isGmailConfigured(creds?.outreach)) return "Sending is not configured for this title yet.";
  return null;
}
