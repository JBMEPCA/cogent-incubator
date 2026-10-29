import { getSiteContext } from "./site";
import { noteworthyMail } from "./mail-triage";
import { HUB } from "./inbox-labels";

/**
 * Mail worth reading across every title's mailbox, newest first.
 *
 * Shared by the home page widget and the full /mail page so the two can never
 * disagree about what counts. A mailbox that cannot be read is named in
 * `unavailable` rather than failing the whole list.
 */
export async function fleetMail(sites, { perSite = 15 } = {}) {
  const results = await Promise.all(
    sites.map(async (s) => {
      try {
        const ctx = await getSiteContext(s.slug);
        if (!ctx) return null;
        return await noteworthyMail(ctx.site, ctx.creds, ctx.db, { max: perSite });
      } catch {
        return null;
      }
    })
  );

  const unavailable = [];
  const all = [];
  results.forEach((r, i) => {
    if (!r) return;
    if (!r.available) unavailable.push(sites[i].name);
    else {
      const hub = String(r.address || "").toLowerCase() === HUB.toLowerCase();
      all.push(...r.items.map((m) => ({ ...m, hub, site: { ...m.site, accentHex: sites[i].accentHex } })));
    }
  });

  // Every title's inbox forwards to the hub (jb@smartsme.co.uk), so one email
  // arrives twice: in the title's own inbox and in Smart SME's. Same email,
  // same Message-ID, so keep one. The title's own copy wins, because it says
  // which magazine the email was for; the hub copy is kept only when it is
  // the only one (mail sent to Smart SME itself). Unread if either copy is.
  // Without a Message-ID, sender + subject + the same ten minutes stands in.
  const keyOf = (m) =>
    m.messageId ||
    `${m.fromParsed?.email}|${String(m.subject || "").toLowerCase().trim()}|${Math.round(new Date(m.date || 0).getTime() / 6e5)}`;
  const byKey = new Map();
  for (const m of all) {
    const k = keyOf(m);
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, m);
    else {
      const keep = prev.hub && !m.hub ? m : prev;
      byKey.set(k, { ...keep, unread: prev.unread || m.unread, kind: prev.kind === "backlink" || m.kind === "backlink" ? "backlink" : keep.kind });
    }
  }
  // Then one row per conversation, as Gmail shows it: someone replying three
  // times in a thread read as the same email listed three times. The newest
  // message leads, with how many there are.
  const newestFirst = [...byKey.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const threads = new Map();
  for (const m of newestFirst) {
    const k = m.threadId ? `${m.site.slug}|${m.threadId}` : `${m.site.slug}|${m.id}`;
    const t = threads.get(k);
    if (!t) threads.set(k, { ...m, count: 1 });
    else {
      t.count += 1;
      t.unread = t.unread || m.unread;
      if (m.kind === "backlink") t.kind = "backlink";
      // A website enquiry stays one when a later reply leads the thread.
      else if (m.kind === "enquiry" && t.kind !== "backlink") {
        t.kind = "enquiry";
        t.enquiryType = t.enquiryType || m.enquiryType;
      }
    }
  }
  return { items: [...threads.values()], unavailable };
}

/** Day and time in UK local, short: "8 Oct, 09:42", or just "09:42" today. */
export function mailTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const opts = { timeZone: "Europe/London" };
  const day = (x) => x.toLocaleDateString("en-GB", opts);
  if (day(d) === day(new Date())) {
    return d.toLocaleTimeString("en-GB", { ...opts, hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "short" });
}
