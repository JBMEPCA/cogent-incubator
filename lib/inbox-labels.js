// The two labelling jobs Gmail's own filters cannot do, run hourly against the
// hub inbox.
//
// Filters handle everything a rule can express: which title a message belongs
// to, interviews by subject, promotions, no-reply senders. Two things are left
// over and both need the database.
//
// Backlinks: the subject lines are written per brand by the model, so the only
// signal that a message is a backlink reply is that its sender is somebody the
// outreach engine wrote to. Gmail has never heard of OutreachEmail.
//
// Needs reply: whether a thread is waiting on us is a fact about the LAST
// message in it, which no filter sees. It is also the only pile in the inbox
// that is actually work, so it earns the extra pass.
//
// The sender heuristics come from mail-triage.js rather than a second copy:
// those lists earned their entries one wrong badge at a time.
//
// Two labels on every email. JB, 28 Oct 2026: "every email have two labels, a
// title, and a 'what is it'. Some only have one, some have 5, I kind of want
// uniformity and neatness." Four things label this inbox — his Gmail filters,
// this job, the press desk and the pitch lane — and none knew about the
// others. So the labels they set (Topics/, Press/, Pitch/) stay on the mail,
// because the desk searches by them, but are hidden from the message list. What
// shows is one Titles/ label and one DISPLAY label, chosen here from all of
// them, plus Needs reply when a thread is waiting on us.
import { getGoogleAccessToken } from "./google";
import { decryptJson } from "./crypto";
import { fleetRead, prisma } from "./prisma";
import { parseAddress, isMachineSender, isAutomated } from "./mail-triage";

// The hub is the mailbox the other four forward into. It is Smart SME's own
// mailbox rather than a sixth account, so this is a real title address and not
// a special case anywhere else in the code.
export const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// The one list of which titles the hub knows about. It was copied into five
// files, and a title missing from any one of them fails quietly: no label, and
// worse, its address is left out of titleAddresses(), so every other title's
// interview sweep reads its replies as if they were its own. Add a title here
// and nowhere else.
export const TITLE_LABEL = {
  "smart-sme": "Titles/SME",
  "fleet-magazine": "Titles/Fleet",
  "golf-resort-magazine": "Titles/Golf",
  "barbering-business": "Titles/Barbering",
  "airport-business-magazine": "Titles/Airports",
  // The 18 Sep 2026 wave.
  "gym-business-news": "Titles/Gym",
  "nursery-daily": "Titles/Nursery",
  "smart-farming-news": "Titles/Farming",
  "senior-lifestyle-business": "Titles/Retirement",
  "dental-business-news": "Titles/Dental",
};

const TOPIC = {
  backlinks: "Topics/Backlinks",
  interviews: "Topics/Interviews",
  enquiries: "Topics/Enquiries",
  needsReply: "Needs reply",
};

// The "what is it" label, one per email. Colour only where it carries an
// outcome: green went out, red was turned down, amber is waiting on a person.
// Everything else is quiet grey so the coloured title stays the loudest thing
// on the line. Colours must come from Gmail's own palette or the API refuses.
const GREEN = { backgroundColor: "#0b804b", textColor: "#ffffff" };
const RED = { backgroundColor: "#cc3a21", textColor: "#ffffff" };
const AMBER = { backgroundColor: "#eaa041", textColor: "#ffffff" };
const BLUE = { backgroundColor: "#c9daf8", textColor: "#1c4587" };
const GREY = { backgroundColor: "#efefef", textColor: "#434343" };
export const DISPLAY = {
  pitchWaiting: { name: "Pitch – Waiting", color: BLUE },
  pitchPublished: { name: "Pitch – Published", color: GREEN },
  pitchDeclined: { name: "Pitch – Declined", color: RED },
  // The comment lane (press-intake.js, 28 Oct 2026) and whether the sender has
  // been told. The reply leaves from the title's own mailbox, so without
  // "Replied" here the hub shows an answered email as unanswered.
  commentReplied: { name: "Comment – Replied", color: GREEN },
  commentPublished: { name: "Comment – Published", color: GREEN },
  interview: { name: "Interview", color: GREY },
  prReplied: { name: "PR – Replied", color: GREEN },
  prPublished: { name: "PR – Published", color: GREEN },
  prScheduled: { name: "PR – Scheduled", color: GREEN },
  prSkipped: { name: "PR – Skipped", color: RED },
  prHeld: { name: "PR – Held", color: AMBER },
  prNew: { name: "PR – New", color: BLUE },
  backlink: { name: "Backlink", color: GREY },
  enquiry: { name: "Enquiry", color: GREY },
  admin: { name: "Admin", color: GREY },
  newsletter: { name: "Newsletter", color: GREY },
  noise: { name: "Noise", color: GREY },
};
const DISPLAY_NAMES = new Set(Object.values(DISPLAY).map((d) => d.name));
// The one label besides the two that may show: it is the only one that is work.
const NEEDS_REPLY_COLOR = { backgroundColor: "#fad165", textColor: "#000000" };
// Kept on the mail for the machinery, hidden from the message list.
const WORKING = /^(Topics|Press|Pitch|Comment)\//;

/**
 * The display label for one email, from the labels it already wears and, for
 * press mail the desk handled in another title's mailbox, the desk's verdict.
 * First match wins, so the order is the priority.
 */
export function displayFor(have, { pressOutcome = null, human = false } = {}) {
  if (have.has("Pitch/Published")) return DISPLAY.pitchPublished;
  if (have.has("Pitch/Declined")) return DISPLAY.pitchDeclined;
  if (have.has("Pitch/Awaiting content") || have.has("Pitch/Ask due")) return DISPLAY.pitchWaiting;
  if (have.has("Comment/Published") || have.has("Comment/Added")) return have.has("Press/Replied") ? DISPLAY.commentReplied : DISPLAY.commentPublished;
  if (have.has(TOPIC.interviews)) return DISPLAY.interview;
  const outcome =
    (have.has("Press/Published") && "published") ||
    (have.has("Press/Scheduled") && "scheduled") ||
    (have.has("Press/Needs review") && "held") ||
    (have.has("Press/Skipped") && "skipped") ||
    pressOutcome;
  if (outcome || have.has("Topics/Press")) {
    // Press mail nobody sorted, that a filter also called noise, is noise: an
    // auto-reply or a list mailing that happened to go to press@.
    if (!outcome && have.has("Topics/Noise")) return DISPLAY.noise;
    if (outcome === "published" && have.has("Press/Replied")) return DISPLAY.prReplied;
    return { published: DISPLAY.prPublished, scheduled: DISPLAY.prScheduled, held: DISPLAY.prHeld, skipped: DISPLAY.prSkipped }[outcome] || DISPLAY.prNew;
  }
  if (have.has(TOPIC.backlinks)) return DISPLAY.backlink;
  if (have.has(TOPIC.enquiries)) return DISPLAY.enquiry;
  if (have.has("Topics/Admin")) return DISPLAY.admin;
  if (have.has("Topics/Newsletter")) return DISPLAY.newsletter;
  if (have.has("Topics/Noise")) return DISPLAY.noise;
  return human ? DISPLAY.enquiry : DISPLAY.noise;
}

/**
 * Which title an email belongs to, by domain rather than by address: press
 * releases arrive at press@<title>, newsletter auto-replies at
 * news@news.smartsme.co.uk, and matching only each title's jb@ address left
 * two hundred emails a fortnight with no title at all.
 *
 * One title, never two. The address it was originally delivered to wins, then
 * To and Cc, then From. The hub's own domain counts only when it is in To, Cc
 * or From: every copy forwarded into the hub carries the hub in Delivered-To.
 */
export function titleFor(h, domains, hubDomain) {
  const at = (s) => [...String(s || "").toLowerCase().matchAll(/@([a-z0-9.-]+)/g)].map((m) => m[1]);
  const delivered = [...at(h["delivered-to"]), ...at(h["x-forwarded-to"])].filter((d) => d !== hubDomain);
  for (const d of [...delivered, ...at(h.to), ...at(h.cc), ...at(h.from)]) {
    for (const [dom, label] of domains) if (d === dom || d.endsWith(`.${dom}`)) return label;
  }
  return null;
}

const HEADERS = [
  "From",
  "To",
  "Cc",
  "Delivered-To",
  "X-Forwarded-To",
  "Subject",
  "List-Unsubscribe",
  "Auto-Submitted",
  "Precedence",
  "X-Auto-Response-Suppress",
];

/**
 * Every title's sending mailbox, lowercased, keyed to its label.
 *
 * Also what tells one title's mail from another's now that they all land in the
 * same inbox: the interview sweep uses it to exclude the four addresses that
 * are not its own.
 */
export async function titleAddresses() {
  const rows = await fleetRead().siteCredential.findMany({
    where: { kind: "outreach" },
    select: { payloadEnc: true, site: { select: { slug: true } } },
  });
  const map = new Map();
  for (const r of rows) {
    const label = TITLE_LABEL[r.site.slug];
    if (!label) continue;
    let payload;
    try {
      payload = decryptJson(r.payloadEnc);
    } catch {
      continue;
    }
    if (payload?.fromEmail) map.set(payload.fromEmail.toLowerCase(), label);
  }
  return map;
}

async function api(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} -> ${res.status} ${json?.error?.message || ""}`.trim());
  return json;
}

/**
 * The hub's labels, put into shape: the display labels exist and wear their
 * colours, the working labels are hidden from the message list, Needs reply is
 * yellow. Idempotent, and a label already right is not touched, so on a normal
 * hour this is one listing and nothing else.
 */
async function prepareLabels(token, { dryRun = false } = {}) {
  const live = (await api(token, "/labels")).labels || [];
  const want = new Map();
  for (const d of Object.values(DISPLAY)) want.set(d.name, { color: d.color, messageListVisibility: "show", labelListVisibility: "labelShow" });
  want.set(TOPIC.needsReply, { color: NEEDS_REPLY_COLOR, messageListVisibility: "show" });
  for (const l of live) if (WORKING.test(l.name)) want.set(l.name, { messageListVisibility: "hide" });

  if (!dryRun) {
    for (const [name, style] of want) {
      const l = live.find((x) => x.name === name);
      if (!l) {
        live.push(await api(token, "/labels", { method: "POST", body: { name, labelListVisibility: "labelShow", messageListVisibility: "show", ...style } }));
        continue;
      }
      const off =
        (style.color && (l.color?.backgroundColor !== style.color.backgroundColor || l.color?.textColor !== style.color.textColor)) ||
        (style.messageListVisibility && l.messageListVisibility !== style.messageListVisibility);
      if (off) await api(token, `/labels/${l.id}`, { method: "PATCH", body: style }).catch((e) => console.warn(`[inbox] could not style ${name}: ${e.message}`));
    }
  }
  return { idByName: new Map(live.map((l) => [l.name, l.id])), nameById: new Map(live.map((l) => [l.id, l.name])) };
}

/**
 * What the press desk did with each recent release, keyed by title label.
 *
 * The desk works in each title's own mailbox; the hub only holds a forwarded
 * copy, which never gets the desk's Press/ labels. The desk's rows are the
 * record, so the hub copy's outcome is read from them, matched on subject:
 * the desk files each release under its cleaned subject line.
 */
async function pressOutcomes(db, days) {
  const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
  const labelBySite = new Map(sites.map((s) => [s.id, TITLE_LABEL[s.slug]]));
  const items = await db.feedItem.findMany({
    where: { link: { startsWith: "gmail:" }, NOT: { link: { startsWith: "gmail:dry-" } }, discoveredAt: { gte: new Date(Date.now() - days * 864e5) } },
    select: { siteId: true, title: true, status: true, summary: true, articles: { select: { status: true, publishedAt: true } } },
  });
  const now = new Date();
  const out = new Map();
  for (const i of items) {
    const label = labelBySite.get(i.siteId);
    // Pitches are labelled Pitch/ in the hub directly; their rows are not releases.
    if (!label || String(i.summary || "").includes("[pitch:") || i.title.length < 8) continue;
    const live = i.articles.find((a) => a.status === "published");
    const outcome = live
      ? live.publishedAt > now ? "scheduled" : "published"
      : i.status === "dismissed" ? "skipped"
      : i.status === "shortlisted" ? "held"
      : null;
    if (!outcome) continue;
    if (!out.has(label)) out.set(label, []);
    out.get(label).push({ title: i.title.toLowerCase(), outcome });
  }
  return out;
}

/** The desk's outcome for a subject line, or null. Longest title first, so "Re:" chains match their own release. */
function outcomeFor(rows, subject) {
  const s = String(subject || "").toLowerCase();
  let best = null;
  for (const r of rows || []) if (s.includes(r.title) && (!best || r.title.length > best.title.length)) best = r;
  return best?.outcome || null;
}

/**
 * One pass over the hub.
 *
 * `days` is deliberately small: this runs every hour, so it only ever has an
 * hour of new mail to catch up on, and the wall-clock budget of the cron route
 * it hangs off is shared with the interview sweep. The Needs reply pass always
 * looks at every thread already carrying the label however far back it goes,
 * because clearing one JB has answered matters as much as flagging a new one.
 */
export async function runInboxLabels({ days = 2, maxMessages = 150, maxThreads = 150, budgetMs = 20000, dryRun = false } = {}) {
  // A wall-clock budget, because this shares a 60s route with the interview
  // sweep and is the less important of the two. /api/cron/interviews has hit
  // that ceiling before (504 on 7 Sep), and an unbounded 300-call pass on a
  // busy morning would be the thing that pushed it over. Whatever is not
  // reached this hour is reached next hour: the queries are time-windowed, and
  // the pass is add-only apart from labels it is correcting.
  const deadline = Date.now() + budgetMs;
  const outOfTime = () => Date.now() > deadline;
  const db = fleetRead();

  const titleByAddress = await titleAddresses();
  if (!titleByAddress.has(HUB.toLowerCase())) {
    return { available: false, reason: `${HUB} has no outreach credential, so the hub cannot be identified.` };
  }

  let token;
  try {
    token = await getGoogleAccessToken(SCOPES, HUB);
  } catch {
    return { available: false, reason: `gmail.modify is not delegated for ${HUB}.` };
  }

  const { idByName, nameById } = await prepareLabels(token, { dryRun });
  const missing = [...Object.values(TITLE_LABEL), ...Object.values(TOPIC)].filter((n) => !idByName.has(n));
  if (missing.length) {
    return { available: false, reason: `labels missing from ${HUB}: ${missing.join(", ")}` };
  }

  const contacts = await db.outreachEmail.findMany({
    where: { contactEmail: { not: null } },
    select: { contactEmail: true },
  });
  const contactEmails = new Set(contacts.map((r) => r.contactEmail.toLowerCase()));
  const contactDomains = new Set([...contactEmails].map((e) => e.split("@")[1]).filter(Boolean));

  // Each title's mail domain, for titleFor().
  const domains = new Map([...titleByAddress].map(([addr, label]) => [addr.split("@")[1], label]));
  const hubDomain = HUB.toLowerCase().split("@")[1];
  const outcomes = await pressOutcomes(db, days + 3);

  // ------------------------------------------------------------ messages ---
  const ids = [];
  let pageToken = "";
  do {
    const list = await api(
      token,
      `/messages?q=${encodeURIComponent(`newer_than:${days}d -in:chats`)}&maxResults=${Math.min(maxMessages - ids.length, 500)}${pageToken ? `&pageToken=${pageToken}` : ""}`
    );
    ids.push(...(list.messages || []).map((m) => m.id));
    pageToken = list.nextPageToken;
  } while (pageToken && ids.length < maxMessages);

  const toAdd = new Map();
  const toRemove = new Map();
  const counts = {};
  const bump = (k) => (counts[k] = (counts[k] || 0) + 1);
  const queue = (map, name, id) => {
    const lid = idByName.get(name);
    if (!lid) return;
    if (!map.has(lid)) map.set(lid, []);
    map.get(lid).push(id);
    bump(`${map === toRemove ? "-" : ""}${name}`);
  };

  const preview = [];
  let truncated = false;
  for (const id of ids) {
    if (outOfTime()) { truncated = true; break; }
    const m = await api(token, `/messages/${id}?format=metadata&${HEADERS.map((h) => `metadataHeaders=${h}`).join("&")}`);
    const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    const have = new Set((m.labelIds || []).map((x) => nameById.get(x) || x));

    const title = titleFor(h, domains, hubDomain);
    const subject = h.subject || "";
    const from = parseAddress(h.from || "");
    const automated = {
      subject,
      listUnsubscribe: Boolean(h["list-unsubscribe"]),
      autoSubmitted: (h["auto-submitted"] || "no").toLowerCase() !== "no" || Boolean(h["x-auto-response-suppress"]),
      precedence: (h.precedence || "").toLowerCase(),
    };
    const human = Boolean(from.email) && !titleByAddress.has(from.email) && !isMachineSender(from) && !isAutomated(automated);

    // The topic labels the rest of the machinery reads, added as before.
    const topics = [];
    if (/featuring you in|seven questions for/i.test(subject)) topics.push(TOPIC.interviews);
    else if (contactEmails.has(from.email) || contactDomains.has(from.domain)) topics.push(TOPIC.backlinks);
    else if (human) topics.push(TOPIC.enquiries);
    for (const name of topics) if (!have.has(name)) { queue(toAdd, name, id); have.add(name); }

    // The two that show. Title labels come off as well as on: without that
    // there is no way to undo a bad rule on mail that has already been filed.
    const pressOutcome = title ? outcomeFor(outcomes.get(title), subject) : null;
    // Our own sent mail gets its title and nothing else. Gmail shows a
    // conversation's labels as the union of its messages', so a "what is it"
    // on the outreach we sent would put two on every thread that got a reply.
    const display = m.labelIds?.includes("SENT") ? null : displayFor(have, { pressOutcome, human }).name;
    if (dryRun) preview.push({ subject: subject.slice(0, 70), from: from.email, title, display, before: [...have].filter((n) => !/^[A-Z_]+$/.test(n) && !/^Label_/.test(n)) });
    // No title worked out means leave whatever a filter set, not strip it.
    for (const name of [...(title ? Object.values(TITLE_LABEL) : []), ...DISPLAY_NAMES]) {
      const wanted = name === title || name === display;
      if (wanted && !have.has(name)) queue(toAdd, name, id);
      else if (!wanted && have.has(name)) queue(toRemove, name, id);
    }
  }

  if (!dryRun) {
    for (const [lid, msgIds] of toAdd) {
      for (let i = 0; i < msgIds.length; i += 900) {
        await api(token, "/messages/batchModify", { method: "POST", body: { ids: msgIds.slice(i, i + 900), addLabelIds: [lid] } });
      }
    }
    for (const [lid, msgIds] of toRemove) {
      for (let i = 0; i < msgIds.length; i += 900) {
        await api(token, "/messages/batchModify", { method: "POST", body: { ids: msgIds.slice(i, i + 900), removeLabelIds: [lid] } });
      }
    }
  }
  if (dryRun) return { available: true, dryRun: true, hub: HUB, messages: ids.length, changes: counts, truncated, preview };

  // ------------------------------------------------------------- threads ---
  // Recent conversations, plus everything already flagged however old, so a
  // thread JB has answered stops nagging.
  const needsId = idByName.get(TOPIC.needsReply);
  const threadQ =
    `label:"${TOPIC.needsReply}" OR (newer_than:${days * 15}d ` +
    `(label:"${TOPIC.backlinks}" OR label:"${TOPIC.interviews}" OR label:"${TOPIC.enquiries}"))`;
  const threads = { threads: [] };
  let threadPage = "";
  do {
    const page = await api(token, `/threads?q=${encodeURIComponent(threadQ)}&maxResults=${Math.min(maxThreads - threads.threads.length, 500)}${threadPage ? `&pageToken=${threadPage}` : ""}`);
    threads.threads.push(...(page.threads || []));
    threadPage = page.nextPageToken;
  } while (threadPage && threads.threads.length < maxThreads);

  let flagged = 0;
  let cleared = 0;
  for (const t of (threads.threads || []).slice(0, maxThreads)) {
    if (outOfTime()) { truncated = true; break; }
    const th = await api(token, `/threads/${t.id}?format=metadata&metadataHeaders=From`);
    const msgs = th.messages || [];
    if (!msgs.length) continue;
    const last = msgs[msgs.length - 1];
    const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    const from = parseAddress(h.from || "");
    const isFlagged = (last.labelIds || []).includes(needsId);
    // Waiting on us when the last word was theirs, and they are a person.
    //
    // Not on press mail or noise. A release from an agency is a person writing
    // to us, but the desk answers it, and on 28 Oct 2026 half the 200 threads
    // flagged were releases. Needs reply is the one label allowed beside the
    // two (see DISPLAY), so it has to mean work.
    // The whole conversation, not the last email: an agency's "did you get
    // it?" goes to jb@, not press@, and carries none of the press labels.
    const lastNames = new Set(msgs.flatMap((x) => x.labelIds || []).map((x) => nameById.get(x)));
    const handled = ["Topics/Press", "Topics/Noise", "Topics/Newsletter"].some((n) => lastNames.has(n)) || [...lastNames].some((n) => /^Pitch\//.test(n || ""));
    const waiting = !handled && !titleByAddress.has(from.email) && !isMachineSender(from);
    if (waiting && !isFlagged) {
      await api(token, `/threads/${t.id}/modify`, { method: "POST", body: { addLabelIds: [needsId] } });
      flagged++;
    } else if (!waiting && isFlagged) {
      await api(token, `/threads/${t.id}/modify`, { method: "POST", body: { removeLabelIds: [needsId] } });
      cleared++;
    }
  }

  return { available: true, hub: HUB, messages: ids.length, changes: counts, needsReply: { flagged, cleared }, truncated };
}
